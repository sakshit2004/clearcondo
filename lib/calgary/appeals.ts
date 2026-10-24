/**
 * Property tax & appeals (preview): a condo building's past Assessment
 * Review Board complaints, from City of Calgary open data, and what its
 * assessments mean in property tax.
 *
 * Facts only. Complaints are matched to the building by each unit's exact
 * roll address (titled parking stalls excluded) and counted per year by
 * the outcome the City's dataset records. No interpretation of outcomes,
 * no prediction, and nothing here says a building is fairly or unfairly
 * assessed: open data can't see unit size, condition or sales.
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

/** The dataset recorded a settlement with the City or a Board decrease. */
export const isSettledOrDecreased = (o: ComplaintOutcome) => o === "settled" || o === "decreased";

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
  /** Recorded as settled with the City or decreased by the Board. */
  settled_or_decreased: number;
  /** No change, dismissed, increase, withdrawn or other. */
  other: number;
}

export interface AppealsSection {
  status: "ok";
  history: ComplaintYear[];
  filed_total: number;
  settled_or_decreased_total: number;
  source_url: string;
}

/**
 * Complaints by year for the building's units. One complaint per unit per
 * year (a unit filing twice in a year counts once, as settled or decreased
 * if either was).
 */
export function summarizeComplaints(
  rows: SocrataRow[],
  unitAddresses: Set<string>
): Omit<AppealsSection, "status" | "source_url"> {
  const byUnitYear = new Map<string, { year: number; hit: boolean }>();
  for (const r of rows) {
    const addr = normalizeArbAddress(str(r, "location_address"));
    const year = Number(str(r, "year"));
    if (!addr || !unitAddresses.has(addr) || isParkingStall(addr) || !Number.isFinite(year)) continue;
    const key = `${year}|${addr}`;
    const hit = isSettledOrDecreased(complaintOutcome(str(r, "status"), str(r, "board_s_decision")));
    byUnitYear.set(key, { year, hit: hit || (byUnitYear.get(key)?.hit ?? false) });
  }
  const years = new Map<number, ComplaintYear>();
  for (const { year, hit } of byUnitYear.values()) {
    const y = years.get(year) ?? { year, filed: 0, settled_or_decreased: 0, other: 0 };
    y.filed++;
    if (hit) y.settled_or_decreased++;
    else y.other++;
    years.set(year, y);
  }
  const history = [...years.values()].sort((a, b) => b.year - a.year);
  return {
    history,
    filed_total: history.reduce((n, y) => n + y.filed, 0),
    settled_or_decreased_total: history.reduce((n, y) => n + y.settled_or_decreased, 0),
  };
}

const ADDRESS_CHUNK = 40;

/** Review Board complaints for the building's unit addresses. Throws CityDataError on API failure. */
export async function fetchBuildingAppeals(
  unitAddresses: string[],
  opts: SocrataOptions = {}
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
    ...summarizeComplaints(results.flat(), new Set(addrs)),
    source_url: datasetPageUrl(CALGARY_DATASETS.reviewBoard),
  };
}

/** Median unit value × the 2026 Calgary residential rate, one tax year. */
export function annualTax(value: number): number {
  return value * CALGARY_RES_TAX_RATE_2026;
}
