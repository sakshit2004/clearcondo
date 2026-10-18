/**
 * Eval harness logic (pure, no IO): score a produced analysis against a
 * hand-labeled set of expected flags.
 *
 * Matching rule (documented here and in the README):
 *   - An expected flag matches a produced flag when its title (or every
 *     entry in title_keywords) appears in the produced flag's title, after
 *     the same normalization (lowercase, non-alphanumerics -> space).
 *   - Each produced flag is matched to at most one expected flag; when
 *     several candidates fit, the one with the most keyword coverage wins
 *     (greedy). Ties break toward the earlier produced flag.
 *   - "id" matching: expected flags carry a stable id for reporting only;
 *     produced flags have no ids, so matching is always by title content.
 *
 * Quote verification reuses lib/verify.ts (verifyQuote) against freshly
 * extracted page text — never the `verified` flags stamped on a stored
 * report. A quote the model cites that does not match the source is
 * counted as FABRICATED, which is a hard eval failure: unverified quotes
 * are the one thing this product must never show.
 */

import { normalizeForMatch, verifyQuote } from "./verify.ts";
import type { PageText } from "./extract.ts";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

/** One hand-labeled expectation (from eval/<stack>/expected.json). */
export interface ExpectedFlag {
  /** Stable id for reporting, e.g. "special-assessment-parkade". */
  id: string;
  severity: string;
  /** All keywords must appear in the produced flag's title (normalized). */
  title_keywords: string[];
  /**
   * Optional exact title the produced flag must contain (normalized).
   * When present it replaces title_keywords for the match.
   */
  title?: string;
  /**
   * Optional dollar floor. Compared against the produced flag's headline
   * money figure: money_exposure.amount_cad ?? money_exposure.per_unit_cad.
   */
  min_amount_cad?: number;
  /** Canonical quote the human labeler asserts must exist in source_doc. */
  evidence_quote: string;
  /** Filename (as in docs_dir) the canonical quote must come from. */
  source_doc: string;
}

/** A flag from the analysis under test, reduced to what eval needs. */
export interface EvalFlag {
  severity: string;
  title: string;
  evidence: EvalEvidence[];
  money_exposure: {
    amount_cad?: number | null;
    per_unit_cad?: number | null;
  } | null;
}

/** One evidence quote from the analysis under test. */
export interface EvalEvidence {
  quote: string;
  page?: number | null;
  document_name: string;
  file_id?: string;
}

/** Extracted page text of one source document. */
export interface EvalDoc {
  fileName: string;
  pages: PageText[];
}

export interface FlagMatch {
  expected: ExpectedFlag;
  found: boolean;
  matchedIndex: number | null;
  matchedTitle: string | null;
  severityMatch: boolean | null;
  amountOk: boolean | null;
  /** Every evidence quote on the matched flag re-verified against source. */
  quotesVerified: boolean | null;
  /** The labeler's canonical quote itself verifies against source_doc. */
  labelQuoteOk: boolean;
}

export interface QuoteCheck {
  quote: string;
  document_name: string;
  verified: boolean;
}

export interface EvalMetrics {
  expectedCount: number;
  matchedCount: number;
  recall: number;
  totalQuotes: number;
  verifiedQuotes: number;
  fabricatedQuotes: number;
  pctVerified: number;
}

/* ------------------------------------------------------------------ */
/* Matching                                                             */
/* ------------------------------------------------------------------ */

function titleNeedles(expected: ExpectedFlag): string[] {
  if (expected.title) return [normalizeForMatch(expected.title)];
  return expected.title_keywords.map(normalizeForMatch).filter(Boolean);
}

/**
 * Score how well a produced title matches an expected flag.
 * Returns the number of needles present, or -1 when it does not match
 * (any needle missing).
 */
export function matchScore(
  expected: ExpectedFlag,
  producedTitle: string
): number {
  const needles = titleNeedles(expected);
  if (needles.length === 0) return -1;
  const hay = normalizeForMatch(producedTitle);
  let hits = 0;
  for (const n of needles) {
    if (!hay.includes(n)) return -1;
    hits += 1;
  }
  return hits;
}

function headlineAmount(flag: EvalFlag): number | null {
  const m = flag.money_exposure;
  if (!m) return null;
  if (m.amount_cad != null) return m.amount_cad;
  if (m.per_unit_cad != null) return m.per_unit_cad;
  return null;
}

/**
 * Greedily match each expected flag to the best-scoring produced flag.
 * Produced flags are consumed once matched.
 */
export function matchExpectedFlags(
  expected: ExpectedFlag[],
  produced: EvalFlag[]
): { expected: ExpectedFlag; matchedIndex: number | null; score: number }[] {
  const taken = new Set<number>();
  return expected.map((e) => {
    let best = -1;
    let bestIdx: number | null = null;
    produced.forEach((p, i) => {
      if (taken.has(i)) return;
      const s = matchScore(e, p.title);
      if (s > best) {
        best = s;
        bestIdx = i;
      }
    });
    if (bestIdx != null) taken.add(bestIdx);
    return { expected: e, matchedIndex: bestIdx, score: best };
  });
}

/* ------------------------------------------------------------------ */
/* Re-verification                                                      */
/* ------------------------------------------------------------------ */

/**
 * Re-verify evidence quotes against freshly extracted page text.
 * Lookup is by document_name (the filename), which is stable across
 * runs — file_ids are run-scoped and not trusted here.
 */
export function reverifyQuotes(
  evidences: EvalEvidence[],
  docs: EvalDoc[]
): QuoteCheck[] {
  const byName = new Map(docs.map((d) => [d.fileName, d]));
  return evidences.map((e) => {
    const doc = byName.get(e.document_name);
    if (!doc) return { quote: e.quote, document_name: e.document_name, verified: false };
    const v = verifyQuote(e.quote, doc.pages, e.page ?? null);
    return { quote: e.quote, document_name: e.document_name, verified: v.verified };
  });
}

/* ------------------------------------------------------------------ */
/* Metrics                                                              */
/* ------------------------------------------------------------------ */

/**
 * Compute the three headline metrics:
 *   recall        = expected flags matched / expected flags
 *   fabricated    = evidence quotes that do NOT verify (hard fail if > 0)
 *   pctVerified   = verified quotes / total quotes in the analysis
 */
export function computeMetrics(
  expected: ExpectedFlag[],
  matches: FlagMatch[],
  quoteChecks: QuoteCheck[]
): EvalMetrics {
  const matchedCount = matches.filter((m) => m.found).length;
  const totalQuotes = quoteChecks.length;
  const verifiedQuotes = quoteChecks.filter((q) => q.verified).length;
  return {
    expectedCount: expected.length,
    matchedCount,
    recall: expected.length === 0 ? 1 : matchedCount / expected.length,
    totalQuotes,
    verifiedQuotes,
    fabricatedQuotes: totalQuotes - verifiedQuotes,
    pctVerified: totalQuotes === 0 ? 1 : verifiedQuotes / totalQuotes,
  };
}

/** Recall floor; fabricated quotes are always a hard fail. */
export function minRecall(): number {
  const raw = process.env.EVAL_MIN_RECALL;
  const n = raw == null || raw === "" ? NaN : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) return 0.8;
  return n;
}

/** True when the eval run passes both gates. */
export function passesEval(metrics: EvalMetrics): boolean {
  return metrics.recall >= minRecall() && metrics.fabricatedQuotes === 0;
}
