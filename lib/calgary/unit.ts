/**
 * One condo unit's public record: its current assessment, last year's,
 * and any Assessment Review Board complaints filed for it. Facts only —
 * no judgement about whether the unit is over- or under-assessed (open
 * data has no unit size, condition or sales).
 */
import {
  CALGARY_DATASETS,
  normalizeRollNumber,
  parseMoney,
  soql,
  soqlString,
  str,
  type SocrataOptions,
} from "./socrata.ts";
import { normalizeStreetAddress, stripUnitFromRollAddress } from "./match.ts";
import { fetchHistory } from "./values.ts";
import { fetchBuildingAppeals, type ComplaintYear } from "./appeals.ts";

/**
 * The unit number in what someone typed, or null:
 * "#1203 1111 6 Ave SW", "Unit 1203, 1111 6 Ave SW", "1203-1111 6 Ave SW",
 * "1203 1111 6 AV SW" -> "1203".
 */
export function extractUnit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const up = raw.toUpperCase();
  const tagged = up.match(/(?:#|\b(?:UNIT|SUITE|APT|APARTMENT)\b\.?)\s*#?\s*([0-9]+[A-Z]?)\b/);
  if (tagged) return tagged[1];
  const dashed = up.match(/^\s*([0-9]+[A-Z]?)\s*-\s*[0-9]/);
  if (dashed) return dashed[1];
  const norm = normalizeStreetAddress(raw);
  const stripped = stripUnitFromRollAddress(raw);
  if (norm && stripped && norm !== stripped) return norm.split(" ")[0];
  return null;
}

export interface UnitRecord {
  unit: string;
  /** The unit's roll address, e.g. "1203 1111 6 AV SW". */
  address: string;
  assessed_value: number | null;
  roll_year: number | null;
  prev_year: number | null;
  prev_value: number | null;
  /** Change from the previous roll year, as a share (0.05 = +5%). */
  change: number | null;
  /** Review Board complaints for this unit, newest first. Null if that data was unavailable. */
  complaints: ComplaintYear[] | null;
}

/** Only digits/letters reach the query; anything else means "no unit". */
const SAFE_UNIT = /^[0-9]+[A-Z]?$/;

/**
 * The unit's record on the current roll, matched within its condo plan by
 * the unit number at the start of the roll address. Throws CityDataError
 * if the roll query fails; history and complaints degrade to null.
 */
export async function fetchUnitRecord(
  plan: string,
  unit: string,
  opts: SocrataOptions = {}
): Promise<UnitRecord | null> {
  const u = unit.toUpperCase();
  if (!SAFE_UNIT.test(u)) return null;
  const rows = await soql(
    CALGARY_DATASETS.currentRoll,
    {
      $select: "roll_number, address, assessed_value, roll_year, short_legal",
      $where: `short_legal like ${soqlString(`${plan};%`)} AND upper(address) like ${soqlString(`${u} %`)}`,
      $limit: "50",
    },
    opts
  );
  const row = rows.find((r) => {
    const addr = (str(r, "address") ?? "").toUpperCase().replace(/\s+/g, " ").trim();
    return addr.startsWith(`${u} `) && stripUnitFromRollAddress(addr) !== addr;
  });
  if (!row) return null;
  const address = (str(row, "address") ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  const roll = normalizeRollNumber(row.roll_number);
  const value = parseMoney(row.assessed_value);
  const year = parseMoney(row.roll_year);

  const [history, appeals] = await Promise.allSettled([
    roll ? fetchHistory([roll], opts) : Promise.resolve([]),
    fetchBuildingAppeals([address], opts),
  ]);
  let prevYear: number | null = null;
  let prevValue: number | null = null;
  if (history.status === "fulfilled") {
    const earlier = history.value.filter((h) => year == null || h.year < year).sort((a, b) => b.year - a.year);
    if (earlier[0]) {
      prevYear = earlier[0].year;
      prevValue = earlier[0].value;
    }
  }
  return {
    unit: u,
    address,
    assessed_value: value,
    roll_year: year,
    prev_year: prevYear,
    prev_value: prevValue,
    change: value != null && prevValue ? value / prevValue - 1 : null,
    complaints: appeals.status === "fulfilled" ? appeals.value.history : null,
  };
}
