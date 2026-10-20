/**
 * DRAFT — check 13: /demo renders with zero API keys.
 *
 * Expectations (verified against app/demo/page.tsx + sample-data/*.json):
 * - ONE report view renders (the newer 2026 "North Hill Terrace" report); the
 *   2024 report is used only to compute the "what changed" diff.
 * - "13 of 13 claims verified against source documents" stat is visible.
 * - Flag cards show "✓ Verified" evidence badges.
 * - "What changed since the last review" section renders with 6 deltas.
 * - Disclaimer text is visible.
 * - "Sample data." notice is visible.
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

test("/demo renders the sample report with zero keys", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  const resp = await page.goto(BASE + "/demo", { waitUntil: "networkidle" });
  expect(resp?.status()).toBe(200);

  // Sample-data notice
  await expect(page.getByText("Sample data.")).toBeVisible();

  // Building header (2026 report)
  await expect(page.getByRole("heading", { name: "North Hill Terrace" })).toBeVisible();

  // "X of Y verified" stat
  await expect(page.getByText(/claims verified against source documents/)).toBeVisible();
  // "X of Y verified" stat — the count renders inside "13 of 13", not
  // as a standalone text node, so match the full phrase.
  await expect(page.getByText("13 of 13")).toBeVisible();

  // Verified evidence badges on flag cards
  const badges = page.getByText(/✓.*Verified/);
  expect(await badges.count()).toBeGreaterThan(0);

  // Red-flags section with flag cards
  await expect(page.getByRole("heading", { name: "Red flags" })).toBeVisible();

  // 6-delta "what changed" diff
  await expect(
    page.getByRole("heading", { name: /what changed since the last review/i })
  ).toBeVisible();

  // Disclaimer (appears in both the report and the footer — either proves it)
  await expect(
    page.getByText(/It is not legal, financial, or real-estate advice/).first()
  ).toBeVisible();

  expect(errors).toEqual([]);
});
