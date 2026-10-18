/**
 * DRAFT — check 14: auth gating with zero Clerk keys (logged out).
 *
 * Intended behavior (proxy.ts + lib/auth.ts + app/app/layout.tsx):
 * - Zero keys: proxy passes through; /app/* pages render a SetupNotice
 *   ("Auth not configured") with 200 — no redirect, no data.
 * - API routes: analyze/start + analyze/run + reports/[id] -> 503
 *   {"error":"Authentication is not configured."}; retention/cleanup -> 401;
 *   buildings/match -> 200 {"buildings":[]}; me/credits -> 200
 *   {"enabled":false,"balance":null} (payments disabled); checkout + stripe
 *   webhook -> 404 (payments disabled).
 * - With Clerk keys configured but no session: /app/* redirects to /sign-in
 *   (auth.protect in proxy.ts), API routes return 401 {"error":"Sign in
 *   required."}. Those cases need real Clerk keys — run them in a keyed env.
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const KEYED = !!process.env.CLERK_KEYED; // set when testing with real Clerk keys

test("app pages show setup notice (no redirect, no data) with zero keys", async ({
  page,
}) => {
  test.skip(KEYED, "zero-key behavior only");
  for (const p of ["/app", "/app/new", "/app/buildings", "/app/reports/anything"]) {
    const resp = await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
    expect(resp?.status(), p).toBe(200);
    await expect(page.getByText(/auth not configured/i).first()).toBeVisible();
  }
});

test("API routes gate correctly with zero keys", async ({ request }) => {
  test.skip(KEYED, "zero-key behavior only");

  const gated503 = [
    ["POST", "/api/analyze/start"],
    ["POST", "/api/analyze/run"],
    ["DELETE", "/api/reports/whatever"],
  ] as const;
  for (const [method, path] of gated503) {
    const r = await request.fetch(BASE + path, { method });
    expect(r.status(), `${method} ${path}`).toBe(503);
    expect(await r.json()).toMatchObject({
      error: "Authentication is not configured.",
    });
  }

  const r401 = await request.get(BASE + "/api/retention/cleanup");
  expect(r401.status()).toBe(401);

  const match = await request.get(BASE + "/api/buildings/match?hint=north");
  expect(match.status()).toBe(200);
  expect(await match.json()).toEqual({ buildings: [] });

  const credits = await request.get(BASE + "/api/me/credits");
  expect(credits.status()).toBe(200);
  expect(await credits.json()).toEqual({ enabled: false, balance: null });
});

test("with Clerk keys but no session, /app/* redirects to sign-in", async ({
  page,
}) => {
  test.skip(!KEYED, "needs real Clerk keys");
  const resp = await page.goto(BASE + "/app/new", { waitUntil: "domcontentloaded" });
  expect(resp?.status()).toBe(200);
  expect(page.url()).toContain("/sign-in");
});

test("with Clerk keys but no session, API routes return 401 JSON", async ({
  request,
}) => {
  test.skip(!KEYED, "needs real Clerk keys");
  const r = await request.post(BASE + "/api/analyze/start");
  expect(r.status()).toBe(401);
  expect(await r.json()).toMatchObject({ error: "Sign in required." });
});
