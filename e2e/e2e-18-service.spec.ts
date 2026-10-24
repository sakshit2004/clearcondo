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

test("landing is generic and splits into buyers and owners", async ({ page }) => {
  await page.goto(`${BASE}/`);
  await expect(page.getByText("For condo buyers and owners")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Stop overpaying for your condo");
  await expect(page.getByRole("heading", { name: "Two ways to stop overpaying." })).toBeVisible();
  await expect(page.getByText("Buying a condo", { exact: true })).toBeVisible();
  await expect(page.getByText("Owning a condo", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /ClearCondo for buyers/ }).first()).toHaveAttribute("href", "/buyers");
  await expect(page.getByRole("link", { name: /ClearCondo for owners/ }).first()).toHaveAttribute("href", "/owners");
  await expect(page.getByText(/30% of the saving, plus \$10\/month/)).toBeVisible();
  await expect(page.getByRole("link", { name: /I'm buying a condo/ }).first()).toHaveAttribute("href", "/buyers");
  await expect(page.getByRole("link", { name: /I own a condo/ }).first()).toHaveAttribute("href", "/owners");
  // Header buttons go straight to each dashboard.
  const header = page.locator("header");
  await expect(header.getByRole("link", { name: /buy/i })).toHaveAttribute("href", "/app");
  await expect(header.getByRole("link", { name: /own/i })).toHaveAttribute("href", "/app/own");
  const roadmap = page.getByRole("list", { name: "Where ClearCondo goes next" });
  await expect(roadmap.getByRole("heading", { name: "Condos" })).toBeVisible();
  await expect(roadmap.getByRole("heading", { name: "Houses" })).toBeVisible();
  await expect(roadmap.getByRole("heading", { name: "Land" })).toBeVisible();
  await expect(page.getByText(/realtors/i)).toHaveCount(0);
});

test("buyers page: buyer-only content, dashboard link, switch to owners", async ({ page }) => {
  const res = await page.goto(`${BASE}/buyers`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Know the real price");
  await expect(page.getByRole("link", { name: /Open the buyer dashboard/ })).toHaveAttribute("href", "/app");
  await expect(page.getByRole("heading", { name: /traced to the page/ })).toBeVisible();
  await expect(page.getByText(/property tax/i)).toHaveCount(1); // only the switch band
  await expect(page.getByRole("link", { name: /ClearCondo for owners/ })).toHaveAttribute("href", "/owners");
});

test("owners page: owner-only content, dashboard link, switch to buyers", async ({ page }) => {
  const res = await page.goto(`${BASE}/owners`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("paying too much property tax");
  await expect(page.getByRole("link", { name: /Open the owner dashboard/ })).toHaveAttribute("href", "/app/own");
  await expect(page.getByRole("link", { name: "See a sample report" })).toHaveAttribute("href", "/demo/own");
  await expect(page.getByRole("heading", { name: "You only pay if you save." })).toBeVisible();
  await expect(page.getByRole("link", { name: /ClearCondo for buyers/ })).toHaveAttribute("href", "/buyers");
});

test("owner pages sit behind sign-in; old public links redirect", async ({ request }) => {
  for (const [from, to] of [
    ["/own", "/owners"],
    ["/calgary", "/app/own"],
    ["/calgary/0812345", "/app/own/0812345"],
  ]) {
    const res = await request.get(`${BASE}${from}`, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(new URL(res.headers()["location"], BASE).pathname).toBe(to);
  }
});

test("owner estimate requests need sign-in", async ({ request }) => {
  const res = await request.post(`${BASE}/api/owner-requests`, { data: {} });
  expect([401, 503]).toContain(res.status());
});

test("owner sample report is public and linked from the owning box", async ({ page }) => {
  await page.goto(`${BASE}/`);
  const links = page.getByRole("link", { name: "See a sample report" });
  await expect(links).toHaveCount(2);
  await expect(links.nth(1)).toHaveAttribute("href", "/demo/own");
  const res = await page.goto(`${BASE}/demo/own`);
  expect(res?.status()).toBe(200);
  await expect(page.getByText("Sample data", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your savings estimate" })).toBeVisible();
});
