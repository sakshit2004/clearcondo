/**
 * Building memory diff: "What changed since the last review".
 *
 * Compares two consecutive structured-fact snapshots for the same building
 * and emits human-readable deltas. Each delta links to verified evidence on
 * both sides where it exists; deltas are never computed from unverified
 * evidence.
 */

import { cad } from "./format.ts";
import type {
  VerifiedFactEvidence,
  VerifiedStructuredFacts,
} from "./report-schema";

export interface DeltaEvidence {
  quote: string;
  document_name: string;
  page: number | null;
  verified: boolean;
  ocr: boolean;
}

export type DeltaKind = "new" | "changed" | "resolved";

export interface Delta {
  kind: DeltaKind;
  label: string;
  detail: string;
  prev: DeltaEvidence | null;
  curr: DeltaEvidence | null;
}

function ev(e: VerifiedFactEvidence | null): DeltaEvidence | null {
  if (!e || !e.verified) return null;
  return {
    quote: e.quote,
    document_name: e.document_name,
    page: e.matched_page ?? e.page,
    verified: true,
    ocr: e.ocr,
  };
}

function pctChange(prev: number, curr: number): number {
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function fmtPct(p: number): string {
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(0)}%`;
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Compute deltas from an older snapshot to a newer one.
 * Returns [] when there is no previous snapshot.
 */
export function computeDeltas(
  prev: VerifiedStructuredFacts | null | undefined,
  curr: VerifiedStructuredFacts
): Delta[] {
  if (!prev) return [];
  const deltas: Delta[] = [];

  // Reserve balance
  if (prev.reserve_balance_cad != null && curr.reserve_balance_cad != null) {
    const p = pctChange(prev.reserve_balance_cad, curr.reserve_balance_cad);
    if (Math.abs(p) >= 10) {
      deltas.push({
        kind: "changed",
        label: "Reserve fund balance",
        detail: `${cad(prev.reserve_balance_cad)} → ${cad(
          curr.reserve_balance_cad
        )} (${fmtPct(p)})`,
        prev: null,
        curr: null,
      });
    }
  } else if (prev.reserve_balance_cad == null && curr.reserve_balance_cad != null) {
    deltas.push({
      kind: "new",
      label: "Reserve fund balance now disclosed",
      detail: `Reserve balance stated as ${cad(curr.reserve_balance_cad)}.`,
      prev: null,
      curr: null,
    });
  }

  // Funded status crossing the 70% "good" bar
  const funded = (s: VerifiedStructuredFacts): number | null =>
    s.reserve_balance_cad != null &&
    s.reserve_recommended_cad != null &&
    s.reserve_recommended_cad > 0
      ? (s.reserve_balance_cad / s.reserve_recommended_cad) * 100
      : null;
  const pf = funded(prev);
  const cf = funded(curr);
  if (pf != null && cf != null) {
    const wasGood = pf >= 70;
    const isGood = cf >= 70;
    if (wasGood !== isGood) {
      deltas.push({
        kind: "changed",
        label: "Reserve funding status",
        detail: isGood
          ? `Recovered to ${cf.toFixed(0)}% of recommended (was ${pf.toFixed(0)}%) — back above the 70% bar.`
          : `Slipped to ${cf.toFixed(0)}% of recommended (was ${pf.toFixed(0)}%) — below the 70% bar.`,
        prev: null,
        curr: null,
      });
    }
  }

  // Monthly contribution
  if (
    prev.contribution_monthly_cad != null &&
    curr.contribution_monthly_cad != null
  ) {
    const p = pctChange(prev.contribution_monthly_cad, curr.contribution_monthly_cad);
    if (Math.abs(p) >= 5) {
      deltas.push({
        kind: "changed",
        label: "Monthly contributions",
        detail: `${cad(prev.contribution_monthly_cad)}/mo → ${cad(
          curr.contribution_monthly_cad
        )}/mo (${fmtPct(p)})`,
        prev: null,
        curr: null,
      });
    }
  }

  // Insurance deductible
  if (
    prev.insurance_deductible_cad != null &&
    curr.insurance_deductible_cad != null &&
    prev.insurance_deductible_cad !== curr.insurance_deductible_cad
  ) {
    deltas.push({
      kind: "changed",
      label: "Insurance deductible",
      detail: `${cad(prev.insurance_deductible_cad)} → ${cad(
        curr.insurance_deductible_cad
      )} per occurrence`,
      prev: null,
      curr: null,
    });
  } else if (
    prev.insurance_deductible_cad == null &&
    curr.insurance_deductible_cad != null
  ) {
    deltas.push({
      kind: "new",
      label: "Insurance deductible disclosed",
      detail: `Deductible stated as ${cad(curr.insurance_deductible_cad)} per occurrence.`,
      prev: null,
      curr: null,
    });
  }

  // Special assessments: matched by purpose so discussed -> proposed -> levied
  // transitions read as updates rather than new+resolved pairs.
  const moneyOf = (s: { amount_per_unit_cad: number | null; total_cad: number | null }) =>
    s.amount_per_unit_cad != null
      ? `${cad(s.amount_per_unit_cad)}/unit`
      : s.total_cad != null
        ? `${cad(s.total_cad)} total`
        : "amount not stated";
  const prevSA = new Map(prev.special_assessments.map((s) => [key(s.purpose), s]));
  for (const s of curr.special_assessments) {
    const k = key(s.purpose);
    const p = prevSA.get(k);
    if (!p) {
      deltas.push({
        kind: s.status === "levied" ? "new" : "changed",
        label:
          s.status === "levied"
            ? "New special assessment"
            : "Special assessment proposed",
        detail: `${moneyOf(s)} for ${s.purpose} — status: ${s.status}.`,
        prev: null,
        curr: ev(s.evidence),
      });
    } else if (p.status !== s.status || p.amount_per_unit_cad !== s.amount_per_unit_cad || p.total_cad !== s.total_cad) {
      deltas.push({
        kind: "changed",
        label: "Special assessment update",
        detail: `${s.purpose}: was ${p.status} (${moneyOf(p)}) → now ${s.status} (${moneyOf(s)}).`,
        prev: ev(p.evidence),
        curr: ev(s.evidence),
      });
    }
  }
  const currSA = new Set(curr.special_assessments.map((s) => key(s.purpose)));
  for (const s of prev.special_assessments) {
    if (!currSA.has(key(s.purpose))) {
      deltas.push({
        kind: "resolved",
        label: "Special assessment no longer mentioned",
        detail: `${s.purpose} (${moneyOf(s)}) appeared in the earlier review but not in these documents.`,
        prev: ev(s.evidence),
        curr: null,
      });
    }
  }

  // Litigation: new mentions, resolved mentions
  const prevLit = new Map(prev.litigation.map((l) => [key(l.subject), l]));
  for (const l of curr.litigation) {
    if (!prevLit.has(key(l.subject))) {
      deltas.push({
        kind: "new",
        label: "New litigation mention",
        detail: `${l.subject}${l.units_affected ? ` (${l.units_affected})` : ""} — ${l.status}.`,
        prev: null,
        curr: ev(l.evidence),
      });
    }
  }
  const currLit = new Set(curr.litigation.map((l) => key(l.subject)));
  for (const l of prev.litigation) {
    if (!currLit.has(key(l.subject))) {
      deltas.push({
        kind: "resolved",
        label: "Litigation no longer mentioned",
        detail: `${l.subject} appeared in the earlier review but not in these documents.`,
        prev: ev(l.evidence),
        curr: null,
      });
    }
  }

  // Rental rules
  if (
    prev.rental_rules != null &&
    curr.rental_rules != null &&
    key(prev.rental_rules) !== key(curr.rental_rules)
  ) {
    deltas.push({
      kind: "changed",
      label: "Rental rules changed",
      detail: `Was: "${prev.rental_rules}" — Now: "${curr.rental_rules}".`,
      prev: ev(prev.rental_rules_evidence),
      curr: ev(curr.rental_rules_evidence),
    });
  } else if (prev.rental_rules == null && curr.rental_rules != null) {
    deltas.push({
      kind: "new",
      label: "Rental rules now stated",
      detail: curr.rental_rules,
      prev: null,
      curr: ev(curr.rental_rules_evidence),
    });
  }

  return deltas;
}
