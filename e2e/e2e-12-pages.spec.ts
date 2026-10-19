/**
 * DRAFT — check 12: landing page loads, every link returns 200, no console errors.
 *
 * Setup: `npm i -D @playwright/test` then `npx playwright install chromium`.
 * Run: `BASE_URL=http://localhost:3000 npx playwright test drafts/e2e-12-pages.spec.ts`
 * (BASE_URL defaults to http://localhost:3000)
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

test("landing page loads with 200 and no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  const resp = await page.goto(BASE + "/", { waitUntil: "networkidle" });
  expect(resp?.status()).toBe(200);
  await expect(page).toHaveTitle(/ClearCondo/);
  // Brand + primary CTAs visible (exact name: the hero also has a
  // "See a sample report" link, so a fuzzy match hits two elements)
  await expect(
    page.getByRole("link", { name: "Sample report", exact: true })
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("every link on the landing page returns 200", async ({ page, request }) => {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const hrefs = await page.$$eval("a[href]", (els) =>
    els.map((e) => (e as HTMLAnchorElement).getAttribute("href")).filter(Boolean)
  );
  const internal = [...new Set(hrefs)].filter(
    (h): h is string => !!h && h.startsWith("/") && !h.startsWith("//")
  );
  expect(internal.length).toBeGreaterThan(0);
  for (const h of internal) {
    const r = await request.get(BASE + h);
    expect(r.status(), `link ${h} should return 200`).toBe(200);
  }
});

test("known public routes all return 200", async ({ request }) => {
  for (const p of ["/", "/demo", "/privacy", "/sign-in", "/sign-up", "/favicon.ico"]) {
    const r = await request.get(BASE + p);
    expect(r.status(), p).toBe(200);
  }
});
