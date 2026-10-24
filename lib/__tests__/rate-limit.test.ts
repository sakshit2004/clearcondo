import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { maxPagesPerRun, checkRunPayloadCap } from "../rate-limit.ts";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.MAX_PAGES_PER_RUN;
});
afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("maxPagesPerRun", () => {
  it("defaults to 1200", () => {
    assert.equal(maxPagesPerRun(), 1200);
  });
  it("accepts a valid env override", () => {
    process.env.MAX_PAGES_PER_RUN = "100";
    assert.equal(maxPagesPerRun(), 100);
  });
  it("falls back on garbage / zero / negative", () => {
    for (const v of ["abc", "0", "-5", ""]) {
      process.env.MAX_PAGES_PER_RUN = v;
      assert.equal(maxPagesPerRun(), 1200);
    }
  });
});

describe("checkRunPayloadCap", () => {
  const doc = (pages: number) => ({
    pages: Array.from({ length: pages }, () => ({ text: "x".repeat(100) })),
  });
  it("allows stacks within the cap", () => {
    assert.equal(checkRunPayloadCap([doc(100), doc(100)]), null);
    assert.equal(checkRunPayloadCap([doc(1200)]), null);
  });
  it("rejects stacks over the cap with a 413", () => {
    const res = checkRunPayloadCap([doc(1201)]);
    assert.ok(res);
    assert.equal(res.status, 413);
    assert.match(res.error, /1201 pages/);
  });
  it("respects MAX_PAGES_PER_RUN override", () => {
    process.env.MAX_PAGES_PER_RUN = "10";
    assert.ok(checkRunPayloadCap([doc(11)]));
    assert.equal(checkRunPayloadCap([doc(10)]), null);
  });
  it("treats missing pages as zero", () => {
    assert.equal(checkRunPayloadCap([{}, { pages: undefined }]), null);
  });
});
