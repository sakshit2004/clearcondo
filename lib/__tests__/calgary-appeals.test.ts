import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  annualTax,
  complaintOutcome,
  fetchBuildingAppeals,
  isParkingStall,
  summarizeComplaints,
} from "../calgary/appeals.ts";
import { fetchCityRecords } from "../calgary/check.ts";
import { CityDataError } from "../calgary/socrata.ts";

// Row shape of the City's Review Board dataset (myiv-ju9n). Addresses are fictional.
const arb = (year: string, location_address: string, status: string, board_s_decision: string) => ({
  year, location_address, status, board_s_decision,
});
const STREET = "500 SAMPLE ST SW";
const units = new Set(Array.from({ length: 6 }, (_, i) => `${101 + i} ${STREET}`));
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
    arb("2021", `106 ${STREET}`, "Mutual Agreement", ""), // same unit twice in a year: counted once
  ];

  it("counts complaints per year by recorded outcome", () => {
    const s = summarizeComplaints(rows, units);
    assert.deepEqual(s.history, [
      { year: 2024, filed: 4, settled_or_decreased: 4, other: 0 },
      { year: 2021, filed: 1, settled_or_decreased: 1, other: 0 },
    ]);
    assert.equal(s.filed_total, 5);
    assert.equal(s.settled_or_decreased_total, 5);
  });

  it("counts no-change and withdrawn as other outcomes", () => {
    const s = summarizeComplaints(
      [arb("2023", `101 ${STREET}`, "Hearing Occurred", "No Change"), arb("2023", `102 ${STREET}`, "Withdrawn", "")],
      units
    );
    assert.deepEqual(s.history, [{ year: 2023, filed: 2, settled_or_decreased: 0, other: 2 }]);
  });

  it("only returns facts: no reading or estimate fields", () => {
    assert.deepEqual(Object.keys(summarizeComplaints(rows, units)).sort(), ["filed_total", "history", "settled_or_decreased_total"]);
  });
});

describe("tax calculations", () => {
  it("applies the 2026 Calgary residential rate", () => {
    assert.equal(Math.round(annualTax(400_000)), 2660); // 400,000 × 0.66499%
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
    assert.equal(s.settled_or_decreased_total, 1);
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
