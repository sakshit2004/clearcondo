import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeForMatch,
  verifyQuote,
  verifyEvidences,
} from "../verify.ts";
import type { PageText } from "../extract.ts";
import type { Flag } from "../report-schema.ts";

const pages: PageText[] = [
  {
    page: 1,
    text: "The reserve fund balance at year-end was $745,000 against a study-recommended balance of $1,221,000 — approximately 61% funded.",
  },
  {
    page: 2,
    text: "The preliminary opinion of probable cost is $1,150,000, which is not currently funded in the reserve fund plan.",
  },
];

describe("normalizeForMatch", () => {
  it("lowercases and collapses whitespace", () => {
    assert.equal(normalizeForMatch("  Hello   WORLD\n"), "hello world");
  });
  it("normalizes smart quotes and dashes", () => {
    assert.equal(
      normalizeForMatch("\u201cGood\u201d \u2014 it\u2019s fine"),
      '"good" - it\'s fine'
    );
  });
  it("joins hyphenated line breaks", () => {
    assert.equal(normalizeForMatch("enve-\nlope remedi-\nation"), "envelope remediation");
  });
  it("does not join real hyphens", () => {
    assert.equal(normalizeForMatch("per-unit cost"), "per-unit cost");
  });
});

describe("verifyQuote", () => {
  it("exact match on the cited page -> exact_page", () => {
    const v = verifyQuote(
      "The reserve fund balance at year-end was $745,000",
      pages,
      1
    );
    assert.equal(v.verified, true);
    assert.equal(v.matchType, "exact_page");
    assert.equal(v.matchedPage, 1);
  });

  it("whitespace / case / smart-quote differences still verify", () => {
    const v = verifyQuote(
      "the  RESERVE fund\nbalance at year-end was $745,000",
      pages,
      1
    );
    assert.equal(v.verified, true);
    assert.ok(v.matchType === "exact_page" || v.matchType === "exact_file");
  });

  it("hyphenated line-break differences still verify", () => {
    const hyphenated: PageText[] = [
      { page: 1, text: "The building enve-\nlope requires remediation within three years." },
    ];
    const v = verifyQuote(
      "The building envelope requires remediation within three years.",
      hyphenated,
      1
    );
    assert.equal(v.verified, true);
  });

  it("wrong cited page but present elsewhere -> exact_file with corrected page", () => {
    const v = verifyQuote(
      "The preliminary opinion of probable cost is $1,150,000",
      pages,
      1 // actually on page 2
    );
    assert.equal(v.verified, true);
    assert.equal(v.matchType, "exact_file");
    assert.equal(v.matchedPage, 2);
  });

  it("near-verbatim long quote with a dropped word -> fuzzy", () => {
    const longPage: PageText[] = [
      {
        page: 1,
        text: "The preliminary opinion of probable cost is $1,150,000, which is not currently funded in the reserve fund plan. The board directed management to obtain three competitive quotes for the November meeting.",
      },
    ];
    const v = verifyQuote(
      "The preliminary opinion of probable cost is $1,150,000, which is not currently funded in the reserve fund plan. The board directed management to obtain three quotes for the November meeting.",
      longPage,
      1
    );
    assert.equal(v.verified, true);
    assert.equal(v.matchType, "fuzzy");
  });

  it("short quote with a dropped word stays below 0.9 -> rejected", () => {
    const v = verifyQuote(
      "The preliminary opinion of probable cost is $1,150,000, which is not currently funded in the fund plan.",
      pages,
      2
    );
    assert.equal(v.verified, false);
  });

  it("fabricated quote -> rejected", () => {
    const v = verifyQuote(
      "The board voted to dissolve the reserve fund entirely and distribute the cash to owners.",
      pages,
      1
    );
    assert.equal(v.verified, false);
    assert.equal(v.matchType, "none");
    assert.equal(v.matchedPage, null);
  });

  it("quote too short to be meaningful -> rejected", () => {
    const v = verifyQuote("fund", pages, 1);
    assert.equal(v.verified, false);
  });

  it("reworded paraphrase with different vocabulary -> rejected", () => {
    const v = verifyQuote(
      "Savings for future repairs totaled seven hundred forty-five thousand dollars at the close of the fiscal period.",
      pages,
      1
    );
    assert.equal(v.verified, false);
  });
});

describe("verifyEvidences", () => {
  it("resolves docs by file_id and falls back to filename", () => {
    const docs = [
      { fileId: "file-0", fileName: "minutes.pdf", pages, ocr: false },
    ];
    const out = verifyEvidences(
      [
        { file_id: "file-0", page: 2, document_name: "minutes.pdf", quote: "not currently funded in the reserve fund plan" },
        { file_id: "unknown", page: 1, document_name: "minutes.pdf", quote: "approximately 61% funded" },
        { file_id: "unknown", page: 1, document_name: "missing.pdf", quote: "approximately 61% funded" },
      ],
      docs
    );
    assert.equal(out[0].verified, true);
    assert.equal(out[1].verified, true); // filename fallback
    assert.equal(out[2].verified, false); // no such doc
  });
});

describe("parseMoneyFigure", () => {
  it("parses plain, comma, and abbreviated figures", async () => {
    const { parseMoneyFigure } = await import("../verify.ts");
    assert.equal(parseMoneyFigure("$8,500"), 8500);
    assert.equal(parseMoneyFigure("$1.15M"), 1150000);
    assert.equal(parseMoneyFigure("$1,150,000"), 1150000);
    assert.equal(parseMoneyFigure("$100k"), 100000);
    assert.equal(parseMoneyFigure("$4,250"), 4250);
    assert.equal(parseMoneyFigure("nonsense"), null);
  });
});

describe("checkFlagMoney", () => {
  let checkFlagMoney: typeof import("../verify.ts").checkFlagMoney;
  let extractMoneyValues: typeof import("../verify.ts").extractMoneyValues;
  let extractBareNumbers: typeof import("../verify.ts").extractBareNumbers;
  before(async () => {
    const m = await import("../verify.ts");
    checkFlagMoney = m.checkFlagMoney;
    extractMoneyValues = m.extractMoneyValues;
    extractBareNumbers = m.extractBareNumbers;
  });

  const src =
    "The board voted a special assessment of $8,500 per unit for the parkade membrane. " +
    "There are 84 units. The envelope remediation will cost $1,150,000.";
  const moneyVals = () => extractMoneyValues(src);
  const bareNums = () => extractBareNumbers(src);

  const flag = (over: Partial<Flag> = {}): Flag => ({
    flag_type: "special_assessment",
    severity: "critical",
    title: "$8,500/unit special assessment levied for parkade membrane",
    explanation: "The board voted $8,500 per unit.",
    evidence: [],
    money_exposure: {
      amount_cad: 714000,
      per_unit_cad: 8500,
      basis: "$8,500 x 84 units = $714,000",
    },
    ...over,
  });

  it("passes verbatim figures", () => {
    const r = checkFlagMoney(flag(), moneyVals(), bareNums());
    assert.equal(r.ok, true);
    assert.deepEqual(r.ungrounded, []);
  });

  it("passes computed amounts shown in the basis (8500 x 84 = 714000)", () => {
    const r = checkFlagMoney(flag(), moneyVals(), bareNums());
    assert.equal(r.ok, true); // 714000 is derivable, not invented
  });

  it("treats $1.15M and $1,150,000 as the same value", () => {
    const r = checkFlagMoney(
      flag({ title: "$1.15M envelope remediation not funded", money_exposure: null }),
      moneyVals(),
      bareNums()
    );
    assert.equal(r.ok, true);
  });

  it("flags an invented dollar figure in the title", () => {
    const r = checkFlagMoney(
      flag({ title: "Mystery $99,000 charge discovered", money_exposure: null }),
      moneyVals(),
      bareNums()
    );
    assert.equal(r.ok, false);
    assert.ok(r.ungrounded.some((u) => u.includes("99,000")));
  });

  it("flags an invented money_exposure amount", () => {
    const r = checkFlagMoney(
      flag({
        money_exposure: {
          amount_cad: 999999,
          per_unit_cad: 8500,
          basis: "$8,500 x 84 units",
        },
      }),
      moneyVals(),
      bareNums()
    );
    assert.equal(r.ok, false);
    assert.ok(r.ungrounded.some((u) => u.includes("999999")));
  });
});

describe("verifyAnalysis money cross-check", () => {
  it("downgrades a flag with an invented figure and nulls its money", async () => {
    const { verifyAnalysis } = await import("../verify.ts");
    const moneyPages: PageText[] = [
      {
        page: 1,
        text: "The board voted a special assessment of $8,500 per unit for the parkade membrane. There are 84 units.",
      },
    ];
    const docs = [{ fileId: "file-0", fileName: "minutes.pdf", pages: moneyPages, ocr: false }];
    const baseFlag = {
      flag_type: "special_assessment",
      severity: "critical",
      evidence: [
        {
          file_id: "file-0",
          page: 1,
          document_name: "minutes.pdf",
          quote:
            "The board voted a special assessment of $8,500 per unit for the parkade membrane",
        },
      ],
    };
    const analysis = {
      building: { name: null, corp_number: null, address: null, units: 84, year_built: null, monthly_contribution_avg_cad: null },
      structured_facts: {
        doc_date: null, reserve_balance_cad: null, reserve_recommended_cad: null,
        contribution_monthly_cad: null, insurance_deductible_cad: null,
        special_assessments: [], litigation: [], rental_rules: null,
        rental_rules_evidence: null, fee_change_pct: null,
      },
      flags: [
        {
          ...baseFlag,
          title: "$8,500/unit special assessment levied",
          explanation: "The board voted $8,500 per unit.",
          money_exposure: { amount_cad: 714000, per_unit_cad: 8500, basis: "$8,500 x 84 units = $714,000" },
        },
        {
          ...baseFlag,
          title: "Mystery $99,000 charge discovered",
          explanation: "An unexplained $99,000 appears.",
          money_exposure: { amount_cad: 99000, per_unit_cad: 99000, basis: "$99,000 found" },
        },
      ],
      money_exposure_total_cad: null,
      money_exposure_basis: "n/a",
      questions_for_realtor_lawyer: [],
      summary: "s",
    };
    const out = verifyAnalysis(analysis as never, docs);
    assert.equal(out.flags[0].severity, "critical");
    assert.ok(out.flags[0].money_exposure);
    assert.equal(out.flags[1].severity, "warning"); // invented figure -> downgraded
    assert.equal(out.flags[1].money_exposure, null);
    assert.equal(out.flags[1].downgraded, true);
  });
});
