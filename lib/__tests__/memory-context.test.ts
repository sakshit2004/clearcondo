import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildMemoryContext } from "../memory-context.ts";

const flag = { severity: "critical", title: "Special assessment levied", explanation: "$8,500 per unit." };

describe("buildMemoryContext", () => {
  it("is null with no memory", () => {
    assert.equal(buildMemoryContext([], []), null);
    assert.equal(buildMemoryContext([], ["  ", ""]), null);
  });
  it("lists prior verified flags", () => {
    const c = buildMemoryContext([flag], [])!;
    assert.match(c, /Verified flags from previous analyses/);
    assert.match(c, /- \[critical\] Special assessment levied: \$8,500 per unit\./);
    assert.doesNotMatch(c, /Agent Memory/);
  });
  it("adds Agent Memory's reconciled beliefs alongside the flags", () => {
    const c = buildMemoryContext([flag], ["Reserve fund was 63% funded in 2024,\n now 61% (2026)."])!;
    assert.match(c, /What Agent Memory currently believes about this building/);
    assert.match(c, /- Reserve fund was 63% funded in 2024, now 61% \(2026\)\./);
    assert.ok(c.indexOf("Verified flags") < c.indexOf("Agent Memory"));
  });
  it("works with beliefs alone, capped in count and length", () => {
    const many = Array.from({ length: 10 }, (_, i) => `belief ${i} ` + "x".repeat(500));
    const c = buildMemoryContext([], many)!;
    assert.equal((c.match(/^- belief/gm) ?? []).length, 6);
    assert.ok(c.split("\n").filter((l) => l.startsWith("- ")).every((l) => l.length <= 403)); // "- " + 400 + "…"
  });
});
