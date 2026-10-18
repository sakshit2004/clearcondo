import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  getRetentionDays,
  retentionCutoff,
  hasUploadConsent,
  isCronAuthorized,
  runRetentionCleanup,
  type CleanupDb,
} from "../retention.ts";

/** Recording fake for the cleanup's minimal db surface. */
function fakeDb(deletedIds: unknown[] = []): CleanupDb & {
  calls: { sql: string; params?: Record<string, unknown> }[];
} {
  const calls: { sql: string; params?: Record<string, unknown> }[] = [];
  return {
    calls,
    async query(sql: string, params?: Record<string, unknown>) {
      calls.push({ sql, params });
      return [[...deletedIds]];
    },
  };
}

const NOW = new Date("2026-10-18T12:00:00.000Z");

describe("getRetentionDays", () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.RETENTION_DAYS;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.RETENTION_DAYS;
    else process.env.RETENTION_DAYS = saved;
  });

  it("defaults to 30 when unset", () => {
    delete process.env.RETENTION_DAYS;
    assert.equal(getRetentionDays(), DEFAULT_RETENTION_DAYS);
    assert.equal(getRetentionDays(), 30);
  });
  it("honors a valid override", () => {
    process.env.RETENTION_DAYS = "90";
    assert.equal(getRetentionDays(), 90);
  });
  it("falls back on garbage, zero, negative, or huge values", () => {
    for (const bad of ["abc", "", "0", "-5", "3.5", String(MAX_RETENTION_DAYS + 1)]) {
      process.env.RETENTION_DAYS = bad;
      assert.equal(getRetentionDays(), DEFAULT_RETENTION_DAYS, `input: ${bad}`);
    }
  });
  it("accepts the max boundary", () => {
    process.env.RETENTION_DAYS = String(MAX_RETENTION_DAYS);
    assert.equal(getRetentionDays(), MAX_RETENTION_DAYS);
  });
});

describe("retentionCutoff", () => {
  it("subtracts exactly N days", () => {
    assert.equal(
      retentionCutoff(NOW, 30).toISOString(),
      "2026-09-18T12:00:00.000Z"
    );
  });
  it("is pure — does not mutate the input date", () => {
    const input = new Date(NOW);
    retentionCutoff(input, 30);
    assert.equal(input.toISOString(), NOW.toISOString());
  });
  it("a document created just before the cutoff is expired", () => {
    const cutoff = retentionCutoff(NOW, 30);
    const justBefore = new Date(cutoff.getTime() - 1000);
    assert.ok(justBefore < cutoff);
  });
  it("a document created just after the cutoff survives", () => {
    const cutoff = retentionCutoff(NOW, 30);
    const justAfter = new Date(cutoff.getTime() + 1000);
    assert.ok(!(justAfter < cutoff));
  });
});

describe("hasUploadConsent", () => {
  it("accepts JSON true and form-field \"true\"", () => {
    assert.equal(hasUploadConsent(true), true);
    assert.equal(hasUploadConsent("true"), true);
  });
  it("rejects everything else", () => {
    for (const v of [false, "false", "on", "1", 1, "", null, undefined, {}]) {
      assert.equal(hasUploadConsent(v), false, `input: ${JSON.stringify(v)}`);
    }
  });
});

describe("runRetentionCleanup", () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.RETENTION_DAYS;
    delete process.env.RETENTION_DAYS;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.RETENTION_DAYS;
    else process.env.RETENTION_DAYS = saved;
  });

  it("deletes only documents older than the cutoff", async () => {
    const db = fakeDb([{ id: "document:1" }, { id: "document:2" }]);
    const result = await runRetentionCleanup(db, NOW);
    assert.equal(db.calls.length, 1);
    assert.match(db.calls[0].sql, /DELETE document WHERE created_at < \$cutoff/);
    assert.equal(db.calls[0].params?.cutoff, "2026-09-18T12:00:00.000Z");
    assert.equal(result.documentsDeleted, 2);
    assert.equal(result.retentionDays, 30);
    assert.equal(result.cutoff, "2026-09-18T12:00:00.000Z");
  });
  it("never touches report, flag, or building tables", async () => {
    const db = fakeDb();
    await runRetentionCleanup(db, NOW);
    const sql = db.calls[0].sql.toLowerCase();
    assert.ok(!sql.includes("report"));
    assert.ok(!sql.includes("flag"));
    assert.ok(!sql.includes("building"));
  });
  it("honors a custom RETENTION_DAYS", async () => {
    process.env.RETENTION_DAYS = "7";
    const db = fakeDb();
    const result = await runRetentionCleanup(db, NOW);
    assert.equal(db.calls[0].params?.cutoff, "2026-10-11T12:00:00.000Z");
    assert.equal(result.retentionDays, 7);
  });
  it("reports zero deletions cleanly", async () => {
    const db = fakeDb();
    const result = await runRetentionCleanup(db, NOW);
    assert.equal(result.documentsDeleted, 0);
  });
});

describe("isCronAuthorized", () => {
  it("accepts the exact bearer token", () => {
    assert.equal(isCronAuthorized("Bearer s3cr3t", "s3cr3t"), true);
  });
  it("rejects wrong, missing, or malformed headers", () => {
    assert.equal(isCronAuthorized("Bearer wrong", "s3cr3t"), false);
    assert.equal(isCronAuthorized(null, "s3cr3t"), false);
    assert.equal(isCronAuthorized("s3cr3t", "s3cr3t"), false);
    assert.equal(isCronAuthorized("bearer s3cr3t", "s3cr3t"), false);
  });
  it("fails closed when the secret is unset", () => {
    assert.equal(isCronAuthorized("Bearer s3cr3t", undefined), false);
    assert.equal(isCronAuthorized("Bearer ", ""), false);
  });
});
