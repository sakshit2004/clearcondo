/**
 * One condo unit's public record: its current assessment, last year's,
 * and any Assessment Review Board complaints filed for it. Facts only —
 * no judgement about whether the unit is over- or under-assessed (open
 * data has no unit size, condition or sales).
 */
import { CALGARY_DATASETS, soql, type SocrataOptions } from "./socrata.ts";
import {
  normalizeStreetAddress,
  planWhere,
  stripUnitFromRollAddress,
  toRollUnits,
  unitsForPlan,
  type RollUnit,
} from "./match.ts";
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

/** A typed unit field ("#1203", "Unit 1203", "4b") as the roll writes it: "1203", "4B". Null if empty. */
export function normalizeUnitInput(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const u = (extractUnit(`#${raw}`) ?? raw.replace(/[^0-9A-Z]/gi, "")).toUpperCase();
  return u || null;
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

/** Only digits/letters count as a unit number. */
const SAFE_UNIT = /^[0-9]+[A-Z]?$/;

/** "0303" and "303" are the same unit. */
const sameUnit = (a: string, b: string) => a.replace(/^0+(?=\d)/, "") === b.replace(/^0+(?=\d)/, "");

/**
 * The unit's row among a plan's roll units: the one whose roll address
 * starts with the unit number. Exported for tests.
 */
export function findUnit(units: RollUnit[], unit: string): RollUnit | null {
  const u = unit.toUpperCase();
  for (const r of units) {
    const addr = (r.address ?? "").toUpperCase().replace(/\s+/g, " ").trim();
    const first = addr.split(" ")[0] ?? "";
    if (first && sameUnit(first, u) && stripUnitFromRollAddress(addr) !== addr) return r;
  }
  return null;
}

/**
 * The unit's record on the current roll. Uses the same plan query as the
 * building check (no column list, no address filter in SoQL) and finds the
 * unit in code. Throws CityDataError if the roll query fails; history and
 * complaints degrade to null.
 */
export async function fetchUnitRecord(
  plan: string,
  unit: string,
  opts: SocrataOptions = {}
): Promise<UnitRecord | null> {
  const u = unit.toUpperCase();
  if (!SAFE_UNIT.test(u)) return null;
  const rows = await soql(CALGARY_DATASETS.currentRoll, { $where: planWhere(plan), $limit: "5000" }, opts);
  const row = findUnit(unitsForPlan(toRollUnits(rows), plan), u);
  if (!row) return null;
  const address = (row.address ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  const roll = row.roll_number;
  const value = row.assessed_value;
  const year = row.roll_year;

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
    unit: address.split(" ")[0] || u,
    address,
    assessed_value: value,
    roll_year: year,
    prev_year: prevYear,
    prev_value: prevValue,
    change: value != null && prevValue ? value / prevValue - 1 : null,
    complaints: appeals.status === "fulfilled" ? appeals.value.history : null,
  };
}
