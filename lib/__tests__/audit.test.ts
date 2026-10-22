import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAuditRows, auditSummary } from "../audit.ts";
import type {
  VerifiedAnalysis,
  VerifiedEvidence,
  VerifiedFlag,
} from "../report-schema.ts";

function ev(over: Partial<VerifiedEvidence>): VerifiedEvidence {
  return {
    file_id: "file-0",
    page: 1,
    document_name: "doc.pdf",
    quote: "verbatim quote",
    verified: true,
    matched_page: 1,
    match_type: "exact_page",
    ocr: false,
    ...over,
  };
}

function flag(over: Partial<VerifiedFlag>): VerifiedFlag {
  return {
    flag_type: "other",
    severity: "warning",
    title: "A flag",
    explanation: "Because.",
    evidence: [ev({})],
    money_exposure: null,
    downgraded: false,
    ...over,
  };
}

function analysis(flags: VerifiedFlag[]): VerifiedAnalysis {
  return {
    building: {
      name: null,
      corp_number: null,
      address: null,
      units: null,
      year_built: null,
      monthly_contribution_avg_cad: null,
    },
    structured_facts: {
      doc_date: null,
      reserve_balance_cad: null,
      reserve_recommended_cad: null,
      contribution_monthly_cad: null,
      insurance_deductible_cad: null,
      special_assessments: [],
      litigation: [],
      rental_rules: null,
      rental_rules_evidence: null,
      fee_change_pct: null,
    },
    flags,
    money_exposure_total_cad: null,
    money_exposure_basis: "",
    questions_for_realtor_lawyer: [],
    summary: "",
    verification: { verified_claims: 0, total_claims: 0 },
  };
}

describe("buildAuditRows", () => {
  it("flattens every flag's evidence with its verification outcome", () => {
    const rows = buildAuditRows(
      analysis([
        flag({
          title: "Assessment",
          evidence: [
            ev({ page: 3, matched_page: 3 }),
            ev({ page: 1, matched_page: 5, match_type: "exact_file", document_name: "b.pdf" }),
          ],
        }),
        flag({
          title: "Lawsuit",
          downgraded: true,
          evidence: [
            ev({ verified: false, matched_page: null, match_type: "none" }),
          ],
        }),
      ])
    );
    assert.equal(rows.length, 3);
    assert.equal(rows[0].flagTitle, "Assessment");
    assert.equal(rows[1].matchedPage, 5);
    assert.equal(rows[1].matchType, "exact_file");
    assert.equal(rows[2].verified, false);
    assert.equal(rows[2].downgraded, true);
  });

  it("prefers the redacted display quote when present", () => {
    const rows = buildAuditRows(
      analysis([flag({ evidence: [ev({ quote: "raw [name]", quote_display: "redacted" })] })])
    );
    assert.equal(rows[0].quote, "redacted");
  });

  it("includes structured-facts claims so the audit total matches the headline count", () => {
    const a = analysis([flag({})]);
    a.structured_facts.special_assessments = [
      {
        amount_per_unit_cad: 8500,
        total_cad: 714000,
        purpose: "parkade membrane",
        status: "levied",
        evidence: { ...ev({}), quote: "assessment quote" },
      },
    ];
    a.structured_facts.rental_rules_evidence = { ...ev({}), quote: "rental quote" };
    const rows = buildAuditRows(a);
    assert.equal(rows.length, 3);
    assert.equal(rows[1].flagTitle, "Special assessment — parkade membrane");
    assert.equal(rows[1].severity, "fact");
    assert.equal(rows[2].flagTitle, "Rental rules");
  });
});

describe("auditSummary", () => {
  it("counts outcomes by match type, OCR, and failure", () => {
    const rows = buildAuditRows(
      analysis([
        flag({
          evidence: [
            ev({}),
            ev({ match_type: "exact_file", matched_page: 2 }),
            ev({ match_type: "fuzzy", ocr: true }),
            ev({ verified: false, matched_page: null, match_type: "none" }),
          ],
        }),
      ])
    );
    const s = auditSummary(rows);
    assert.deepEqual(s, {
      total: 4,
      verified: 3,
      unverified: 1,
      ocr: 1,
      exactPage: 1,
      exactFile: 1,
      fuzzy: 1,
    });
  });
});
