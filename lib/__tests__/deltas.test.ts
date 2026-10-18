import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeDeltas } from "../deltas.ts";
import type {
  VerifiedFactEvidence,
  VerifiedStructuredFacts,
} from "../report-schema.ts";

function fe(quote = "verbatim quote here"): VerifiedFactEvidence {
  return {
    file_id: "file-0",
    page: 1,
    document_name: "doc.pdf",
    quote,
    verified: true,
    matched_page: 1,
    match_type: "exact_page",
    ocr: false,
  };
}

function facts(
  over: Partial<VerifiedStructuredFacts>
): VerifiedStructuredFacts {
  return {
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
    ...over,
  };
}

describe("computeDeltas", () => {
  it("returns [] with no previous snapshot", () => {
    assert.deepEqual(computeDeltas(null, facts({})), []);
  });

  it("detects a new special assessment with evidence", () => {
    const d = computeDeltas(
      facts({}),
      facts({
        special_assessments: [
          {
            amount_per_unit_cad: 8500,
            total_cad: 714000,
            purpose: "parkade membrane",
            status: "levied",
            evidence: fe("special assessment of $8,500 per unit"),
          },
        ],
      })
    );
    assert.equal(d.length, 1);
    assert.equal(d[0].kind, "new");
    assert.match(d[0].label, /special assessment/i);
    assert.ok(d[0].curr?.verified);
  });

  it("detects deductible change $25k -> $100k", () => {
    const d = computeDeltas(
      facts({ insurance_deductible_cad: 25000 }),
      facts({ insurance_deductible_cad: 100000 })
    );
    assert.equal(d.length, 1);
    assert.equal(d[0].kind, "changed");
    assert.match(d[0].detail, /\$25,000/);
    assert.match(d[0].detail, /\$100,000/);
  });

  it("detects new litigation and resolved litigation", () => {
    const d = computeDeltas(
      facts({
        litigation: [
          { subject: "old fence dispute", units_affected: null, status: "settled", evidence: fe() },
        ],
      }),
      facts({
        litigation: [
          { subject: "window water ingress", units_affected: "units 304, 305", status: "in mediation", evidence: fe() },
        ],
      })
    );
    const kinds = d.map((x) => x.kind).sort();
    assert.deepEqual(kinds, ["new", "resolved"]);
  });

  it("detects reserve slipping below the 70% bar", () => {
    const d = computeDeltas(
      facts({ reserve_balance_cad: 800000, reserve_recommended_cad: 1000000 }),
      facts({ reserve_balance_cad: 610000, reserve_recommended_cad: 1000000 })
    );
    const status = d.find((x) => x.label === "Reserve funding status");
    assert.ok(status, "expected a funding-status delta");
    assert.match(status.detail, /below the 70% bar/);
  });

  it("ignores small contribution changes (<5%)", () => {
    const d = computeDeltas(
      facts({ contribution_monthly_cad: 500 }),
      facts({ contribution_monthly_cad: 520 })
    );
    assert.equal(d.filter((x) => x.label === "Monthly contributions").length, 0);
  });

  it("flags contribution changes >= 5%", () => {
    const d = computeDeltas(
      facts({ contribution_monthly_cad: 500 }),
      facts({ contribution_monthly_cad: 560 })
    );
    assert.equal(d.filter((x) => x.label === "Monthly contributions").length, 1);
  });

  it("never cites unverified evidence in deltas", () => {
    const bad = fe("unverified quote");
    bad.verified = false;
    const d = computeDeltas(
      facts({}),
      facts({
        special_assessments: [
          { amount_per_unit_cad: 1000, total_cad: null, purpose: "roof", status: "proposed", evidence: bad },
        ],
      })
    );
    assert.equal(d.length, 1);
    assert.equal(d[0].curr, null);
  });
});
