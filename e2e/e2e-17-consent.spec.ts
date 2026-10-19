/**
 * DRAFT — check 17: upload consent checkbox.
 *
 * UI (components/UploadForm.tsx): the Analyze button is
 * `disabled={busy || files.length === 0 || !consent}` (line 538) and the
 * submit handler returns early `if (files.length === 0 || !consent)` (line 131).
 * Server: POST /api/analyze/start -> 400 "Upload consent is required. …"
 * when form field `consent` is missing/not "true" (route.ts); POST
 * /api/analyze/run -> 400 "Upload consent is required." when body.consent is
 * missing/not true. hasUploadConsent accepts only `true` / `"true"`
 * (lib/retention.ts) — covered by lib/__tests__/retention.test.ts.
 *
 * The UI test needs real Clerk keys (zero-key deployments render SetupNotice
 * instead of the form). The API 400 tests need an authenticated session.
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const KEYED = !!process.env.CLERK_KEYED;

test("analyze button stays disabled until the consent box is checked", async ({
  page,
}) => {
  test.skip(!KEYED, "needs real Clerk keys for the upload form");
  await page.goto(BASE + "/app/new", { waitUntil: "networkidle" });
  const button = page.getByRole("button", { name: /analyz/i });
  await expect(button).toBeDisabled();
  // (Attach a real PDF via setInputFiles here in a keyed env.)
  await page.getByRole("checkbox", { name: /consent/i }).check();
  // still disabled with no files:
  await expect(button).toBeDisabled();
});

test("POST /api/analyze/start without consent -> 400", async ({ request }) => {
  test.skip(!KEYED, "needs an authenticated session");
  const form = new FormData();
  form.append("files", new Blob(["%PDF-1.4 fake"], { type: "application/pdf" }), "x.pdf");
  const r = await request.post(BASE + "/api/analyze/start", { multipart: form });
  expect(r.status()).toBe(400);
  expect(await r.json()).toMatchObject({ error: expect.stringContaining("consent") });
});

test("POST /api/analyze/run without consent -> 400", async ({ request }) => {
  test.skip(!KEYED, "needs an authenticated session");
  const r = await request.post(BASE + "/api/analyze/run", {
    data: { docs: [], consent: false },
  });
  expect(r.status()).toBe(400);
});
