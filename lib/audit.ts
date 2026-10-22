import type {
  MatchType,
  VerifiedAnalysis,
  VerifiedFactEvidence,
} from "./report-schema";

/**
 * Verification audit trail — the flat, per-claim record behind a report's
 * "X of Y claims verified" headline. Every evidence quote the pipeline
 * checked, with what it was checked against and how the check resolved.
 * This is the guarantee made inspectable: judges (and buyers) can watch
 * exactly which claims held up and which were caught.
 */

export interface AuditRow {
  flagTitle: string;
  severity: string;
  downgraded: boolean;
  quote: string;
  documentName: string;
  claimedPage: number;
  matchedPage: number | null;
  matchType: MatchType;
  verified: boolean;
  ocr: boolean;
}

export interface AuditSummary {
  total: number;
  verified: number;
  unverified: number;
  ocr: number;
  exactPage: number;
  exactFile: number;
  fuzzy: number;
}

export function buildAuditRows(analysis: VerifiedAnalysis): AuditRow[] {
  const rows: AuditRow[] = [];
  for (const flag of analysis.flags) {
    for (const e of flag.evidence) {
      rows.push({
        flagTitle: flag.title,
        severity: flag.severity,
        downgraded: flag.downgraded,
        quote: e.quote_display ?? e.quote,
        documentName: e.document_name,
        claimedPage: e.page,
        matchedPage: e.matched_page,
        matchType: e.match_type,
        verified: e.verified,
        ocr: e.ocr,
      });
    }
  }
  // The headline count also covers the structured-facts claims (the
  // building-memory facts), so the audit must too — otherwise the table
  // and the "X of Y verified" line disagree.
  const factRow = (label: string, e: VerifiedFactEvidence): AuditRow => ({
    flagTitle: label,
    severity: "fact",
    downgraded: false,
    quote: e.quote_display ?? e.quote,
    documentName: e.document_name,
    claimedPage: e.page,
    matchedPage: e.matched_page,
    matchType: e.match_type,
    verified: e.verified,
    ocr: e.ocr,
  });
  const facts = analysis.structured_facts;
  for (const a of facts.special_assessments) {
    rows.push(factRow(`Special assessment — ${a.purpose}`, a.evidence));
  }
  for (const l of facts.litigation) {
    rows.push(factRow(`Litigation — ${l.subject}`, l.evidence));
  }
  if (facts.rental_rules_evidence) {
    rows.push(factRow("Rental rules", facts.rental_rules_evidence));
  }
  return rows;
}

export function auditSummary(rows: AuditRow[]): AuditSummary {
  return {
    total: rows.length,
    verified: rows.filter((r) => r.verified).length,
    unverified: rows.filter((r) => !r.verified).length,
    ocr: rows.filter((r) => r.verified && r.ocr).length,
    exactPage: rows.filter((r) => r.matchType === "exact_page").length,
    exactFile: rows.filter((r) => r.matchType === "exact_file").length,
    fuzzy: rows.filter((r) => r.matchType === "fuzzy").length,
  };
}

export const MATCH_LABELS: Record<MatchType, string> = {
  exact_page: "Exact page",
  exact_file: "Same file",
  fuzzy: "Fuzzy match",
  none: "No match",
};
