import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTrend,
  median,
  mergeYears,
  pickComparables,
  rollInWhere,
  similarityBasis,
  summarizeByYear,
  toUnitYearValues,
} from "../calgary/values.ts";
import { toRollUnits } from "../calgary/match.ts";

describe("historical values", () => {
  it("parses comma values, pads roll numbers, dedupes (roll, year)", () => {
    const vals = toUnitYearValues([
      { roll_number: "12345678", roll_year: "2022", assessed_value: "1,234,500" },
      { roll_number: "012345678", roll_year: "2022", assessed_value: "1,234,500" },
      { roll_number: "012345678", roll_year: "2023", assessed_value: "" },
    ]);
    assert.deepEqual(vals, [{ roll_number: "012345678", year: 2022, value: 1234500 }]);
  });

  it("summarizes totals and medians per year", () => {
    const s = summarizeByYear([
      { roll_number: "1", year: 2024, value: 100 },
      { roll_number: "2", year: 2024, value: 300 },
      { roll_number: "1", year: 2023, value: 90 },
    ]);
    assert.deepEqual(s, [
      { year: 2023, total: 90, median: 90, units: 1 },
      { year: 2024, total: 400, median: 200, units: 2 },
    ]);
  });

  it("history wins over current values for the same year", () => {
    const merged = mergeYears(
      [{ roll_number: "1", year: 2026, value: 100 }],
      [
        { roll_number: "1", year: 2026, value: 999 },
        { roll_number: "1", year: 2027, value: 110 },
      ]
    );
    assert.deepEqual(merged.map((m) => [m.year, m.value]), [[2026, 100], [2027, 110]]);
  });

  it("queries roll numbers with and without leading zeros", () => {
    assert.equal(rollInWhere(["012345678"]), "roll_number in ('012345678', '12345678')");
  });
});

describe("comparables", () => {
  const row = (roll: string, legal: string, value: string) => ({
    roll_number: roll, short_legal: legal, assessed_value: value, comm_code: "BLN", comm_name: "BELTLINE", sub_property_use: "R401",
  });
  const units = toRollUnits([
    row("1", "0812345;1", "300000"), row("2", "0812345;2", "300000"), row("3", "0812345;3", "300000"),
    row("4", "0900001;1", "200000"), row("5", "0900001;2", "220000"), row("6", "0900001;3", "240000"),
    row("7", "0900002;1", "500000"), row("8", "0900002;2", "500000"), row("9", "0900002;3", "500000"), row("10", "0900002;4", "500000"),
    row("11", "0900003;1", "100000"), // too small to be a building
  ]);

  it("excludes the target and tiny plans, closest unit count first", () => {
    const comps = pickComparables(units, "0812345", 3);
    assert.deepEqual(comps.map((c) => c.plan), ["0900001", "0900002"]);
    assert.equal(comps[0].median_current, 220000);
  });

  it("derives the community and dominant use code", () => {
    assert.deepEqual(similarityBasis(units), {
      comm_code: "BLN", comm_name: "BELTLINE", use_field: "sub_property_use", use_code: "R401",
    });
  });
});

describe("buildTrend", () => {
  it("compares % change from the building's base year", () => {
    const building = [
      { year: 2022, total: 1000, median: 100, units: 10 },
      { year: 2024, total: 1100, median: 110, units: 10 },
    ];
    const compA = [
      { year: 2022, total: 0, median: 200, units: 5 },
      { year: 2024, total: 0, median: 240, units: 5 },
    ];
    const compB = [{ year: 2024, total: 0, median: 300, units: 5 }]; // no base year -> ignored
    const t = buildTrend(building, [compA, compB]);
    assert.equal(t[0].building_change_pct, 0);
    assert.ok(Math.abs(t[1].building_change_pct! - 10) < 1e-9);
    assert.ok(Math.abs(t[1].comparables_change_pct! - 20) < 1e-9);
    assert.equal(t[1].comparables_count, 1);
  });

  it("is empty without building history, and median handles even counts", () => {
    assert.deepEqual(buildTrend([], []), []);
    assert.equal(median([1, 3, 2, 4]), 2.5);
  });
});
