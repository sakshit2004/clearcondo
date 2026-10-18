import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeForMatch,
  verifyQuote,
  verifyEvidences,
} from "../verify.ts";
import type { PageText } from "../extract.ts";

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
