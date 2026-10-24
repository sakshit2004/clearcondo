import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

/**
 * The order desk for buyers: /order (no-login intake), order status by
 * ref code, and the print view. These run keyless — the intake
 * POST needs the database, so the spec covers rendering and client-side
 * behavior; persistence is covered by the service-order unit tests and
 * the schema.
 */

test("order page renders the service form with no sign-in", async ({ page }) => {
  const res = await page.goto(`${BASE}/order`);
  expect(res?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Send your condo documents" })
  ).toBeVisible();
  await expect(page.getByLabel(/Your name/)).toBeVisible();
  await expect(page.getByLabel(/Email for the finished report/)).toBeVisible();
  await expect(page.getByLabel(/Property address/)).toBeVisible();
  await expect(page.getByLabel(/document package \(PDFs\)/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send the package" })
  ).toBeVisible();
  await expect(page.getByText("Verified, or flagged")).toBeVisible();
  // Buyer-only: no brokerage field.
  await expect(page.getByLabel(/Brokerage/)).toHaveCount(0);
});

test("order form refuses to send without the package attached", async ({
  page,
}) => {
  await page.goto(`${BASE}/order`);
  await page.getByLabel(/Your name/).fill("Jordan Lee");
  await page
    .getByLabel(/Email for the finished report/)
    .fill("jordan@example.com");
  await page
    .getByLabel(/Property address/)
    .fill("Unit 506, 1234 North Hill Terrace NW, Calgary");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Send the package" }).click();
  await expect(
    page.getByText("Attach at least one PDF from the document package.")
  ).toBeVisible();
});

test("order status page handles an unknown ref code gracefully", async ({
  page,
}) => {
  const res = await page.goto(`${BASE}/order/CC-ZZZZZZ`);
  expect(res?.status()).toBe(200);
  await expect(page.getByText(/couldn't find CC-ZZZZZZ/)).toBeVisible();
});

test("order status page handles a malformed ref code gracefully", async ({
  page,
}) => {
  const res = await page.goto(`${BASE}/order/not-a-code`);
  expect(res?.status()).toBe(200);
  await expect(page.getByText(/couldn't find NOT-A-CODE/)).toBeVisible();
});

test("print view renders the report with no realtor cover", async ({
  page,
}) => {
  // The old ?for=/?brokerage= personalization is gone; the params are ignored.
  const res = await page.goto(
    `${BASE}/demo/print?for=Jordan%20Lee&brokerage=Century%2021%20Bamber`
  );
  expect(res?.status()).toBe(200);
  await expect(page.getByText("Prepared for")).toHaveCount(0);
  await expect(page.getByText(/Century 21 Bamber/)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "North Hill Terrace" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Verification audit trail" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Risk over time" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download PDF" })
  ).toBeVisible();
});

test("landing speaks to buyers and links the dashboard", async ({
  page,
}) => {
  await page.goto(`${BASE}/`);
  await expect(page.getByText("For condo buyers and owners")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Stop overpaying for your condo");
  await expect(page.getByText("Before you buy", { exact: true })).toBeVisible();
  await expect(page.getByText("After you buy", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The real price has three parts." })).toBeVisible();
  await expect(page.getByText(/realtors/i)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /traced to the page/ })
  ).toBeVisible();
  const cta = page
    .getByRole("link", { name: "Take me to dashboard" })
    .first();
  await expect(cta).toHaveAttribute("href", "/app");
});

test("Calgary lookup renders with no sign-in", async ({ page }) => {
  const res = await page.goto(`${BASE}/calgary`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("What will this condo really cost you?");
  await expect(page.getByRole("combobox", { name: /Street address or condo plan number/ })).toBeVisible();
});
