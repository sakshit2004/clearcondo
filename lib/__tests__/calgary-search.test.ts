import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addressMatchScore,
  buildSearchQuery,
  groupCondoResults,
  isCondoLegal,
  nearbyCondoResults,
  searchCondoBuildings,
  splitCivic,
} from "../calgary/search.ts";
import { CityDataError } from "../calgary/socrata.ts";

const condo = (roll: string, legal: string, address: string) => ({
  roll_number: roll, short_legal: legal, address, comm_name: "BELTLINE", year_of_construction: "2008.0",
});

describe("isCondoLegal", () => {
  it("is true for plan;unit and false for plan;block;lot", () => {
    assert.equal(isCondoLegal("0812345;12"), true);
    assert.equal(isCondoLegal("7910655;17;15"), false); // real house row
    assert.equal(isCondoLegal("0812345"), false);
    assert.equal(isCondoLegal(null), false);
  });
});

describe("buildSearchQuery", () => {
  it("searches a plan-number input by plan", () => {
    const q = buildSearchQuery("081 2345");
    assert.equal(q?.kind, "plan");
    assert.equal(q?.where, "short_legal like '0812345;%'");
    assert.equal(buildSearchQuery("Plan 0812345")?.kind, "plan");
  });

  it("normalizes a street address and drops the unit", () => {
    assert.equal(buildSearchQuery("1111 6th Avenue SW, Calgary")?.where,
      "upper(address) like '%1111 6 AV SW%' AND short_legal like '%;%'");
    for (const input of ["#1203 1111 6 Ave SW", "1203-1111 6 Ave SW", "Unit 1203, 1111 6th Ave SW"]) {
      const q = buildSearchQuery(input);
      assert.ok(q?.kind === "address" && q.term === "1111 6 AV SW", `${input} -> ${q && "term" in q ? q.term : q}`);
    }
  });

  it("abbreviates a bare street name the roll's way", () => {
    const q = buildSearchQuery("Deermeade Bay SE");
    assert.ok(q?.kind === "address");
    assert.equal(q.term, "DEERMEADE BA SE");
    assert.equal((buildSearchQuery("point dr") as { term: string }).term, "POINT DR");
  });

  it("rejects too-short, too-long and quote-injection input safely", () => {
    assert.equal(buildSearchQuery("ab"), null);
    assert.equal(buildSearchQuery("x".repeat(81)), null);
    const q = buildSearchQuery("O'Brien Way' OR 1=1 --");
    assert.ok(q);
    assert.ok(!/'[^%]*' OR/.test(q.where.replace(/''/g, "")), "quotes are escaped, never closing the literal");
  });
});

describe("groupCondoResults", () => {
  it("groups condo units by plan, skips houses, biggest first", () => {
    const rows = [
      condo("1", "0812345;1", "101 1111 6 AV SW"),
      condo("2", "0812345;2", "102 1111 6 AV SW"),
      condo("3", "0812345;3", "103 1111 6 AV SW"),
      condo("4", "0954321;1", "1 1111 6 AV SW"),
      { roll_number: "150104206", short_legal: "7910655;17;15", address: "1111 6 AV SW", comm_name: "X" },
    ];
    const r = groupCondoResults(rows);
    assert.deepEqual(r.map((b) => [b.plan, b.units]), [["0812345", 3], ["0954321", 1]]);
    assert.deepEqual(r[0].addresses, ["1111 6 AV SW"]);
    assert.equal(r[0].community, "BELTLINE");
    assert.equal(r[0].year_built, 2008);
  });
});

describe("match ranking", () => {
  it("scores exact > prefix (incl. half-typed) > whole words > mid-word", () => {
    assert.equal(addressMatchScore("1111 6 AV SW", "1111 6 AV SW"), 3);
    assert.equal(addressMatchScore("1111 6 AV SW", "1111 6 A"), 2);
    assert.equal(addressMatchScore("16 DEERMEADE BA SE", "DEERMEADE"), 1);
    assert.equal(addressMatchScore("21111 6 AV SW", "1111 6 AV SW"), 0);
  });

  it("drops mid-word false positives and puts the exact building first", () => {
    const rows = [
      condo("1", "0954321;1", "1 21111 6 AV SW"), // LIKE hit, not a match
      condo("2", "0954321;2", "2 21111 6 AV SW"),
      condo("3", "0812345;1", "101 1111 6 AV SW"),
      condo("4", "0700001;1", "5 1111 6 AV SW NE PLAZA"),
    ];
    const r = groupCondoResults(rows, "1111 6 AV SW");
    assert.deepEqual(r.map((b) => [b.plan, b.match]), [["0812345", "exact"], ["0700001", "prefix"]]);
  });

  it("orders a building's addresses best match first", () => {
    const rows = [
      condo("1", "0812345;1", "1 1120 6 AV SW"),
      condo("2", "0812345;2", "2 1120 6 AV SW"),
      condo("3", "0812345;3", "3 1111 6 AV SW"),
    ];
    assert.deepEqual(groupCondoResults(rows, "1111 6 AV SW")[0].addresses, ["1111 6 AV SW", "1120 6 AV SW"]);
  });
});

describe("nearby fallback", () => {
  it("splits the civic number from the street", () => {
    assert.deepEqual(splitCivic("1111 6 AV SW"), { civic: 1111, street: "6 AV SW" });
    assert.equal(splitCivic("DEERMEADE BA SE"), null);
    assert.equal(splitCivic("1111 MAIN"), null, "needs at least street + type");
  });

  it("lists same-street buildings nearest civic number first, labelled nearby", () => {
    const rows = [
      condo("1", "0900001;1", "1 1300 6 AV SW"),
      condo("2", "0900002;1", "1 1120 6 AV SW"),
      condo("3", "0900003;1", "1 1120 16 AV SW"), // other street
    ];
    const r = nearbyCondoResults(rows, 1111, "6 AV SW");
    assert.deepEqual(r.map((b) => b.plan), ["0900002", "0900001"]);
    assert.ok(r.every((b) => b.match === "nearby"));
  });
});

describe("searchCondoBuildings", () => {
  it("falls back to the same street when the civic number has no condos", async () => {
    const urls: string[] = [];
    const fetchImpl = (async (u: RequestInfo | URL) => {
      const url = decodeURIComponent(String(u));
      urls.push(url);
      const rows = url.includes("% 6 AV SW%") ? [condo("9", "0900002;1", "1 1120 6 AV SW")] : [];
      return new Response(JSON.stringify(rows));
    }) as typeof fetch;
    const out = await searchCondoBuildings("1111 6 Ave SW", { fetchImpl });
    assert.equal(out?.nearbyStreet, "6 AV SW");
    assert.equal(out?.results[0].plan, "0900002");
    assert.equal(urls.length, 2);
  });

  it("queries the roll and returns grouped buildings", async () => {
    let url = "";
    const fetchImpl = (async (u: RequestInfo | URL) => {
      url = decodeURIComponent(String(u));
      return new Response(JSON.stringify([condo("1", "0812345;1", "101 1111 6 AV SW")]));
    }) as typeof fetch;
    const out = await searchCondoBuildings("1111 6 Ave SW", { fetchImpl });
    assert.equal(out?.results[0].plan, "0812345");
    assert.match(url, /4bsw-nn7w/);
    assert.match(url, /upper\(address\) like '%1111 6 AV SW%'/);
  });

  it("returns null for unusable input without calling the City", async () => {
    let called = false;
    const fetchImpl = (async () => { called = true; return new Response("[]"); }) as unknown as typeof fetch;
    assert.equal(await searchCondoBuildings("a", { fetchImpl }), null);
    assert.equal(called, false);
  });

  it("surfaces City failure as CityDataError", async () => {
    const fetchImpl = (async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    await assert.rejects(searchCondoBuildings("1111 6 Ave SW", { fetchImpl }), CityDataError);
  });
});
