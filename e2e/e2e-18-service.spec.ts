import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

/**
 * The service front door: /order (no-login intake), order status by ref
 * code, and the client-ready print view. These run keyless — the intake
 * POST needs the database, so the spec covers rendering and client-side
 * behavior; persistence is covered by the service-order unit tests and
 * the schema.
 */

test("order page renders the service form with no sign-in", async ({ page }) => {
  const res = await page.goto(`${BASE}/order`);
  expect(res?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Send a document package" })
  ).toBeVisible();
  await expect(page.getByLabel(/Your name/)).toBeVisible();
  await expect(page.getByLabel(/Email for the finished report/)).toBeVisible();
  await expect(page.getByLabel(/Property address/)).toBeVisible();
  await expect(page.getByLabel(/document package \(PDFs\)/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send the package" })
  ).toBeVisible();
  await expect(page.getByText("Verified, or flagged")).toBeVisible();
});

test("order form refuses to send without the package attached", async ({
  page,
}) => {
  await page.goto(`${BASE}/order`);
  await page.getByLabel(/Your name/).fill("Jordan Lee");
  await page
    .getByLabel(/Email for the finished report/)
    .fill("jordan@brokerage.ca");
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

test("print view renders the client-ready report with a prepared-for cover", async ({
  page,
}) => {
  const res = await page.goto(
    `${BASE}/demo/print?for=Jordan%20Lee&brokerage=Century%2021%20Bamber`
  );
  expect(res?.status()).toBe(200);
  await expect(page.getByText("Prepared for")).toBeVisible();
  await expect(page.getByText(/Jordan Lee/)).toBeVisible();
  await expect(page.getByText(/Century 21 Bamber/)).toBeVisible();
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

test("landing leads with the service framing and links the dashboard", async ({
  page,
}) => {
  await page.goto(`${BASE}/`);
  await expect(
    page.getByRole("heading", { name: /traced to the page/ })
  ).toBeVisible();
  const cta = page
    .getByRole("link", { name: "Send a document package" })
    .first();
  await expect(cta).toHaveAttribute("href", "/app");
});
