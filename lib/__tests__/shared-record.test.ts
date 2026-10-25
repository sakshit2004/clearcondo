import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTimelines,
  checkAgainstRecord,
  extractSharedFacts,
  formatAsOf,
  locateFigure,
  recordPromptLines,
  sharedBuildingKey,
  valueKey,
  type SharedFact,
  type SharedFactRow,
  type SourceDoc,
} from "../shared-record.ts";
import type { BuildingFacts, VerifiedStructuredFacts } from "../report-schema";

const building: BuildingFacts = {
  name: "Bow River Lofts",
  corp_number: "0614321",
  address: "500 Sample St SW",
  units: 84,
  year_built: 2006,
  monthly_contribution_avg_cad: null,
};

const ev = (page: number, verified = true) => ({
  file_id: "file-0",
  page,
  document_name: "Reserve study.pdf",
  quote: "q",
  verified,
  matched_page: page,
  match_type: "exact_page" as const,
  ocr: false,
});

const facts = (over: Partial<VerifiedStructuredFacts> = {}): VerifiedStructuredFacts => ({
  doc_date: "2025-03",
  reserve_balance_cad: 412000,
  reserve_recommended_cad: 1000000,
  contribution_monthly_cad: null,
  insurance_deductible_cad: 50000,
  special_assessments: [
    { amount_per_unit_cad: 8500, total_cad: 714000, purpose: "Roof replacement", status: "levied", evidence: ev(4) },
    { amount_per_unit_cad: 1200, total_cad: null, purpose: "Unverified boiler", status: "proposed", evidence: ev(5, false) },
  ],
  litigation: [{ subject: "Water ingress claim against the builder", units_affected: null, status: "in mediation", evidence: ev(7) }],
  rental_rules: null,
  rental_rules_evidence: null,
  fee_change_pct: 4.5,
  ...over,
});

const docs: SourceDoc[] = [
  {
    fileId: "file-0",
    docType: "reserve_fund_study",
    pages: [
      { page: 1, text: "Opening balance as at Dec 31: $412,000.00 in the reserve fund." },
      { page: 2, text: "Recommended balance 1 000 000. Fees rise 4.5% next year." },
      { page: 3, text: "Deductible per occurrence: $50,000" },
    ],
  },
];

const row = (f: Partial<SharedFactRow> & Pick<SharedFactRow, "fact_key" | "as_of">): SharedFactRow => ({
  kind: "money",
  label: f.fact_key,
  value_num: null,
  value_text: null,
  doc_type: null,
  page: null,
  source: "document",
  seen_count: 1,
  first_seen: "2026-01-01T00:00:00Z",
  ...f,
});

describe("sharedBuildingKey", () => {
  it("uses the plan number, so the buyer's corp number meets the owner's City plan", () => {
    assert.equal(sharedBuildingKey({ corp_number: "Condominium Corporation No. 061 4321", name: "x", address: null }), "plan:0614321");
    assert.equal(sharedBuildingKey({ corp_number: "0614321", name: "Other name", address: null }), "plan:0614321");
  });
  it("falls back to name and address, and shares nothing on a bare name", () => {
    assert.equal(sharedBuildingKey({ corp_number: null, name: "Park Place", address: "1 Main St" }), "name:parkplace::1mainst");
    assert.equal(sharedBuildingKey({ corp_number: null, name: "Park Place", address: null }), null);
    assert.equal(sharedBuildingKey({ corp_number: "n/a", name: null, address: "1 Main St" }), null);
  });
});

describe("locateFigure", () => {
  it("finds a figure with or without separators and cents", () => {
    assert.deepEqual(locateFigure(412000, "money", docs), { docType: "reserve_fund_study", page: 1 });
    assert.deepEqual(locateFigure(1000000, "money", docs), { docType: "reserve_fund_study", page: 2 });
    assert.deepEqual(locateFigure(50000, "money", docs), { docType: "reserve_fund_study", page: 3 });
    assert.deepEqual(locateFigure(4.5, "percent", docs), { docType: "reserve_fund_study", page: 2 });
  });
  it("doesn't match inside a longer number, or prove a tiny figure", () => {
    assert.equal(locateFigure(12000, "money", docs), null); // "412,000" must not count as "12,000"
    assert.equal(locateFigure(41200, "money", docs), null);
    assert.equal(locateFigure(31, "money", [{ fileId: "f", docType: "x", pages: [{ page: 1, text: "Dec 31" }] }]), null);
    assert.equal(locateFigure(5, "percent", docs), null);
  });
});

describe("extractSharedFacts", () => {
  const out = extractSharedFacts({ building, structured_facts: facts() }, docs);
  const keys = out.map((f) => f.fact_key);
  it("shares only figures found on a page and quotes matched to a page", () => {
    assert.ok(keys.includes("reserve_balance"));
    assert.ok(keys.includes("reserve_recommended"));
    assert.ok(keys.includes("insurance_deductible"));
    assert.ok(keys.includes("fee_change"));
    assert.ok(keys.includes("special_assessment:roof-replacement"));
    assert.ok(keys.includes("litigation:water-ingress-claim-against-the-builder"));
    assert.ok(!keys.some((k) => k.includes("boiler")), "unverified evidence is not shared");
  });
  it("carries the date, document type and page, and never the filename or quote", () => {
    const sa = out.find((f) => f.fact_key.startsWith("special_assessment"))!;
    assert.equal(sa.value_num, 8500);
    assert.equal(sa.value_text, "levied");
    assert.equal(sa.as_of, "2025-03");
    assert.equal(sa.doc_type, "reserve_fund_study");
    assert.equal(sa.page, 4);
    assert.ok(!JSON.stringify(out).includes("Reserve study.pdf"));
  });
  it("shares nothing from an undated package", () => {
    assert.deepEqual(extractSharedFacts({ building, structured_facts: facts({ doc_date: null }) }, docs), []);
  });
  it("redacts private names in free text", () => {
    const f = extractSharedFacts(
      { building, structured_facts: facts({ litigation: [{ subject: "Claim by Mr. John Smith over parking", units_affected: null, status: "filed", evidence: ev(7) }] }) },
      docs
    );
    const lit = f.find((x) => x.fact_key.startsWith("litigation"))!;
    assert.ok(!lit.label.includes("John Smith"), lit.label);
  });
});

describe("timelines and the check", () => {
  const before: SharedFactRow[] = [
    row({ fact_key: "reserve_balance", as_of: "2024-03", value_num: 690000, seen_count: 2 }),
    row({ fact_key: "reserve_balance", as_of: "2023-03", value_num: 720000 }),
    row({ fact_key: "insurance_deductible", as_of: "2025-03", value_num: 25000 }),
    row({ fact_key: "litigation:elevator-contract-dispute", kind: "text", as_of: "2024-03", value_text: "threatened" }),
    row({ fact_key: "litigation:later-claim", kind: "text", as_of: "2026-01", value_text: "filed" }),
    row({ fact_key: "fee_change", kind: "percent", as_of: "2026-02", value_num: 9 }),
  ];
  const incoming: SharedFact[] = extractSharedFacts({ building, structured_facts: facts() }, docs);
  const check = checkAgainstRecord(incoming, before);
  const by = (k: string) => check.find((c) => c.fact_key === k)!;

  it("puts the newest statement first and keeps older ones as history", () => {
    const t = buildTimelines(before).find((x) => x.fact_key === "reserve_balance")!;
    assert.equal(t.current[0].value_num, 690000);
    assert.equal(t.history[0].value_num, 720000);
    assert.equal(buildTimelines(before)[0].fact_key, "reserve_balance", "reserve first");
  });
  it("reports changed, conflicting, older, new and missing facts", () => {
    assert.equal(by("reserve_balance").status, "changed");
    assert.equal(by("reserve_balance").record!.value_num, 690000);
    assert.equal(by("insurance_deductible").status, "conflict", "same date, different figure");
    assert.equal(by("fee_change").status, "older", "the record has a newer figure");
    assert.equal(by("special_assessment:roof-replacement").status, "new");
    assert.equal(by("litigation:elevator-contract-dispute").status, "not_mentioned");
    assert.equal(check.find((c) => c.fact_key === "litigation:later-claim"), undefined, "a later lawsuit isn't missing from an older package");
  });
  it("corroborates the same figure for the same date", () => {
    const again = checkAgainstRecord(incoming, incoming.map((f) => ({ ...f, seen_count: 1, first_seen: "x" })));
    assert.ok(again.every((c) => c.status === "corroborated"), JSON.stringify(again.map((c) => c.status)));
  });
  it("compares values by figure, or by normalized text", () => {
    assert.equal(valueKey({ value_num: 8500, value_text: "levied" }), valueKey({ value_num: 8500.0, value_text: "proposed" }));
    assert.equal(valueKey({ value_num: null, value_text: "In mediation." }), valueKey({ value_num: null, value_text: "in  mediation" }));
  });
  it("formats dates and prompt lines", () => {
    assert.equal(formatAsOf("2025-03"), "Mar 2025");
    assert.match(recordPromptLines(before)[0], /^reserve_balance: \$690,000 as of 2024-03; earlier \$720,000 as of 2023-03$/);
  });
});
