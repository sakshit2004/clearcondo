import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calgaryScope,
  decideAddressMatch,
  decidePlanMatch,
  extractPlanNumbers,
  matchBuilding,
  normalizePlanNumber,
  normalizeStreetAddress,
  planPrefix,
  stripUnitFromRollAddress,
  toRollUnits,
} from "../calgary/match.ts";
import { CityDataError, normalizeRollNumber, parseMoney } from "../calgary/socrata.ts";

function rollRow(roll: string, shortLegal: string, address: string, value = "350000") {
  return {
    roll_number: roll,
    short_legal: shortLegal,
    address,
    assessed_value: value,
    assessment_class: "RE",
    sub_property_use: "R401",
    comm_code: "BLN",
    comm_name: "BELTLINE",
  };
}

/** Fake fetch that answers every request with `rows`, recording URLs. */
function fakeFetch(handler: (url: string) => unknown[] | Error) {
  const urls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    const out = handler(decodeURIComponent(url));
    if (out instanceof Error) throw out;
    return new Response(JSON.stringify(out), { status: 200 });
  }) as typeof fetch;
  return { impl, urls };
}

describe("plan numbers", () => {
  it("normalizes spacing, dashes and prefixes", () => {
    assert.equal(normalizePlanNumber("081 2345"), "0812345");
    assert.equal(normalizePlanNumber("Plan No. 0812345"), "0812345");
    assert.equal(normalizePlanNumber("081-2345"), "0812345");
    assert.equal(normalizePlanNumber("abc"), null);
    assert.equal(normalizePlanNumber("12"), null);
  });

  it("takes the short_legal prefix before ';'", () => {
    assert.equal(planPrefix("0812345;12"), "0812345");
    assert.equal(planPrefix(" 0812345 ;7"), "0812345");
    assert.equal(planPrefix("0812345"), null, "no ';' means not a condo unit legal");
  });

  it("extracts plan numbers stated in document text", () => {
    const texts = [
      "Condominium Plan No. 081 2345 (the \"Corporation\")",
      "registered as condominium plan 0812345 dated 2008",
      "Condo Plan: 9910111 and parking",
    ];
    assert.deepEqual(extractPlanNumbers(texts), ["0812345", "9910111"]);
  });
});

describe("addresses", () => {
  it("normalizes to the roll's style", () => {
    assert.equal(normalizeStreetAddress("1111 6th Avenue S.W., Calgary, Alberta T2P 0X1"), "1111 6 AV SW");
    assert.equal(normalizeStreetAddress("#1203, 1111 6 Ave SW"), "1111 6 AV SW");
    assert.equal(normalizeStreetAddress("Unit 1203 - 1111 6 Ave Southwest"), "1111 6 AV SW");
    assert.equal(normalizeStreetAddress("1203-1111 6 AVE SW, Calgary"), "1111 6 AV SW");
    assert.equal(normalizeStreetAddress("North Hill Terrace"), null);
  });

  it("strips a leading unit number from roll addresses", () => {
    assert.equal(stripUnitFromRollAddress("1203 1111 6 AV SW"), "1111 6 AV SW");
    assert.equal(stripUnitFromRollAddress("1111 6 AV SW"), "1111 6 AV SW");
  });

  it("scopes addresses to Calgary", () => {
    assert.equal(calgaryScope("1111 6 Ave SW, Calgary, AB"), "calgary");
    assert.equal(calgaryScope("1111 6 Ave SW T2P 0X1"), "calgary");
    assert.equal(calgaryScope("10123 99 St, Edmonton, AB"), "outside");
    assert.equal(calgaryScope("10123 99 St T5J 1A1"), "outside");
    assert.equal(calgaryScope("1111 6 Ave SW"), "unknown");
  });
});

describe("decidePlanMatch", () => {
  const units = toRollUnits([
    rollRow("201000001", "0812345;1", "101 1111 6 AV SW"),
    rollRow("201000002", "0812345;2", "102 1111 6 AV SW"),
    rollRow("201000002", "0812345;2", "102 1111 6 AV SW"), // roll duplicate
    rollRow("201000003", "08123456;1", "1 999 9 AV SW"), // longer plan sharing a prefix
  ]);

  it("matches rows whose prefix equals the plan exactly", () => {
    const d = decidePlanMatch(["0812345"], units);
    assert.equal(d.matched, true);
    if (d.matched) {
      assert.equal(d.plan, "0812345");
      assert.equal(d.method, "plan_number");
      assert.deepEqual(d.units.map((u) => u.roll_number), ["201000001", "201000002"]);
    }
  });

  it("is a no-match when no rows carry the plan", () => {
    const d = decidePlanMatch(["0999999"], units);
    assert.equal(d.matched, false);
  });

  it("refuses to pick when two document plans both hit the roll", () => {
    const d = decidePlanMatch(["0812345", "08123456"], units);
    assert.equal(d.matched, false);
    if (!d.matched) assert.match(d.reason, /more than one/);
  });
});

describe("decideAddressMatch", () => {
  it("accepts an address only when it maps to one plan", () => {
    const one = toRollUnits([
      rollRow("1", "0812345;1", "101 1111 6 AV SW"),
      rollRow("2", "0812345;2", "102 1111 6 AV SW"),
    ]);
    const d = decideAddressMatch("1111 6 AV SW", one);
    assert.equal(d.matched, true);
    if (d.matched) assert.equal(d.plan, "0812345");
  });

  it("is a no-match when two plans share the address", () => {
    const two = toRollUnits([
      rollRow("1", "0812345;1", "101 1111 6 AV SW"),
      rollRow("2", "0954321;1", "201 1111 6 AV SW"),
    ]);
    const d = decideAddressMatch("1111 6 AV SW", two);
    assert.equal(d.matched, false);
  });

  it("does not match a different civic number that ends the same", () => {
    const other = toRollUnits([rollRow("1", "0812345;1", "101 21111 6 AV SW")]);
    assert.equal(decideAddressMatch("1111 6 AV SW", other).matched, false);
  });
});

describe("matchBuilding (network)", () => {
  it("matches on plan number with one roll query", async () => {
    const { impl, urls } = fakeFetch(() => [
      rollRow("201000001", "0812345;1", "101 1111 6 AV SW"),
      rollRow("201000002", "0812345;2", "102 1111 6 AV SW"),
    ]);
    const d = await matchBuilding({ planCandidates: ["081 2345"], address: null }, { fetchImpl: impl });
    assert.equal(d.matched, true);
    assert.equal(urls.length, 1);
    assert.match(decodeURIComponent(urls[0]), /short_legal like '0812345;%'/);
  });

  it("falls back to the address for Calgary addresses", async () => {
    const { impl, urls } = fakeFetch((url) =>
      url.includes("upper(address)") || url.includes("0812345")
        ? [rollRow("1", "0812345;1", "101 1111 6 AV SW"), rollRow("2", "0812345;2", "102 1111 6 AV SW")]
        : []
    );
    const d = await matchBuilding(
      { planCandidates: [], address: "1111 6th Avenue SW, Calgary" },
      { fetchImpl: impl }
    );
    assert.equal(d.matched, true);
    if (d.matched) {
      assert.equal(d.method, "address");
      assert.equal(d.units.length, 2);
    }
    assert.equal(urls.length, 2, "address lookup, then the whole plan");
  });

  it("returns a no-match (never a guess) when nothing matches", async () => {
    const { impl } = fakeFetch(() => []);
    const d = await matchBuilding(
      { planCandidates: ["0999999"], address: "1111 6 Ave SW, Calgary" },
      { fetchImpl: impl }
    );
    assert.equal(d.matched, false);
    assert.deepEqual(d.tried, ["condo plan 0999999", "address 1111 6 AV SW"]);
  });

  it("does not use a non-Calgary address", async () => {
    const { impl, urls } = fakeFetch(() => []);
    const d = await matchBuilding(
      { planCandidates: [], address: "10123 99 St, Edmonton, AB" },
      { fetchImpl: impl }
    );
    assert.equal(d.matched, false);
    assert.equal(urls.length, 0);
  });

  it("throws CityDataError when the API fails", async () => {
    const { impl } = fakeFetch(() => new Error("ECONNRESET"));
    await assert.rejects(
      matchBuilding({ planCandidates: ["0812345"], address: null }, { fetchImpl: impl }),
      CityDataError
    );
  });
});

describe("socrata helpers", () => {
  it("parses comma-formatted historical values", () => {
    assert.equal(parseMoney("1,234,500"), 1234500);
    assert.equal(parseMoney("$350,000.00"), 350000);
    assert.equal(parseMoney(""), null);
    assert.equal(parseMoney(null), null);
  });
  it("pads roll numbers to 9 digits", () => {
    assert.equal(normalizeRollNumber("12345678"), "012345678");
    assert.equal(normalizeRollNumber(123456789), "123456789");
  });
});
