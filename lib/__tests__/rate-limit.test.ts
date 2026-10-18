import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  maxAnalysesPerDay,
  maxPagesPerRun,
  checkDailyAnalysisLimit,
  checkRunPayloadCap,
  type UsageDb,
} from "../rate-limit.ts";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.MAX_ANALYSES_PER_DAY;
  delete process.env.MAX_PAGES_PER_RUN;
});
afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("maxAnalysesPerDay / maxPagesPerRun", () => {
  it("default to 10 / 480", () => {
    assert.equal(maxAnalysesPerDay(), 10);
    assert.equal(maxPagesPerRun(), 480);
  });
  it("accept valid env overrides", () => {
    process.env.MAX_ANALYSES_PER_DAY = "25";
    process.env.MAX_PAGES_PER_RUN = "100";
    assert.equal(maxAnalysesPerDay(), 25);
    assert.equal(maxPagesPerRun(), 100);
  });
  it("fall back on garbage / zero / negative", () => {
    for (const v of ["abc", "0", "-5", ""]) {
      process.env.MAX_ANALYSES_PER_DAY = v;
      process.env.MAX_PAGES_PER_RUN = v;
      assert.equal(maxAnalysesPerDay(), 10);
      assert.equal(maxPagesPerRun(), 480);
    }
  });
});

describe("checkRunPayloadCap", () => {
  const doc = (pages: number) => ({
    pages: Array.from({ length: pages }, () => ({ text: "x".repeat(100) })),
  });
  it("allows stacks within the cap", () => {
    assert.equal(checkRunPayloadCap([doc(40), doc(40)]), null);
    assert.equal(checkRunPayloadCap([doc(480)]), null);
  });
  it("rejects stacks over the cap with a 413", () => {
    const res = checkRunPayloadCap([doc(481)]);
    assert.ok(res);
    assert.equal(res.status, 413);
    assert.match(res.error, /481 pages/);
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

describe("checkDailyAnalysisLimit", () => {
  function fakeDb(counts: Map<string, number>): UsageDb {
    return {
      query: async (sql: string, params?: Record<string, unknown>) => {
        const key = String(params?.key ?? "");
        if (sql.includes("SELECT VALUE count")) {
          return [counts.get(key) ?? 0];
        }
        // UPSERT
        counts.set(key, Number(params?.used ?? 0));
        return [];
      },
    };
  }
  it("allows the first N runs, then blocks", async () => {
    process.env.MAX_ANALYSES_PER_DAY = "2";
    const counts = new Map<string, number>();
    const db = fakeDb(counts);
    const r1 = await checkDailyAnalysisLimit(db, "user-a");
    assert.equal(r1.allowed, true);
    assert.equal(r1.used, 1);
    const r2 = await checkDailyAnalysisLimit(db, "user-a");
    assert.equal(r2.allowed, true);
    assert.equal(r2.used, 2);
    const r3 = await checkDailyAnalysisLimit(db, "user-a");
    assert.equal(r3.allowed, false);
    assert.equal(r3.used, 3);
    assert.equal(r3.limit, 2);
  });
  it("counts per user, not globally", async () => {
    process.env.MAX_ANALYSES_PER_DAY = "1";
    const counts = new Map<string, number>();
    const db = fakeDb(counts);
    await checkDailyAnalysisLimit(db, "user-a");
    const rb = await checkDailyAnalysisLimit(db, "user-b");
    assert.equal(rb.allowed, true);
    assert.equal(rb.used, 1);
  });
  it("uses a YYYY-MM-DD UTC day bucket", async () => {
    const counts = new Map<string, number>();
    const db = fakeDb(counts);
    const r = await checkDailyAnalysisLimit(db, "user-a");
    assert.match(r.day, /^\d{4}-\d{2}-\d{2}$/);
  });
});
