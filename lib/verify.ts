/**
 * Evidence verification.
 *
 * Every quote Claude cites is checked against the stored page text before it
 * is shown to a buyer or persisted. Matching pipeline for each quote:
 *   1. normalized exact match on the cited page      -> "exact_page"
 *   2. normalized exact match anywhere in the file   -> "exact_file"
 *   3. fuzzy token match (>= 0.9 similarity)         -> "fuzzy"
 *   4. otherwise                                     -> unverified
 *
 * Normalization handles: case, whitespace runs, smart quotes, em/en dashes,
 * hyphenated line breaks (e.g. "enve-\nlope" -> "envelope"), non-breaking
 * spaces. It deliberately does NOT stem or reorder words: a quote that
 * rewords the source is a fabrication and must fail.
 */

import type { PageText } from "./extract";
import type {
  Analysis,
  FactEvidence,
  Flag,
  StructuredFacts,
  VerifiedAnalysis,
  VerifiedEvidence,
  VerifiedFactEvidence,
  VerifiedFlag,
  VerifiedStructuredFacts,
} from "./report-schema";

export type MatchType = "exact_page" | "exact_file" | "fuzzy" | "none";

export interface QuoteVerification {
  verified: boolean;
  matchedPage: number | null;
  matchType: MatchType;
}

/** Minimum token-set similarity for a fuzzy match. */
export const FUZZY_THRESHOLD = 0.9;

export function normalizeForMatch(s: string): string {
  return (
    s
      .toLowerCase()
      // smart single quotes -> straight
      .replace(/[‘’‚‛]/g, "'")
      // smart double quotes -> straight
      .replace(/[“”„‟]/g, '"')
      // em/en dashes -> hyphen
      .replace(/[—–]/g, "-")
      // non-breaking / odd spaces -> normal space
      .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, " ")
      // hyphenated line breaks: "enve- lope" / "enve-\nlope" -> "envelope"
      .replace(/(\p{L})-\s+(\p{L})/gu, "$1$2")
      // collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

function tokens(s: string): string[] {
  return normalizeForMatch(s).split(" ").filter(Boolean);
}

/** Jaccard similarity over token multisets (handles repeated words). */
function tokenSimilarity(a: string[], b: string[]): number {
  const ca = new Map<string, number>();
  const cb = new Map<string, number>();
  for (const t of a) ca.set(t, (ca.get(t) ?? 0) + 1);
  for (const t of b) cb.set(t, (cb.get(t) ?? 0) + 1);
  let inter = 0;
  let union = 0;
  for (const [t, na] of ca) {
    const nb = cb.get(t) ?? 0;
    inter += Math.min(na, nb);
    union += Math.max(na, nb);
  }
  for (const [t, nb] of cb) {
    if (!ca.has(t)) union += nb;
  }
  return union === 0 ? 0 : inter / union;
}

/**
 * Verify a single evidence quote against a file's pages.
 * `citedPage` is the 1-based page Claude attributed the quote to (may be wrong).
 */
export function verifyQuote(
  quote: string,
  pages: PageText[],
  citedPage?: number | null
): QuoteVerification {
  const nq = normalizeForMatch(quote);
  if (!nq || nq.length < 10) {
    return { verified: false, matchedPage: null, matchType: "none" };
  }

  // 1. Exact match on the cited page.
  if (citedPage != null) {
    const pg = pages.find((p) => p.page === citedPage);
    if (pg && normalizeForMatch(pg.text).includes(nq)) {
      return { verified: true, matchedPage: citedPage, matchType: "exact_page" };
    }
  }

  // 2. Exact match anywhere in the file (page attribution may be off by one).
  for (const pg of pages) {
    if (normalizeForMatch(pg.text).includes(nq)) {
      return { verified: true, matchedPage: pg.page, matchType: "exact_file" };
    }
  }

  // 3. Fuzzy match: sliding window over each page's tokens.
  const qt = tokens(nq);
  if (qt.length < 4) {
    return { verified: false, matchedPage: null, matchType: "none" };
  }
  const qSet = new Set(qt);
  let best = { sim: 0, page: null as number | null };

  for (const pg of pages) {
    const pt = tokens(pg.text);
    if (pt.length === 0) continue;
    // Prefilter: need at least half the quote's distinct tokens present.
    const ptSet = new Set(pt);
    let present = 0;
    for (const t of qSet) if (ptSet.has(t)) present++;
    if (present < qSet.size / 2) continue;

    const w = qt.length;
    for (let i = 0; i + w <= pt.length; i++) {
      const sim = tokenSimilarity(qt, pt.slice(i, i + w));
      if (sim > best.sim) best = { sim, page: pg.page };
      if (best.sim >= 1) break;
    }
    if (best.sim >= 1) break;
  }

  if (best.sim >= FUZZY_THRESHOLD && best.page != null) {
    return { verified: true, matchedPage: best.page, matchType: "fuzzy" };
  }
  return { verified: false, matchedPage: null, matchType: "none" };
}

export interface VerifiableDoc {
  fileId: string;
  fileName: string;
  pages: PageText[];
  /** True when page text came from OCR transcription (lower confidence). */
  ocr: boolean;
}

/**
 * Verify one structured-fact evidence item. Unverified fact evidence does
 * not downgrade flags, but the UI marks it and deltas never cite it.
 */
function verifyFactEvidence(
  e: FactEvidence,
  docs: VerifiableDoc[]
): VerifiedFactEvidence {
  const [out] = verifyEvidences([e], docs);
  const doc = docs.find(
    (d) => d.fileId === e.file_id || d.fileName === e.document_name
  );
  return {
    file_id: e.file_id,
    page: e.page ?? 0,
    document_name: e.document_name,
    quote: e.quote,
    // Display text is the redacted version when the redaction step ran;
    // verification above always ran against the ORIGINAL quote.
    quote_display: e.quote_display ?? e.quote,
    verified: out.verified,
    matched_page: out.matchedPage,
    match_type: out.matchType,
    ocr: doc?.ocr ?? false,
  };
}

/** Verify every evidence item inside the structured facts snapshot. */
export function verifyStructuredFacts(
  facts: StructuredFacts,
  docs: VerifiableDoc[]
): { snapshot: VerifiedStructuredFacts; verified: number; total: number } {
  let verified = 0;
  let total = 0;
  const ve = (e: FactEvidence): VerifiedFactEvidence => {
    total += 1;
    const out = verifyFactEvidence(e, docs);
    if (out.verified) verified += 1;
    return out;
  };
  return {
    snapshot: {
      doc_date: facts.doc_date,
      reserve_balance_cad: facts.reserve_balance_cad,
      reserve_recommended_cad: facts.reserve_recommended_cad,
      contribution_monthly_cad: facts.contribution_monthly_cad,
      insurance_deductible_cad: facts.insurance_deductible_cad,
      special_assessments: facts.special_assessments.map((s) => ({
        ...s,
        evidence: ve(s.evidence),
      })),
      litigation: facts.litigation.map((l) => ({
        ...l,
        evidence: ve(l.evidence),
      })),
      rental_rules: facts.rental_rules,
      rental_rules_evidence: facts.rental_rules_evidence
        ? ve(facts.rental_rules_evidence)
        : null,
      fee_change_pct: facts.fee_change_pct,
    },
    verified,
    total,
  };
}

/**
 * Verify a full Claude analysis against the extracted page text.
 *
 * Enforcement rules (non-negotiable):
 * - A flag with ANY unverified evidence is downgraded to at most "warning"
 *   and loses its money-exposure figures (they can only come from verified
 *   evidence).
 * - money_exposure_total_cad is recomputed from verified flags only.
 */
export function verifyAnalysis(
  analysis: Analysis,
  docs: VerifiableDoc[]
): VerifiedAnalysis {
  let verifiedClaims = 0;
  let totalClaims = 0;

  const flags: VerifiedFlag[] = analysis.flags.map((flag: Flag) => {
    const evidence: VerifiedEvidence[] = verifyEvidences(
      flag.evidence,
      docs
    ).map((e) => {
      totalClaims += 1;
      if (e.verified) verifiedClaims += 1;
      const doc = docs.find(
        (d) => d.fileId === e.file_id || d.fileName === e.document_name
      );
      return {
        file_id: e.file_id,
        page: e.page ?? 0,
        document_name: e.document_name,
        quote: e.quote,
        // Display text is the redacted version when the redaction step ran;
        // verification above always ran against the ORIGINAL quote.
        quote_display: e.quote_display ?? e.quote,
        verified: e.verified,
        matched_page: e.matchedPage,
        match_type: e.matchType,
        ocr: doc?.ocr ?? false,
      };
    });

    const allVerified = evidence.every((e) => e.verified);
    const downgraded = !allVerified;
    return {
      flag_type: flag.flag_type,
      severity: downgraded
        ? flag.severity === "info"
          ? "info"
          : "warning"
        : flag.severity,
      title: flag.title,
      explanation: flag.explanation,
      evidence,
      // Money figures only survive on fully verified evidence.
      money_exposure: allVerified ? flag.money_exposure : null,
      downgraded,
    };
  });

  // Recompute the buyer total from verified flags only.
  const verifiedPerUnit = flags
    .filter((f) => f.evidence.every((e) => e.verified))
    .map((f) => f.money_exposure?.per_unit_cad ?? null)
    .filter((n): n is number => n != null);
  const money_exposure_total_cad =
    verifiedPerUnit.length > 0
      ? verifiedPerUnit.reduce((a, b) => a + b, 0)
      : null;

  const factsResult = verifyStructuredFacts(analysis.structured_facts, docs);

  return {
    building: analysis.building,
    structured_facts: factsResult.snapshot,
    flags,
    money_exposure_total_cad,
    money_exposure_basis:
      verifiedPerUnit.length > 0
        ? `${analysis.money_exposure_basis} (verified claims only)`
        : analysis.money_exposure_basis,
    questions_for_realtor_lawyer: analysis.questions_for_realtor_lawyer,
    summary: analysis.summary,
    verification: {
      verified_claims: verifiedClaims + factsResult.verified,
      total_claims: totalClaims + factsResult.total,
    },
  };
}

export interface VerifiableEvidence {
  file_id: string;
  page?: number | null;
  document_name: string;
  quote: string;
  /** Set by the redaction step before verification; carried through untouched. */
  quote_display?: string;
}

/**
 * Verify every evidence item of every flag against the extracted page text.
 * Returns per-evidence verification records in the same order.
 */
export function verifyEvidences<T extends VerifiableEvidence>(
  evidences: T[],
  docs: VerifiableDoc[]
): (T & QuoteVerification)[] {
  const byId = new Map(docs.map((d) => [d.fileId, d]));
  return evidences.map((e) => {
    // Fallback: match by filename when file_id is missing/unknown.
    const doc =
      byId.get(e.file_id) ??
      docs.find(
        (d) =>
          (d as unknown as { fileName?: string }).fileName === e.document_name
      );
    if (!doc) {
      return { ...e, verified: false, matchedPage: null, matchType: "none" as MatchType };
    }
    const v = verifyQuote(e.quote, doc.pages, e.page ?? null);
    return { ...e, ...v };
  });
}
