import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deleteReportCascade, type CascadeDb } from "../db.ts";

interface Call {
  sql: string;
  params?: Record<string, unknown>;
}

/**
 * Fake db: `selects` maps a substring of the SQL to the rows returned
 * (as the driver's res[0] array). Records every call in order.
 */
function fakeDb(selects: Record<string, unknown[]>): CascadeDb & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async query(sql: string, params?: Record<string, unknown>) {
      calls.push({ sql, params });
      for (const [key, rows] of Object.entries(selects)) {
        if (sql.includes(key)) return [rows];
      }
      return [[]];
    },
  };
}

const OWNER = "user_1";
const REPORT = "report:abc";
const BUILDING = "building:xyz";

describe("deleteReportCascade", () => {
  it("returns null when the report is missing or not owned", async () => {
    const db = fakeDb({ "FROM report WHERE id": [] });
    const result = await deleteReportCascade(db, OWNER, REPORT);
    assert.equal(result, null);
    assert.equal(db.calls.length, 1, "no deletes run when the report is missing");
  });

  it("deletes flags, documents, then the report — all owner-scoped", async () => {
    const db = fakeDb({
      "FROM report WHERE id": [{ id: REPORT, building: BUILDING }],
      "WHERE building =": [],
    });
    const result = await deleteReportCascade(db, OWNER, REPORT);
    assert.deepEqual(result, { buildingId: BUILDING, buildingDeleted: true });

    const deletes = db.calls.filter((c) => c.sql.startsWith("DELETE"));
    assert.deepEqual(
      deletes.map((c) => c.sql.match(/^DELETE (\w+)/)![1]),
      ["flag", "document", "report", "building"],
      "children first, then the report, then the empty building"
    );
    for (const c of deletes) {
      assert.equal(c.params?.owner, OWNER, `owner-scoped: ${c.sql}`);
    }
    // Documents are scoped to the REPORT, not the building — other reports'
    // documents must survive.
    const docDelete = deletes.find((c) => c.sql.startsWith("DELETE document"))!;
    assert.match(docDelete.sql, /report = type::thing\(\$id\)/);
    assert.ok(!docDelete.sql.includes("building ="), "must not delete by building");
  });

  it("keeps the building when other reports remain", async () => {
    const db = fakeDb({
      "FROM report WHERE id": [{ id: REPORT, building: BUILDING }],
      "WHERE building =": [{ id: "report:other" }],
    });
    const result = await deleteReportCascade(db, OWNER, REPORT);
    assert.deepEqual(result, { buildingId: BUILDING, buildingDeleted: false });
    const tables = db.calls
      .filter((c) => c.sql.startsWith("DELETE"))
      .map((c) => c.sql.match(/^DELETE (\w+)/)![1]);
    assert.deepEqual(tables, ["flag", "document", "report"]);
  });

  it("a user cannot delete another user's report", async () => {
    // Ownership check returns no row for a foreign report id.
    const db = fakeDb({ "FROM report WHERE id": [] });
    const result = await deleteReportCascade(db, "user_attacker", REPORT);
    assert.equal(result, null);
    assert.ok(
      db.calls.every((c) => !c.sql.startsWith("DELETE")),
      "no writes for foreign reports"
    );
  });
});
