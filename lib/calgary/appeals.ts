/**
 * Property tax & appeals (preview): a condo building's past Assessment
 * Review Board complaints, from City of Calgary open data, and what its
 * assessments mean in property tax.
 *
 * Complaints are matched to the building by each unit's exact roll
 * address; titled parking stalls are excluded. Everything shown by default
 * is a public fact or a plain calculation from one. Two optional, private
 * inputs come from the environment and are never committed:
 * - APPEALS_GROUP_MIN + APPEALS_GROUP_WIN_SHARE enable a short reading of
 *   past group filings (otherwise only the history is shown);
 * - APPEALS_TYPICAL_CUT enables the "if the assessment came down" estimate.
 * Open data can't see unit size, condition or sales, so nothing here says a
 * building is fairly or unfairly assessed.
 */
import {
  CALGARY_DATASETS,
  datasetPageUrl,
  soql,
  soqlString,
  str,
  type SocrataOptions,
  type SocrataRow,
} from "./socrata.ts";

/** 2026 Calgary residential tax rate (City 0.38906% + Province 0.27593%), from the City's tax bylaw. */
export const CALGARY_RES_TAX_RATE_2026 = 0.0066499;
/** First year in the Review Board dataset. */
export const REVIEW_BOARD_SINCE = 2013;

export interface AppealsParams {
  groupMin: number | null;
  groupWinShare: number | null;
  typicalCut: number | null;
}

const envNumber = (name: string, min: number, max: number): number | null => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= min && v <= max ? v : null;
};

/** Private parameters from the environment; null when unset or out of range. */
export function appealsParamsFromEnv(): AppealsParams {
  return {
    groupMin: envNumber("APPEALS_GROUP_MIN", 2, 1000),
    groupWinShare: envNumber("APPEALS_GROUP_WIN_SHARE", 0.01, 1),
    typicalCut: envNumber("APPEALS_TYPICAL_CUT", 0.001, 0.5),
  };
}

export type ComplaintOutcome = "settled" | "decreased" | "no_change" | "dismissed" | "increase" | "withdrawn" | "other";

/** Read the dataset's status and decision fields as one outcome. */
export function complaintOutcome(status: string | null, decision: string | null): ComplaintOutcome {
  const s = (status ?? "").toLowerCase();
  const d = (decision ?? "").toLowerCase();
  if (s.includes("mutual") || d.includes("mutual")) return "settled";
  if (d === "decrease") return "decreased";
  if (d === "no change") return "no_change";
  if (d === "dismissed") return "dismissed";
  if (d === "increase") return "increase";
  if (s.includes("withdrawn")) return "withdrawn";
  return "other";
}

/** Settled with the City or decreased by the Board. */
export const isLowered = (o: ComplaintOutcome) => o === "settled" || o === "decreased";

/** Uppercase, single spaces: how roll and Review Board addresses are compared. */
export function normalizeArbAddress(a: string | null | undefined): string {
  return (a ?? "").toUpperCase().replace(/\s+/g, " ").trim();
}

/** "12V 500 SAMPLE ST SW": a titled parking stall, not a home. */
export function isParkingStall(address: string): boolean {
  return /^\d+V$/.test(address.split(" ")[0] ?? "");
}

export interface ComplaintYear {
  year: number;
  filed: number;
  lowered: number;
  not_lowered: number;
}

/** A reading of past group filings; only produced when the private parameters are set. */
export type AppealsReading = "group_lowered" | "group_not_lowered" | "no_group";

export interface AppealsSection {
  status: "ok";
  history: ComplaintYear[];
  filed_total: number;
  lowered_total: number;
  reading: AppealsReading | null;
  /** The group filing the reading rests on (latest one), if any. */
  reading_year: ComplaintYear | null;
  /** Share for the "if the assessment came down" estimate; null hides it. */
  typical_cut: number | null;
  source_url: string;
}

/**
 * Complaints by year for the building's units. One complaint per unit per
 * year (a unit filing twice in a year counts once, lowered if any was).
 */
export function summarizeComplaints(
  rows: SocrataRow[],
  unitAddresses: Set<string>,
  params: AppealsParams = { groupMin: null, groupWinShare: null, typicalCut: null }
): Omit<AppealsSection, "status" | "source_url"> {
  const byUnitYear = new Map<string, { year: number; lowered: boolean }>();
  for (const r of rows) {
    const addr = normalizeArbAddress(str(r, "location_address"));
    const year = Number(str(r, "year"));
    if (!addr || !unitAddresses.has(addr) || isParkingStall(addr) || !Number.isFinite(year)) continue;
    const key = `${year}|${addr}`;
    const lowered = isLowered(complaintOutcome(str(r, "status"), str(r, "board_s_decision")));
    const prev = byUnitYear.get(key);
    byUnitYear.set(key, { year, lowered: lowered || (prev?.lowered ?? false) });
  }
  const years = new Map<number, ComplaintYear>();
  for (const { year, lowered } of byUnitYear.values()) {
    const y = years.get(year) ?? { year, filed: 0, lowered: 0, not_lowered: 0 };
    y.filed++;
    if (lowered) y.lowered++;
    else y.not_lowered++;
    years.set(year, y);
  }
  const history = [...years.values()].sort((a, b) => b.year - a.year);

  let reading: AppealsReading | null = null;
  let readingYear: ComplaintYear | null = null;
  const { groupMin, groupWinShare } = params;
  if (groupMin != null && groupWinShare != null) {
    const groups = history.filter((y) => y.filed >= groupMin);
    const lowered = groups.filter((y) => y.lowered >= groupWinShare * y.filed);
    const notLowered = groups.filter((y) => y.lowered < groupWinShare * y.filed);
    reading = lowered.length ? "group_lowered" : notLowered.length ? "group_not_lowered" : "no_group";
    readingYear = lowered[0] ?? notLowered[0] ?? null;
  }
  return {
    history,
    filed_total: history.reduce((n, y) => n + y.filed, 0),
    lowered_total: history.reduce((n, y) => n + y.lowered, 0),
    reading,
    reading_year: readingYear,
    typical_cut: params.typicalCut,
  };
}

const ADDRESS_CHUNK = 40;

/** Review Board complaints for the building's unit addresses. Throws CityDataError on API failure. */
export async function fetchBuildingAppeals(
  unitAddresses: string[],
  opts: SocrataOptions & { params?: AppealsParams } = {}
): Promise<AppealsSection> {
  const addrs = [...new Set(unitAddresses.map(normalizeArbAddress).filter((a) => a && !isParkingStall(a)))];
  const chunks: string[][] = [];
  for (let i = 0; i < addrs.length; i += ADDRESS_CHUNK) chunks.push(addrs.slice(i, i + ADDRESS_CHUNK));
  const results = await Promise.all(
    chunks.map((chunk) =>
      soql(
        CALGARY_DATASETS.reviewBoard,
        {
          $select: "year, location_address, status, board_s_decision",
          $where: `upper(location_address) in (${chunk.map(soqlString).join(", ")})`,
          $limit: "5000",
        },
        opts
      )
    )
  );
  return {
    status: "ok",
    ...summarizeComplaints(results.flat(), new Set(addrs), opts.params ?? appealsParamsFromEnv()),
    source_url: datasetPageUrl(CALGARY_DATASETS.reviewBoard),
  };
}

/** Median unit value × the 2026 Calgary residential rate, one tax year. */
export function annualTax(value: number): number {
  return value * CALGARY_RES_TAX_RATE_2026;
}

/** Tax saved in one year if the value came down by `cut`. */
export function taxSaving(value: number, cut: number): number {
  return value * cut * CALGARY_RES_TAX_RATE_2026;
}
