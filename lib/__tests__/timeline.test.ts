import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fundedPct,
  monthYearLabel,
  pointFromFacts,
  sortPoints,
  fundedDelta,
  type TimelinePoint,
} from "../timeline.ts";

describe("fundedPct", () => {
  it("computes balance / recommended as a percentage", () => {
    assert.equal(
      fundedPct({ reserve_balance_cad: 745000, reserve_recommended_cad: 1221000 }),
      (745000 / 1221000) * 100
    );
  });
  it("is null when either side is missing or recommendation is zero", () => {
    assert.equal(fundedPct({ reserve_balance_cad: null, reserve_recommended_cad: 100 }), null);
    assert.equal(fundedPct({ reserve_balance_cad: 50, reserve_recommended_cad: null }), null);
    assert.equal(fundedPct({ reserve_balance_cad: 50, reserve_recommended_cad: 0 }), null);
  });
});

describe("monthYearLabel", () => {
  it("formats YYYY-MM and YYYY-MM-DD", () => {
    assert.equal(monthYearLabel("2024-09", "x"), "Sep 2024");
    assert.equal(monthYearLabel("2026-10-15", "x"), "Oct 2026");
  });
  it("falls back on null or unparseable input", () => {
    assert.equal(monthYearLabel(null, "Earlier"), "Earlier");
    assert.equal(monthYearLabel("n/a", "Earlier"), "Earlier");
  });
});

describe("timeline points", () => {
  const older = pointFromFacts({
    facts: {
      reserve_balance_cad: 660000,
      reserve_recommended_cad: 1050000,
      insurance_deductible_cad: 25000,
    },
    docDate: "2024-09",
    exposureCad: null,
    fallbackLabel: "Earlier review",
    fallbackSortKey: "0",
  });
  const newer = pointFromFacts({
    facts: {
      reserve_balance_cad: 745000,
      reserve_recommended_cad: 1221000,
      insurance_deductible_cad: 100000,
    },
    docDate: "2026-10",
    exposureCad: 17940,
    fallbackLabel: "Latest review",
    fallbackSortKey: "1",
  });

  it("sorts oldest first regardless of input order", () => {
    const sorted = sortPoints([newer, older]);
    assert.equal(sorted[0].label, "Sep 2024");
    assert.equal(sorted[1].label, "Oct 2026");
  });

  it("computes funded delta in percentage points", () => {
    const sorted: TimelinePoint[] = sortPoints([newer, older]);
    assert.equal(fundedDelta(sorted, 0), null);
    const d = fundedDelta(sorted, 1);
    assert.ok(d != null && d < 0, "funded % fell between the sample reviews");
    assert.ok(Math.abs(d - (745000 / 1221000 - 660000 / 1050000) * 100) < 1e-9);
  });

  it("carries exposure and deductible through", () => {
    assert.equal(newer.exposureCad, 17940);
    assert.equal(newer.deductibleCad, 100000);
    assert.equal(older.exposureCad, null);
  });
});
