import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractUnit, fetchUnitRecord, findUnit, normalizeUnitInput } from "../calgary/unit.ts";
import { toRollUnits } from "../calgary/match.ts";
import { CityDataError } from "../calgary/socrata.ts";
import { OWNER_PRICING, OwnerRequestSchema, annualSaving, ownerSavingsCut } from "../owner.ts";
import { ownerBuildingHref } from "../owner-links.ts";

describe("extractUnit", () => {
  it("reads the unit from the ways owners write it", () => {
    assert.equal(extractUnit("#1203 1111 6 Ave SW"), "1203");
    assert.equal(extractUnit("Unit 1203, 1111 6 Ave SW"), "1203");
    assert.equal(extractUnit("Suite 4B 1111 6 Ave SW"), "4B");
    assert.equal(extractUnit("1203-1111 6 Ave SW"), "1203");
    assert.equal(extractUnit("1203 1111 6 AV SW"), "1203");
  });
  it("returns null when there's no unit", () => {
    assert.equal(extractUnit("1111 6 Ave SW"), null);
    assert.equal(extractUnit("0812345"), null);
    assert.equal(extractUnit(""), null);
  });
});

describe("owner links", () => {
  it("keeps the unit in the building link", () => {
    assert.equal(ownerBuildingHref("0812345", "1203"), "/app/own/0812345?unit=1203");
    assert.equal(ownerBuildingHref("0812345", null), "/app/own/0812345");
  });
});

describe("owner pricing and savings", () => {
  it("is 30% of savings plus $10/month, free during beta", () => {
    assert.deepEqual(OWNER_PRICING, { feeShare: 0.3, filingFee: 20, freeDuringBeta: true });
  });
  it("hides the estimate unless a sane cut is configured", () => {
    const prev = process.env.OWNER_SAVINGS_CUT;
    try {
      delete process.env.OWNER_SAVINGS_CUT;
      assert.equal(ownerSavingsCut(), null);
      process.env.OWNER_SAVINGS_CUT = "abc";
      assert.equal(ownerSavingsCut(), null);
      process.env.OWNER_SAVINGS_CUT = "0.9";
      assert.equal(ownerSavingsCut(), null);
      process.env.OWNER_SAVINGS_CUT = "0.1"; // test value only
      assert.equal(ownerSavingsCut(), 0.1);
    } finally {
      if (prev === undefined) delete process.env.OWNER_SAVINGS_CUT;
      else process.env.OWNER_SAVINGS_CUT = prev;
    }
  });
  it("turns a value cut into one year of tax", () => {
    assert.equal(Math.round(annualSaving(400_000, 0.1)), 266); // 40,000 × 0.66499%
  });
});

describe("OwnerRequestSchema", () => {
  const base = { name: "Sam Owner", email: "sam@example.com", plan: "0812345", consent: true };
  it("accepts the minimum and drops blank optional fields", () => {
    const r = OwnerRequestSchema.parse({ ...base, phone: "", unit_size_sqft: "", notes: "  " });
    assert.equal(r.phone, undefined);
    assert.equal(r.unit_size_sqft, undefined);
    assert.equal(r.notes, undefined);
  });
  it("parses numbers from form strings", () => {
    const r = OwnerRequestSchema.parse({ ...base, unit_size_sqft: "720", bathrooms: "1.5" });
    assert.equal(r.unit_size_sqft, 720);
    assert.equal(r.bathrooms, 1.5);
  });
  it("rejects missing consent, bad email, bad plan and out-of-range numbers", () => {
    assert.equal(OwnerRequestSchema.safeParse({ ...base, consent: false }).success, false);
    assert.equal(OwnerRequestSchema.safeParse({ ...base, email: "nope" }).success, false);
    assert.equal(OwnerRequestSchema.safeParse({ ...base, plan: "08;DROP" }).success, false);
    assert.equal(OwnerRequestSchema.safeParse({ ...base, bedrooms: "-1" }).success, false);
  });
});

describe("fetchUnitRecord", () => {
  // Fictional rows in the City's dataset shapes.
  const roll = [
    { roll_number: "068123456", address: "1203 500 SAMPLE ST SW", assessed_value: "400000", roll_year: "2026", short_legal: "0812345;120" },
    { roll_number: "068123457", address: "12030 500 SAMPLE ST SW", assessed_value: "1", roll_year: "2026", short_legal: "0812345;121" },
  ];
  const hist = [
    { roll_number: "68123456", roll_year: "2025", assessed_value: "380000.0" },
    { roll_number: "68123456", roll_year: "2024", assessed_value: "370000" },
  ];
  const arb = [{ year: "2024", location_address: "1203 500 SAMPLE ST SW", status: "Mutual Agreement", board_s_decision: "" }];
  const fake = (fail?: string): typeof fetch => (async (url: string | URL) => {
    const u = String(url);
    const id = u.match(/resource\/([a-z0-9-]+)\.json/)?.[1] ?? "";
    if (fail && id === fail) return new Response("err", { status: 500 });
    const where = new URL(u).searchParams.get("$where") ?? "";
    assert.equal(id !== "4bsw-nn7w" || where === "short_legal like '0812345;%'", true);
    const body = id === "4bsw-nn7w" ? roll : id === "4ur7-wsgc" ? hist : arb;
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;

  it("finds the unit, last year's value and its complaints", async () => {
    const r = await fetchUnitRecord("0812345", "1203", { fetchImpl: fake() });
    assert.ok(r);
    assert.equal(r.address, "1203 500 SAMPLE ST SW");
    assert.equal(r.assessed_value, 400000);
    assert.equal(r.prev_year, 2025);
    assert.equal(r.prev_value, 380000);
    assert.ok(Math.abs((r.change ?? 0) - (400000 / 380000 - 1)) < 1e-9);
    assert.deepEqual(r.complaints, [{ year: 2024, filed: 1, settled_or_decreased: 1, other: 0 }]);
  });
  it("never queries an unsafe unit", async () => {
    let called = false;
    const f = (async () => ((called = true), new Response("[]"))) as unknown as typeof fetch;
    assert.equal(await fetchUnitRecord("0812345", "1' OR '1", { fetchImpl: f }), null);
    assert.equal(called, false);
  });
  it("degrades history and complaints, but throws if the roll fails", async () => {
    const r = await fetchUnitRecord("0812345", "1203", { fetchImpl: fake("myiv-ju9n") });
    assert.equal(r?.complaints, null);
    await assert.rejects(fetchUnitRecord("0812345", "1203", { fetchImpl: fake("4bsw-nn7w") }), CityDataError);
  });
});

describe("findUnit", () => {
  const units = toRollUnits([
    { roll_number: "1", address: "303 500 SAMPLE ST SW", short_legal: "0812345;3" },
    { roll_number: "2", address: "3030 500 SAMPLE ST SW", short_legal: "0812345;4" },
    { roll_number: "3", address: "12V 500 SAMPLE ST SW", short_legal: "0812345;5" },
  ]);
  it("matches the unit at the start of the roll address", () => {
    assert.equal(findUnit(units, "303")?.roll_number, "000000001");
    assert.equal(findUnit(units, "3030")?.roll_number, "000000002");
  });
  it("treats leading zeros as the same unit", () => {
    assert.equal(findUnit(units, "0303")?.roll_number, "000000001");
  });
  it("returns null when the unit isn't there", () => {
    assert.equal(findUnit(units, "999"), null);
  });
});

describe("normalizeUnitInput", () => {
  it("reads a typed unit field the way the roll writes it", () => {
    assert.equal(normalizeUnitInput("1203"), "1203");
    assert.equal(normalizeUnitInput("#1203"), "1203");
    assert.equal(normalizeUnitInput("Unit 1203"), "1203");
    assert.equal(normalizeUnitInput("unit #1203"), "1203");
    assert.equal(normalizeUnitInput("Suite 4b"), "4B");
    assert.equal(normalizeUnitInput("  "), null);
    assert.equal(normalizeUnitInput(undefined), null);
  });
});
