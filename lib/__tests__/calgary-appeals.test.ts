import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  annualTax,
  appealsParamsFromEnv,
  complaintOutcome,
  fetchBuildingAppeals,
  isParkingStall,
  summarizeComplaints,
  taxSaving,
} from "../calgary/appeals.ts";
import { fetchCityRecords } from "../calgary/check.ts";
import { CityDataError } from "../calgary/socrata.ts";

// Row shape of the City's Review Board dataset (myiv-ju9n). Addresses are fictional.
const arb = (year: string, location_address: string, status: string, board_s_decision: string) => ({
  year, location_address, status, board_s_decision,
});
const STREET = "500 SAMPLE ST SW";
const units = new Set(Array.from({ length: 6 }, (_, i) => `${101 + i} ${STREET}`));
const PARAMS = { groupMin: 3, groupWinShare: 0.5, typicalCut: 0.1 }; // test values, not production ones

const ENV = ["APPEALS_GROUP_MIN", "APPEALS_GROUP_WIN_SHARE", "APPEALS_TYPICAL_CUT"] as const;
let saved: Record<string, string | undefined> = {};
beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("complaintOutcome", () => {
  it("reads the dataset's status/decision values", () => {
    assert.equal(complaintOutcome("Mutual Agreement", "Resolved without hearing"), "settled");
    assert.equal(complaintOutcome("Assessment Amendment", "Revised by Mutual Consent"), "settled");
    assert.equal(complaintOutcome("Hearing Occured", "Decrease"), "decreased");
    assert.equal(complaintOutcome("Hearing Occurred", "No Change"), "no_change");
    assert.equal(complaintOutcome("Withdrawn", "Resolved without hearing"), "withdrawn");
    assert.equal(complaintOutcome("Decision Pending", ""), "other");
  });
  it("recognizes parking stalls", () => {
    assert.equal(isParkingStall(`12V ${STREET}`), true);
    assert.equal(isParkingStall(`101 ${STREET}`), false);
  });
});

describe("summarizeComplaints", () => {
  const rows = [
    ...[...units].slice(0, 4).map((a) => arb("2024", a, "Mutual Agreement", "Resolved without hearing")),
    arb("2024", `12V ${STREET}`, "Hearing Occured", "No Change"), // stall: excluded
    arb("2024", `999 ${STREET}`, "Withdrawn", ""), // another building's unit
    arb("2021", `106 ${STREET}`, "Hearing Occurred", "No Change"),
    arb("2021", `106 ${STREET}`, "Mutual Agreement", ""), // same unit twice in a year: one, lowered
  ];

  it("gives facts only, with no reading, when no private parameters are set", () => {
    const s = summarizeComplaints(rows, units);
    assert.deepEqual(s.history, [
      { year: 2024, filed: 4, lowered: 4, not_lowered: 0 },
      { year: 2021, filed: 1, lowered: 1, not_lowered: 0 },
    ]);
    assert.equal(s.filed_total, 5);
    assert.equal(s.reading, null);
    assert.equal(s.typical_cut, null);
  });

  it("reads group filings with the configured parameters", () => {
    const s = summarizeComplaints(rows, units, PARAMS);
    assert.equal(s.reading, "group_lowered");
    assert.equal(s.reading_year?.year, 2024);
    assert.equal(s.typical_cut, 0.1);
    const losing = [...units].slice(0, 4).map((a) => arb("2023", a, "Hearing Occurred", "No Change"));
    assert.equal(summarizeComplaints(losing, units, PARAMS).reading, "group_not_lowered");
    assert.equal(summarizeComplaints([], units, PARAMS).reading, "no_group");
  });
});

describe("appealsParamsFromEnv", () => {
  it("is all null when unset, and ignores out-of-range values", () => {
    assert.deepEqual(appealsParamsFromEnv(), { groupMin: null, groupWinShare: null, typicalCut: null });
    process.env.APPEALS_GROUP_WIN_SHARE = "7";
    process.env.APPEALS_TYPICAL_CUT = "abc";
    assert.deepEqual(appealsParamsFromEnv(), { groupMin: null, groupWinShare: null, typicalCut: null });
  });
  it("reads valid values", () => {
    process.env.APPEALS_GROUP_MIN = "4";
    process.env.APPEALS_GROUP_WIN_SHARE = "0.6";
    process.env.APPEALS_TYPICAL_CUT = "0.05";
    assert.deepEqual(appealsParamsFromEnv(), { groupMin: 4, groupWinShare: 0.6, typicalCut: 0.05 });
  });
});

describe("tax calculations", () => {
  it("applies the 2026 Calgary residential rate", () => {
    assert.equal(Math.round(annualTax(400_000)), 2660); // 400,000 × 0.66499%
    assert.equal(Math.round(taxSaving(400_000, 0.1)), 266);
  });
});

describe("fetchBuildingAppeals", () => {
  it("queries the Review Board by unit address, skipping stalls", async () => {
    let url = "";
    const fetchImpl = (async (u: RequestInfo | URL) => {
      url = decodeURIComponent(String(u));
      return new Response(JSON.stringify([arb("2025", `101 ${STREET}`, "Mutual Agreement", "")]));
    }) as typeof fetch;
    const s = await fetchBuildingAppeals(["101 500 Sample St SW", `12V ${STREET}`], { fetchImpl });
    assert.match(url, /myiv-ju9n/);
    assert.match(url, new RegExp(`upper\\(location_address\\) in \\('101 ${STREET}'\\)`));
    assert.equal(s.lowered_total, 1);
    assert.equal(s.reading, null, "no reading without private parameters");
  });

  it("surfaces City failure as CityDataError", async () => {
    const fetchImpl = (async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    await assert.rejects(fetchBuildingAppeals([`101 ${STREET}`], { fetchImpl }), CityDataError);
  });
});

describe("fetchCityRecords with appeals", () => {
  const unit = (roll: string, legal: string, address: string, value: string) => ({
    roll_number: roll, short_legal: legal, address, assessed_value: value, roll_year: "2026",
    assessment_class: "RE", sub_property_use: "R201", comm_code: "XYZ", comm_name: "SAMPLE",
  });
  const UNITS = [unit("1", "9990001;1", `101 ${STREET}`, "300000.0"), unit("2", "9990001;2", `102 ${STREET}`, "400000.0")];

  it("adds appeals and current values; an appeals outage degrades only that part", async () => {
    const make = (arbDown: boolean) =>
      (async (u: RequestInfo | URL) => {
        const url = decodeURIComponent(String(u));
        if (url.includes("myiv-ju9n")) return arbDown ? new Response("x", { status: 500 }) : new Response(JSON.stringify([arb("2025", `101 ${STREET}`, "Mutual Agreement", "")]));
        if (url.includes("4bsw-nn7w") && url.includes("9990001")) return new Response(JSON.stringify(UNITS));
        return new Response("[]");
      }) as typeof fetch;
    const ok = await fetchCityRecords({ planCandidates: ["9990001"], address: null }, new Date("2026-10-24"), { fetchImpl: make(false) });
    assert.equal(ok.status, "matched");
    if (ok.status !== "matched") return;
    assert.equal(ok.current_total, 700000);
    assert.equal(ok.current_median, 350000);
    assert.equal(ok.appeals?.status, "ok");
    const down = await fetchCityRecords({ planCandidates: ["9990001"], address: null }, new Date("2026-10-24"), { fetchImpl: make(true) });
    assert.equal(down.status, "matched");
    if (down.status === "matched") assert.equal(down.appeals?.status, "unavailable");
  });
});
