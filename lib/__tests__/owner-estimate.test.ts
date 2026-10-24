import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dateProblem, estimateSaving, median, monthsBetween } from "../owner-estimate.ts";
import { CALGARY_RES_TAX_RATE_2026 } from "../calgary/appeals.ts";
import { OwnerRequestSchema } from "../owner.ts";

describe("dates", () => {
  it("counts months", () => {
    assert.equal(monthsBetween("2025-07", "2025-07"), 0);
    assert.equal(monthsBetween("2025-07", "2024-01"), -18);
    assert.equal(monthsBetween("2025-07", "bad"), null);
  });
  it("accepts evidence near the July 2025 valuation date", () => {
    assert.equal(dateProblem("2025-03", true), null);
    assert.equal(dateProblem("2023-07", true), null); // 24 months before
    assert.equal(dateProblem("2026-01", true), null); // 6 months after
    assert.match(dateProblem("2023-06", true)!, /too long before/);
    assert.match(dateProblem("2026-02", true)!, /too long after/);
    assert.match(dateProblem(undefined, true)!, /add the month/);
    assert.equal(dateProblem(undefined, false), null);
  });
  it("takes the middle value", () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([1, 2, 3, 4]), 2.5);
  });
});

describe("estimateSaving", () => {
  it("needs evidence", () => {
    const e = estimateSaving({ assessed_value: 400_000 });
    assert.equal(e.status, "not_enough");
    assert.equal(e.annual_saving, null);
  });

  it("works a saving through from a purchase", () => {
    const e = estimateSaving({ assessed_value: 400_000, purchase_price: 370_000, purchase_date: "2025-04" });
    assert.equal(e.status, "saving");
    assert.equal(e.indicated_value, 370_000);
    assert.equal(e.difference, 30_000);
    assert.equal(e.annual_saving, Math.round(30_000 * CALGARY_RES_TAX_RATE_2026)); // 199
    assert.equal(e.fee, Math.round(30_000 * CALGARY_RES_TAX_RATE_2026 * 0.3));
  });

  it("prices similar sales per square foot", () => {
    const e = estimateSaving({
      assessed_value: 412_000,
      unit_size_sqft: 700,
      comparables: [
        { price: 350_000, sqft: 700, date: "2025-05" }, // $500
        { price: 330_000, sqft: 600 }, // $550
        { price: 450_000, sqft: 1000, date: "2025-08" }, // $450
      ],
    });
    assert.equal(e.indicators[0].value, 350_000); // median $500 × 700
    assert.equal(e.status, "saving");
    assert.equal(e.difference, 62_000);
  });

  it("uses the middle of several indicators", () => {
    const e = estimateSaving({
      assessed_value: 400_000,
      unit_size_sqft: 700,
      purchase_price: 380_000,
      purchase_date: "2025-01",
      appraisal_value: 395_000,
      appraisal_date: "2025-06",
      comparables: [{ price: 350_000, sqft: 700 }],
    });
    assert.equal(e.indicators.length, 3);
    assert.equal(e.indicated_value, 380_000);
  });

  it("says so when the evidence is at or above the City value", () => {
    const e = estimateSaving({ assessed_value: 400_000, appraisal_value: 420_000, appraisal_date: "2025-07" });
    assert.equal(e.status, "no_saving");
    assert.equal(e.annual_saving, null);
  });

  it("explains evidence it can't use", () => {
    const e = estimateSaving({
      assessed_value: 400_000,
      purchase_price: 300_000,
      purchase_date: "2019-05",
      comparables: [{ price: 350_000, sqft: 700 }],
    });
    assert.equal(e.status, "not_enough");
    assert.deepEqual(
      e.skipped.map((s) => s.source),
      ["purchase", "comparables"]
    );
    assert.match(e.skipped[1].reason, /unit's size/);
  });

  it("leaves out incomplete or out-of-window sales", () => {
    const e = estimateSaving({
      assessed_value: 400_000,
      unit_size_sqft: 700,
      comparables: [{ price: 350_000, sqft: 700 }, { price: 300_000 }, { price: 340_000, sqft: 700, date: "2021-01" }],
    });
    assert.equal(e.indicators[0].detail, "median $500/sq ft from 1 sale × 700 sq ft");
    assert.match(e.skipped[0].reason, /2 sales left out/);
  });
});

describe("OwnerRequestSchema evidence", () => {
  const base = { name: "Sam Owner", email: "sam@example.com", plan: "0812345", consent: true };
  it("accepts months and comparables", () => {
    const r = OwnerRequestSchema.parse({
      ...base,
      purchase_price: "385000",
      purchase_date: "2025-03",
      comparables: [{ price: 350000, sqft: "700", date: "" }],
      assessed_value: 412000,
    });
    assert.equal(r.purchase_price, 385000);
    assert.deepEqual(r.comparables, [{ price: 350000, sqft: 700, date: undefined }]);
  });
  it("rejects a bad month and too many comparables", () => {
    assert.equal(OwnerRequestSchema.safeParse({ ...base, purchase_date: "March" }).success, false);
    assert.equal(OwnerRequestSchema.safeParse({ ...base, comparables: Array(6).fill({}) }).success, false);
  });
});
