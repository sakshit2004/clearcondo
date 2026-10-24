import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CACHE_TTL_MS,
  assessReport,
  fetchCityRecords,
  getCityRecords,
  memoryCache,
  type CityRecords,
} from "../calgary/check.ts";

const NOW = new Date("2026-10-24T12:00:00Z");

const unit = (roll: string, legal: string, address: string, value: string) => ({
  roll_number: roll, short_legal: legal, address, assessed_value: value, roll_year: "2026",
  assessment_class: "RE", sub_property_use: "R401", comm_code: "BLN", comm_name: "BELTLINE",
  year_of_construction: "2008",
});

const TARGET = [
  unit("201000001", "0812345;1", "101 1111 6 AV SW", "300000"),
  unit("201000002", "0812345;2", "102 1111 6 AV SW", "320000"),
  unit("201000003", "0812345;3", "103 1111 6 AV SW", "340000"),
];
const COMPS = [
  ...TARGET,
  unit("300000001", "0900001;1", "1 500 9 AV SW", "200000"),
  unit("300000002", "0900001;2", "2 500 9 AV SW", "200000"),
  unit("300000003", "0900001;3", "3 500 9 AV SW", "200000"),
];
const HISTORY = [
  { roll_number: "201000001", roll_year: "2022", assessed_value: "250,000" },
  { roll_number: "201000002", roll_year: "2022", assessed_value: "270,000" },
  { roll_number: "201000003", roll_year: "2022", assessed_value: "290,000" },
  { roll_number: "300000001", roll_year: "2022", assessed_value: "180,000" },
  { roll_number: "300000002", roll_year: "2022", assessed_value: "180,000" },
  { roll_number: "300000003", roll_year: "2022", assessed_value: "180,000" },
];
const PERMITS = [
  {
    permitnum: "BP2024-01234", originaladdress: "1111 6 AV SW", issueddate: "2024-05-10T00:00:00.000",
    description: "Parkade membrane replacement and slab repair", estprojectcost: "850000",
  },
  {
    permitnum: "BP2023-00777", originaladdress: "1111 6 AV SW", issueddate: "2023-02-01T00:00:00.000",
    description: "Re-roof", estprojectcost: "200000",
  },
];

type Route = "roll" | "comps" | "history" | "permits";

/** Fake City API, routed by dataset + query; `fail` makes routes error. */
function cityApi(fail: Partial<Record<Route, boolean>> = {}) {
  const calls: Route[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = decodeURIComponent(String(input));
    let route: Route;
    let rows: unknown[];
    if (url.includes("c2es-76ed")) [route, rows] = ["permits", PERMITS];
    else if (url.includes("4ur7-wsgc")) [route, rows] = ["history", HISTORY];
    else if (url.includes("comm_code =")) [route, rows] = ["comps", COMPS];
    else [route, rows] = ["roll", url.includes("0812345") ? TARGET : []];
    calls.push(route);
    if (fail[route]) return new Response("boom", { status: 500 });
    return new Response(JSON.stringify(rows), { status: 200 });
  }) as typeof fetch;
  return { impl, calls };
}

describe("fetchCityRecords", () => {
  it("assembles roll match, value trend and permits", async () => {
    const { impl } = cityApi();
    const r = await fetchCityRecords({ planCandidates: ["0812345"], address: null }, NOW, { fetchImpl: impl });
    assert.equal(r.status, "matched");
    if (r.status !== "matched") return;
    assert.equal(r.unit_count, 3);
    assert.deepEqual(r.building_addresses, ["1111 6 AV SW"]);
    assert.match(r.roll_query_url, /4bsw-nn7w/);
    assert.equal(r.values.status, "ok");
    if (r.values.status === "ok") {
      assert.deepEqual(r.values.trend.map((t) => t.year), [2022, 2026]);
      assert.equal(r.values.trend[1].building_total, 960000);
      assert.equal(r.values.comparables.length, 1);
      assert.ok(r.values.trend[1].comparables_change_pct! > 0);
    }
    assert.equal(r.permits.status, "ok");
    if (r.permits.status === "ok") {
      assert.deepEqual(r.permits.items.map((p) => p.permit_number), ["BP2024-01234", "BP2023-00777"]);
    }
  });

  it("is 'unavailable' when the roll API fails", async () => {
    const { impl } = cityApi({ roll: true });
    const r = await fetchCityRecords({ planCandidates: ["0812345"], address: null }, NOW, { fetchImpl: impl });
    assert.equal(r.status, "unavailable");
  });

  it("degrades one subsection at a time", async () => {
    const { impl } = cityApi({ permits: true, comps: true });
    const r = await fetchCityRecords({ planCandidates: ["0812345"], address: null }, NOW, { fetchImpl: impl });
    assert.equal(r.status, "matched");
    if (r.status !== "matched") return;
    assert.equal(r.permits.status, "unavailable");
    assert.equal(r.values.status, "ok");
    if (r.values.status === "ok") assert.ok(r.values.comparables_error);
  });

  it("is a no-match with what was tried when nothing matches", async () => {
    const { impl } = cityApi();
    const r = await fetchCityRecords({ planCandidates: ["0999999"], address: null }, NOW, { fetchImpl: impl });
    assert.equal(r.status, "no_match");
    if (r.status === "no_match") assert.deepEqual(r.tried, ["condo plan 0999999"]);
  });

  it("times out instead of hanging", async () => {
    const hang = ((_: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      })) as typeof fetch;
    const r = await fetchCityRecords({ planCandidates: ["0812345"], address: null }, NOW, { fetchImpl: hang, timeoutMs: 20 });
    assert.equal(r.status, "unavailable");
    if (r.status === "unavailable") assert.match(r.message, /timed out/);
  });
});

describe("getCityRecords cache", () => {
  const input = { planCandidates: ["0812345"], address: null };

  it("serves a fresh entry for 24h, then refetches", async () => {
    const cache = memoryCache();
    const api = cityApi();
    const first = await getCityRecords(input, { fetchImpl: api.impl, cache, cacheKey: "building:a", now: NOW });
    assert.equal(first.fromCache, false);
    const n = api.calls.length;
    const second = await getCityRecords(input, {
      fetchImpl: api.impl, cache, cacheKey: "building:a", now: new Date(NOW.getTime() + CACHE_TTL_MS - 1000),
    });
    assert.equal(second.fromCache, true);
    assert.equal(api.calls.length, n, "no City calls on a cache hit");
    const third = await getCityRecords(input, {
      fetchImpl: api.impl, cache, cacheKey: "building:a", now: new Date(NOW.getTime() + CACHE_TTL_MS + 1000),
    });
    assert.equal(third.fromCache, false);
  });

  it("misses when the building identity changed", async () => {
    const cache = memoryCache();
    const api = cityApi();
    await getCityRecords(input, { fetchImpl: api.impl, cache, cacheKey: "building:b", now: NOW });
    const again = await getCityRecords(
      { planCandidates: ["0999999"], address: null },
      { fetchImpl: api.impl, cache, cacheKey: "building:b", now: NOW }
    );
    assert.equal(again.fromCache, false);
  });

  it("does not cache 'unavailable', so the next view retries", async () => {
    const cache = memoryCache();
    const down = cityApi({ roll: true });
    const r = await getCityRecords(input, { fetchImpl: down.impl, cache, cacheKey: "building:c", now: NOW });
    assert.equal(r.records.status, "unavailable");
    assert.equal(await cache.get("building:c"), null);
  });
});

describe("assessReport", () => {
  it("checks identity and searches the documents per permit", async () => {
    const { impl } = cityApi();
    const records = await fetchCityRecords({ planCandidates: ["0812345"], address: null }, NOW, { fetchImpl: impl });
    const check = assessReport(records, {
      docPlans: ["081 2345"],
      docAddress: "1111 6th Avenue SW, Calgary",
      docUnits: 120,
      docs: [{ filename: "agm.pdf", docType: "minutes_agm", pages: [{ page: 3, text: "Roof replacement completed." }] }],
    });
    assert.ok(check.identity);
    assert.equal(check.identity.plan.status, "match");
    assert.equal(check.identity.address.status, "match");
    assert.equal(check.identity.units.status, "mismatch");
    const byNum = Object.fromEntries(check.permits.map((p) => [p.permit.permit_number, p.mention.status]));
    assert.equal(byNum["BP2023-00777"], "mentioned");
    assert.equal(byNum["BP2024-01234"], "not_mentioned");
  });

  it("carries no identity or permits without a match", () => {
    const rec: CityRecords = { identity_key: "k", fetched_at: NOW.toISOString(), status: "no_match", reason: "x", tried: [] };
    const check = assessReport(rec, { docPlans: [], docAddress: null, docUnits: null, docs: [] });
    assert.equal(check.identity, null);
    assert.deepEqual(check.permits, []);
  });
});
