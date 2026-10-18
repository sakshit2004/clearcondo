/**
 * DRAFT — check 15: authorization / IDOR.
 *
 * Code audit (lib/db.ts) — all owner-scoped:
 * - deleteReportCascade: every DELETE/SELECT carries `owner_id = $owner`.
 * - getReport: report lookup scoped by owner_id (flags fetched only after the
 *   report lookup succeeds).
 * - listReports / listBuildings / getBuildingHistory / matchBuildings /
 *   getPriorFlags / getPreviousFactsSnapshot: all `WHERE owner_id = $owner`.
 * - upsertBuilding: dedupe_key embeds the owner id (`${ownerId}|corp:…` /
 *   `${ownerId}|name:…`), UNIQUE index — user B can never collide with user A's key.
 * - /api/analyze/run: client-supplied buildingId re-checked with
 *   `WHERE id = … AND owner_id = $owner`; user B's id for user A's building
 *   resolves to nothing and falls back to B's own buildings.
 *
 * Runnable without keys: unauthenticated destructive calls must not succeed.
 * Two-user live test (user A reads/deletes user B's report id) needs real
 * Clerk keys + a SurrealDB — marked BLOCKED there.
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

test("unauthenticated DELETE /api/reports/:id must not succeed", async ({
  request,
}) => {
  const r = await request.delete(BASE + "/api/reports/report:abc123");
  // Zero keys -> 503 (auth not configured). With keys but no session -> 401.
  // Either way it must NOT be 200/204 with a deletion.
  expect([401, 503]).toContain(r.status());
  const body = await r.json();
  expect(body.ok).not.toBe(true);
});

test("unauthenticated GET /api/buildings/match leaks nothing", async ({
  request,
}) => {
  const r = await request.get(BASE + "/api/buildings/match?hint=a");
  expect([200, 401]).toContain(r.status());
  if (r.status() === 200) {
    const body = await r.json();
    // Zero-key/DB-less deployments return an empty list, never rows.
    expect(body.buildings ?? []).toEqual([]);
  }
});

test("two-user IDOR: user A cannot read user B's report", async () => {
  test.skip(true, "BLOCKED — needs real Clerk keys for two users + SurrealDB");
  // 1. As user B, run an analysis -> reportIdB.
  // 2. As user A, DELETE /api/reports/<reportIdB> -> expect 404
  //    {"error":"Report not found."} (getReport scopes by owner_id).
  // 3. As user A, GET /app/reports/<reportIdB> -> expect not-found UI, no data.
});
