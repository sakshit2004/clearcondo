/**
 * The owner side: pricing, the optional savings estimate, and the
 * "get my savings estimate" request owners send us.
 */
import { z } from "zod";
import { CALGARY_RES_TAX_RATE_2026 } from "./calgary/appeals.ts";

/** Public pricing for the property tax service. */
export const OWNER_PRICING = {
  /** Share of the tax actually saved; nothing if the assessment doesn't come down. */
  feeShare: 0.3,
  /** Per complaint we file, CAD: charged when we file, with the owner's go-ahead, win or lose. */
  filingFee: 20,
  /** Free while in beta. */
  freeDuringBeta: true,
} as const;

/**
 * The cut used for the "if your assessment came down" estimate. Private:
 * it comes from the environment only (OWNER_SAVINGS_CUT, e.g. 0.05 for 5%)
 * and is never committed. Null hides the estimate.
 */
export function ownerSavingsCut(): number | null {
  const v = Number(process.env.OWNER_SAVINGS_CUT);
  return Number.isFinite(v) && v > 0 && v <= 0.5 ? v : null;
}

/** Tax saved in one year if a value came down by `cut`, at the 2026 Calgary residential rate. */
export function annualSaving(value: number, cut: number): number {
  return value * cut * CALGARY_RES_TAX_RATE_2026;
}

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const optNumber = (max: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === "") return undefined;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > max) {
        ctx.addIssue({ code: "custom", message: "Out of range" });
        return z.NEVER;
      }
      return n;
    });

const optMonth = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) {
      ctx.addIssue({ code: "custom", message: "Use a month, e.g. 2025-06." });
      return z.NEVER;
    }
    return v;
  });

const ComparableSchema = z.object({
  price: optNumber(20_000_000),
  sqft: optNumber(20_000),
  date: optMonth,
});

/**
 * What an owner sends for a savings estimate. Only contact details and the
 * building are required; the rest are the facts open data can't see, which
 * make an estimate possible.
 */
export const OwnerRequestSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.string().trim().email("Please enter a valid email.").max(200),
  phone: optText(40),
  plan: z.string().trim().regex(/^[0-9A-Z]{5,10}$/, "Missing building."),
  address: optText(160),
  unit: optText(20),
  unit_size_sqft: optNumber(20000),
  bedrooms: optNumber(20),
  bathrooms: optNumber(20),
  parking: optText(120),
  storage: optText(120),
  renovations: optText(1000),
  condition_issues: optText(1000),
  past_complaint: optText(200),
  notes: optText(2000),
  // Evidence for the instant estimate (lib/owner-estimate.ts).
  purchase_price: optNumber(20_000_000),
  purchase_date: optMonth,
  appraisal_value: optNumber(20_000_000),
  appraisal_date: optMonth,
  comparables: z.array(ComparableSchema).max(5).optional(),
  /** The City's value shown to the owner; the estimate is set against it. */
  assessed_value: optNumber(50_000_000),
  consent: z.literal(true, { message: "Please confirm we can contact you." }),
});

export type OwnerRequestInput = z.input<typeof OwnerRequestSchema>;
export type OwnerRequest = z.output<typeof OwnerRequestSchema>;
