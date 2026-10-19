import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { citedFileIds, repairPrompt } from "../repair.ts";

const docs = [
  { fileId: "file-0", filename: "a.pdf", docType: "minutes", text: "AAA" },
  { fileId: "file-1", filename: "b.pdf", docType: "bylaws", text: "BBB" },
  { fileId: "file-2", filename: "c.pdf", docType: "reserve_study", text: "CCC" },
];

describe("citedFileIds", () => {
  it("extracts cited file ids, deduped, in order", () => {
    const raw = `{"flags":[{"evidence":[{"file_id":"file-2"},{"file_id":"file-0"},{"file_id":"file-2"}]}]}`;
    assert.deepEqual(citedFileIds(raw), ["file-2", "file-0"]);
  });
  it("returns empty when nothing is cited", () => {
    assert.deepEqual(citedFileIds("not json at all"), []);
    assert.deepEqual(citedFileIds('{"flags":[]}'), []);
  });
  it("ignores file ids not in quotes", () => {
    assert.deepEqual(citedFileIds("see file-1 for details"), []);
  });
});

describe("repairPrompt", () => {
  it("resends only the cited documents when the failed response names them", () => {
    const raw = `{"flags":[{"evidence":[{"file_id":"file-1"}]}]}`;
    const p = repairPrompt("flags.0.title: Required", docs, raw);
    assert.match(p, /Validation errors:/);
    assert.ok(p.includes("BBB"), "cited doc text is resent");
    assert.ok(!p.includes("AAA"), "uncited doc is omitted");
    assert.ok(!p.includes("CCC"), "uncited doc is omitted");
  });
  it("resends the full stack when nothing is cited", () => {
    const p = repairPrompt("not json", docs, "garbage");
    assert.ok(p.includes("AAA") && p.includes("BBB") && p.includes("CCC"));
  });
});
