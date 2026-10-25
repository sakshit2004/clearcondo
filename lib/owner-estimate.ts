/**
 * The instant savings estimate an owner sees on the request form. A plain,
 * public calculation from the evidence the owner enters (a purchase, an
 * appraisal, sales of similar units), set against the City's value. No
 * model and nothing private: every step is shown on the page.
 *
 * Alberta assesses at market value on July 1 of the year before the tax
 * year, so 2026 values reflect July 1, 2025. Evidence must be dated near
 * that day; it isn't time-adjusted, and condition isn't priced in.
 */
import { CALGARY_RES_TAX_RATE_2026 } from "./calgary/appeals.ts";
import { OWNER_PRICING } from "./owner.ts";

/** Valuation date for the 2026 Calgary roll, as "YYYY-MM". */
export const VALUATION_MONTH = "2025-07";
/** Evidence window around the valuation date, in months. */
export const WINDOW_BEFORE = 24;
export const WINDOW_AFTER = 6;
export const MAX_COMPARABLES = 5;

export interface Comparable {
  price?: number;
  sqft?: number;
  /** "YYYY-MM"; optional for comparables. */
  date?: string;
}

export interface EstimateInput {
  assessed_value: number;
  unit_size_sqft?: number;
  purchase_price?: number;
  purchase_date?: string;
  appraisal_value?: number;
  appraisal_date?: string;
  comparables?: Comparable[];
}

export type EvidenceSource = "purchase" | "appraisal" | "comparables";

export interface Indicator {
  source: EvidenceSource;
  value: number;
  /** How the value was reached, for the page. */
  detail: string;
}

export interface Skipped {
  source: EvidenceSource;
  reason: string;
  /** Some of this evidence was still used. */
  partial?: boolean;
}

export interface OwnerEstimate {
  /** saving: evidence supports a lower value. no_saving: it doesn't. not_enough: no usable evidence. */
  status: "saving" | "no_saving" | "not_enough";
  assessed_value: number;
  indicated_value: number | null;
  indicators: Indicator[];
  skipped: Skipped[];
  /** City value minus indicated value. */
  difference: number | null;
  annual_saving: number | null;
  fee: number | null;
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Months from `a` to `b` ("YYYY-MM"), or null if either is malformed. */
export function monthsBetween(a: string, b: string): number | null {
  const ma = a.match(MONTH);
  const mb = b.match(MONTH);
  if (!ma || !mb) return null;
  return (Number(mb[1]) - Number(ma[1])) * 12 + (Number(mb[2]) - Number(ma[2]));
}

/** Null when the date is usable, otherwise why not. */
export function dateProblem(date: string | undefined, required: boolean): string | null {
  if (!date) return required ? "add the month it happened" : null;
  const m = monthsBetween(VALUATION_MONTH, date);
  if (m == null) return "the date isn't a valid month";
  if (m < -WINDOW_BEFORE) return "too long before the July 2025 valuation date";
  if (m > WINDOW_AFTER) return "too long after the July 2025 valuation date";
  return null;
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const pos = (n: number | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const money = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;

export function estimateSaving(input: EstimateInput): OwnerEstimate {
  const indicators: Indicator[] = [];
  const skipped: Skipped[] = [];

  if (pos(input.purchase_price)) {
    const problem = dateProblem(input.purchase_date, true);
    if (problem) skipped.push({ source: "purchase", reason: problem });
    else indicators.push({ source: "purchase", value: input.purchase_price, detail: `you paid ${money(input.purchase_price)} (${input.purchase_date})` });
  }

  if (pos(input.appraisal_value)) {
    const problem = dateProblem(input.appraisal_date, true);
    if (problem) skipped.push({ source: "appraisal", reason: problem });
    else indicators.push({ source: "appraisal", value: input.appraisal_value, detail: `appraised at ${money(input.appraisal_value)} (${input.appraisal_date})` });
  }

  const comps = (input.comparables ?? []).slice(0, MAX_COMPARABLES).filter((c) => pos(c.price) || pos(c.sqft));
  if (comps.length > 0) {
    const usable = comps.filter((c) => pos(c.price) && pos(c.sqft) && !dateProblem(c.date, false));
    if (!pos(input.unit_size_sqft)) {
      skipped.push({ source: "comparables", reason: "add your unit's size to use similar sales" });
    } else if (usable.length === 0) {
      skipped.push({ source: "comparables", reason: "each sale needs a price and size, dated near July 2025" });
    } else {
      const ppsf = median(usable.map((c) => c.price! / c.sqft!));
      indicators.push({
        source: "comparables",
        value: Math.round(ppsf * input.unit_size_sqft),
        detail: `median $${ppsf.toFixed(0)}/sq ft from ${usable.length} sale${usable.length === 1 ? "" : "s"} × ${input.unit_size_sqft} sq ft`,
      });
      if (usable.length < comps.length) {
        skipped.push({ source: "comparables", partial: true, reason: `${comps.length - usable.length} sale${comps.length - usable.length === 1 ? "" : "s"} left out (missing price or size, or dated outside the window)` });
      }
    }
  }

  const base = { assessed_value: input.assessed_value, indicators, skipped };
  if (indicators.length === 0) {
    return { ...base, status: "not_enough", indicated_value: null, difference: null, annual_saving: null, fee: null };
  }
  const indicated = Math.round(median(indicators.map((i) => i.value)));
  const difference = input.assessed_value - indicated;
  if (difference <= 0) {
    return { ...base, status: "no_saving", indicated_value: indicated, difference, annual_saving: null, fee: null };
  }
  const saving = difference * CALGARY_RES_TAX_RATE_2026;
  return {
    ...base,
    status: "saving",
    indicated_value: indicated,
    difference,
    annual_saving: Math.round(saving),
    fee: Math.round(saving * OWNER_PRICING.feeShare),
  };
}

/** Yearly tax saved if the assessment came down by `pct` percent (no evidence needed). */
export function savingIfLowered(assessed: number, pct: number) {
  const lowerBy = Math.round(assessed * (pct / 100));
  const saving = Math.round(lowerBy * CALGARY_RES_TAX_RATE_2026);
  return { lowerBy, saving, fee: Math.round(saving * OWNER_PRICING.feeShare) };
}
