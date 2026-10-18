import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DOC_CHECKLIST, findMissingDocs } from "../doc-checklist.ts";

describe("findMissingDocs", () => {
  it("flags everything missing on an empty upload", () => {
    const missing = findMissingDocs([]);
    assert.equal(missing.length, DOC_CHECKLIST.length);
  });

  it("flags nothing on a complete package", () => {
    const missing = findMissingDocs([
      "bylaws",
      "financials",
      "budget",
      "reserve_study",
      "minutes_board",
      "minutes_agm",
      "info_statement",
      "insurance",
    ]);
    assert.equal(missing.length, 0);
  });

  it("minutes satisfied by either board or AGM minutes", () => {
    assert.equal(
      findMissingDocs(["minutes_agm"]).some((m) => m.id === "minutes"),
      false
    );
    assert.equal(
      findMissingDocs(["minutes_board"]).some((m) => m.id === "minutes"),
      false
    );
  });

  it("budget satisfied by financials as well", () => {
    assert.equal(
      findMissingDocs(["financials"]).some((m) => m.id === "budget"),
      false
    );
  });

  it("typical partial upload flags the rest", () => {
    const missing = findMissingDocs(["reserve_study", "minutes_agm"]);
    const ids = missing.map((m) => m.id).sort();
    assert.deepEqual(
      ids,
      ["budget", "bylaws", "financials", "info_statement", "insurance"]
    );
    for (const m of missing) {
      assert.ok(m.askFor.length > 0, "every item tells the user what to ask for");
    }
  });
});
