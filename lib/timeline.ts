import type { StructuredFacts } from "./report-schema";

/**
 * Building risk timeline — one point per review of the same building.
 * The longitudinal view the memory makes possible: reserve health,
 * buyer exposure, and insurance deductible tracked across reviews
 * instead of re-derived from scratch each time.
 */

export interface TimelinePoint {
  /** Display label, e.g. "Sep 2024" (from the documents' date). */
  label: string;
  /** ISO-ish date used only for ordering ("2024-09", "2026-10-15", ...). */
  sortKey: string;
  fundedPct: number | null;
  reserveBalanceCad: number | null;
  exposureCad: number | null;
  deductibleCad: number | null;
}

/** Reserve funded % = balance / study recommendation. Null when either is missing or the recommendation is 0. */
export function fundedPct(
  facts: Pick<StructuredFacts, "reserve_balance_cad" | "reserve_recommended_cad">
): number | null {
  const { reserve_balance_cad: bal, reserve_recommended_cad: rec } = facts;
  if (bal == null || rec == null || rec <= 0) return null;
  return (bal / rec) * 100;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2024-09" / "2026-10-15" → "Sep 2024" / "Oct 2026". Falls back to the raw string. */
export function monthYearLabel(docDate: string | null, fallback: string): string {
  if (!docDate) return fallback;
  const m = /^(\d{4})-(\d{2})/.exec(docDate);
  if (!m) return fallback;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : fallback;
}

export function pointFromFacts(input: {
  facts: Pick<
    StructuredFacts,
    "reserve_balance_cad" | "reserve_recommended_cad" | "insurance_deductible_cad"
  >;
  docDate: string | null;
  exposureCad: number | null;
  fallbackLabel: string;
  fallbackSortKey: string;
}): TimelinePoint {
  return {
    label: monthYearLabel(input.docDate, input.fallbackLabel),
    sortKey: input.docDate ?? input.fallbackSortKey,
    fundedPct: fundedPct(input.facts),
    reserveBalanceCad: input.facts.reserve_balance_cad,
    exposureCad: input.exposureCad,
    deductibleCad: input.facts.insurance_deductible_cad,
  };
}

/** Oldest → newest. Stable for equal keys. */
export function sortPoints(points: TimelinePoint[]): TimelinePoint[] {
  return [...points].sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
}

/** Change in funded % vs the previous point, in percentage points. Null when either side is missing. */
export function fundedDelta(points: TimelinePoint[], index: number): number | null {
  if (index <= 0) return null;
  const cur = points[index].fundedPct;
  const prev = points[index - 1].fundedPct;
  if (cur == null || prev == null) return null;
  return cur - prev;
}
