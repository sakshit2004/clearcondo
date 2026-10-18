import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeMetrics,
  matchExpectedFlags,
  matchScore,
  minRecall,
  passesEval,
  reverifyQuotes,
  type EvalDoc,
  type EvalEvidence,
  type EvalFlag,
  type ExpectedFlag,
} from "../eval.ts";

const expected = (
  over: Partial<ExpectedFlag> = {}
): ExpectedFlag => ({
  id: "x",
  severity: "warning",
  title_keywords: ["special assessment", "parkade"],
  evidence_quote: "a special assessment of $8,500 per unit",
  source_doc: "minutes.pdf",
  ...over,
});

const produced = (over: Partial<EvalFlag> = {}): EvalFlag => ({
  severity: "critical",
  title: "$8,500/unit special assessment levied for parkade membrane",
  evidence: [],
  money_exposure: null,
  ...over,
});

describe("matchScore", () => {
  it("matches when all keywords present (normalized)", () => {
    assert.equal(
      matchScore(expected(), "$8,500/unit special assessment levied for parkade membrane"),
      2
    );
  });

  it("returns -1 when any keyword is missing", () => {
    assert.equal(matchScore(expected(), "Reserve fund at 61% of recommended level"), -1);
  });

  it("normalizes punctuation: '$8,500' matches '8 500'", () => {
    assert.equal(matchScore(expected({ title_keywords: ["8,500"] }), "levy of $8,500 per unit"), 1);
  });

  it("case-insensitive", () => {
    assert.equal(matchScore(expected(), "SPECIAL ASSESSMENT for the PARKADE"), 2);
  });

  it("title field replaces keywords when present", () => {
    const e = expected({ title: "rental cap", title_keywords: ["special assessment"] });
    assert.equal(matchScore(e, "Proposed rental cap: 15%"), 1);
    assert.equal(matchScore(e, "Special assessment for parkade"), -1);
  });

  it("returns -1 when there are no needles", () => {
    assert.equal(matchScore(expected({ title_keywords: [] }), "anything"), -1);
  });
});

describe("matchExpectedFlags", () => {
  it("matches best candidate and does not double-assign", () => {
    const exp = [
      expected({ id: "sa" }),
      expected({ id: "reserve", title_keywords: ["reserve fund"] }),
    ];
    const prod = [
      produced({ title: "Reserve fund at 61% of recommended level" }),
      produced({ title: "$8,500/unit special assessment levied for parkade membrane" }),
    ];
    const out = matchExpectedFlags(exp, prod);
    assert.equal(out[0].matchedIndex, 1);
    assert.equal(out[1].matchedIndex, 0);
  });

  it("prefers the higher keyword coverage on ties of candidates", () => {
    const exp = [expected({ id: "a", title_keywords: ["parkade"] })];
    const prod = [
      produced({ title: "Parkade repairs discussed" }),
      produced({ title: "Special assessment levied for parkade membrane" }),
    ];
    const out = matchExpectedFlags(exp, prod);
    // both match with 1 keyword; earlier produced flag wins the tie
    assert.equal(out[0].matchedIndex, 0);
  });

  it("leaves unmatched expectations with null index", () => {
    const out = matchExpectedFlags(
      [expected({ id: "missing", title_keywords: ["roof replacement"] })],
      [produced()]
    );
    assert.equal(out[0].matchedIndex, null);
  });

  it("two expectations cannot claim the same produced flag", () => {
    const exp = [
      expected({ id: "a", title_keywords: ["parkade"] }),
      expected({ id: "b", title_keywords: ["parkade"] }),
    ];
    const out = matchExpectedFlags(exp, [produced()]);
    const taken = out.map((o) => o.matchedIndex);
    assert.deepEqual(taken, [0, null]);
  });
});

const pages = (texts: string[]) =>
  texts.map((text, i) => ({ page: i + 1, text }));

const doc = (fileName: string, texts: string[]): EvalDoc => ({
  fileName,
  pages: pages(texts),
});

const ev = (quote: string, document_name = "minutes.pdf", page = 1): EvalEvidence => ({
  quote,
  document_name,
  page,
});

describe("reverifyQuotes", () => {
  const docs = [
    doc("minutes.pdf", [
      "BE IT RESOLVED that a special assessment of $8,500 per unit be levied.",
    ]),
  ];

  it("passes a genuine verbatim quote", () => {
    const [c] = reverifyQuotes(
      [ev("a special assessment of $8,500 per unit be levied")],
      docs
    );
    assert.equal(c.verified, true);
  });

  it("flags a fabricated quote as unverified", () => {
    const [c] = reverifyQuotes(
      [ev("the board voted to demolish the parkade entirely")],
      docs
    );
    assert.equal(c.verified, false);
  });

  it("marks quotes from unknown documents unverified", () => {
    const [c] = reverifyQuotes([ev("a special assessment", "other.pdf")], docs);
    assert.equal(c.verified, false);
  });
});

describe("computeMetrics", () => {
  it("computes recall, fabricated count, and % verified", () => {
    const exp = [expected({ id: "a" }), expected({ id: "b" })];
    const matches = [
      { expected: exp[0], found: true, matchedIndex: 0, matchedTitle: "t", severityMatch: true, amountOk: null, quotesVerified: true, labelQuoteOk: true },
      { expected: exp[1], found: false, matchedIndex: null, matchedTitle: null, severityMatch: null, amountOk: null, quotesVerified: null, labelQuoteOk: true },
    ];
    const m = computeMetrics(exp, matches, [
      { quote: "q1", document_name: "d", verified: true },
      { quote: "q2", document_name: "d", verified: true },
      { quote: "q3", document_name: "d", verified: false },
    ]);
    assert.equal(m.recall, 0.5);
    assert.equal(m.fabricatedQuotes, 1);
    assert.equal(m.totalQuotes, 3);
    assert.ok(Math.abs(m.pctVerified - 2 / 3) < 1e-9);
  });

  it("recall is 1 with no expectations", () => {
    const m = computeMetrics([], [], []);
    assert.equal(m.recall, 1);
    assert.equal(m.pctVerified, 1);
  });
});

describe("gates", () => {
  it("minRecall defaults to 0.8", () => {
    delete process.env.EVAL_MIN_RECALL;
    assert.equal(minRecall(), 0.8);
  });

  it("minRecall honors a valid env override", () => {
    process.env.EVAL_MIN_RECALL = "0.9";
    assert.equal(minRecall(), 0.9);
    delete process.env.EVAL_MIN_RECALL;
  });

  it("minRecall falls back on garbage", () => {
    process.env.EVAL_MIN_RECALL = "banana";
    assert.equal(minRecall(), 0.8);
    process.env.EVAL_MIN_RECALL = "2";
    assert.equal(minRecall(), 0.8);
    delete process.env.EVAL_MIN_RECALL;
  });

  it("passesEval fails on any fabricated quote even with perfect recall", () => {
    delete process.env.EVAL_MIN_RECALL;
    const base = {
      expectedCount: 2, matchedCount: 2, recall: 1,
      totalQuotes: 3, verifiedQuotes: 2, fabricatedQuotes: 1, pctVerified: 2 / 3,
    };
    assert.equal(passesEval(base), false);
    assert.equal(passesEval({ ...base, fabricatedQuotes: 0, verifiedQuotes: 3, pctVerified: 1 }), true);
    assert.equal(passesEval({ ...base, recall: 0.5, fabricatedQuotes: 0, verifiedQuotes: 3, pctVerified: 1 }), false);
  });
});
