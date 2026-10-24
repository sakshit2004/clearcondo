import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkMentions,
  classifyPermit,
  fetchMajorPermits,
  lookbackStart,
  toMajorPermit,
  type SearchableDoc,
} from "../calgary/permits.ts";
import { CityDataError } from "../calgary/socrata.ts";

const ADDR = new Set(["1111 6 AV SW"]);
const SINCE = "2021-10-24";

function permitRow(over: Record<string, string> = {}) {
  return {
    permitnum: "BP2024-01234",
    originaladdress: "1111 6 AV SW",
    issueddate: "2024-05-10T00:00:00.000",
    applieddate: "2024-03-01T00:00:00.000",
    statuscurrent: "Completed",
    description: "Re-roof of existing apartment building, replace membrane",
    workclassmapped: "Improvement",
    estprojectcost: "450000",
    ...over,
  };
}

const doc = (filename: string, docType: string, ...texts: string[]): SearchableDoc => ({
  filename,
  docType,
  pages: texts.map((text, i) => ({ page: i + 1, text })),
});

describe("classifyPermit", () => {
  it("finds major categories by whole word", () => {
    assert.deepEqual(classifyPermit("Re-roof and replace stucco cladding"), ["roof", "envelope"]);
    assert.deepEqual(classifyPermit("Parkade membrane and slab repair"), ["parkade", "structural"]);
    assert.deepEqual(classifyPermit("Balcony railing replacement"), ["balcony"]);
  });
  it("ignores minor work and partial words", () => {
    assert.deepEqual(classifyPermit("Interior renovation, unit 1203 kitchen"), []);
    assert.deepEqual(classifyPermit("Install new roofline signage? no: proofing"), []);
  });
});

describe("toMajorPermit", () => {
  it("keeps a major permit at the address within the window", () => {
    const p = toMajorPermit(permitRow(), ADDR, SINCE);
    assert.ok(p);
    assert.equal(p.permit_number, "BP2024-01234");
    assert.equal(p.issued_date, "2024-05-10");
    assert.equal(p.declared_value_cad, 450000);
    assert.deepEqual(p.categories, ["roof"]);
    assert.match(p.source_url, /c2es-76ed\.json\?permitnum=BP2024-01234/);
  });
  it("drops permits elsewhere, too old, or minor", () => {
    assert.equal(toMajorPermit(permitRow({ originaladdress: "21111 6 AV SW" }), ADDR, SINCE), null);
    assert.equal(
      toMajorPermit(permitRow({ issueddate: "2019-01-01T00:00:00", applieddate: "2018-11-01T00:00:00" }), ADDR, SINCE),
      null
    );
    assert.equal(toMajorPermit(permitRow({ description: "Interior alteration, suite 402" }), ADDR, SINCE), null);
  });
  it("accepts unit-prefixed permit addresses at the building", () => {
    assert.ok(toMajorPermit(permitRow({ originaladdress: "1203 1111 6 AV SW" }), ADDR, SINCE));
  });
});

describe("checkMentions (permit keyword logic)", () => {
  it("is 'mentioned' with the page where a term appears", () => {
    const docs = [
      doc("bylaws.pdf", "bylaws", "Nothing relevant here."),
      doc("agm-2024.pdf", "minutes_agm", "Opening remarks.", "The board approved the ROOF replacement tender."),
    ];
    const m = checkMentions(["roof"], docs);
    assert.equal(m.status, "mentioned");
    if (m.status === "mentioned") {
      assert.deepEqual(m.hits[0], { filename: "agm-2024.pdf", page: 2, term: "roof" });
      assert.deepEqual(m.searchedDocs, ["bylaws.pdf", "agm-2024.pdf"]);
    }
  });

  it("is 'not_mentioned' only when no term appears anywhere, and says what was searched", () => {
    const docs = [doc("agm-2024.pdf", "minutes_agm", "Landscaping and snow removal contract renewed.")];
    const m = checkMentions(["parkade"], docs);
    assert.equal(m.status, "not_mentioned");
    if (m.status === "not_mentioned") {
      assert.ok(m.searchedTerms.includes("parkade"));
      assert.ok(m.searchedTerms.includes("membrane"));
      assert.deepEqual(m.searchedDocs, ["agm-2024.pdf"]);
      assert.equal(m.minutesSearched, true);
    }
  });

  it("does not count partial-word matches as mentions", () => {
    const docs = [doc("minutes.pdf", "minutes_board", "Waterproofing of planters discussed.")];
    assert.equal(checkMentions(["roof"], docs).status, "not_mentioned");
  });

  it("any one of a permit's categories counts as a mention", () => {
    const docs = [doc("minutes.pdf", "minutes_board", "Engineer report on the balconies received.")];
    assert.equal(checkMentions(["structural", "balcony"], docs).status, "mentioned");
  });

  it("records when no minutes were among the searched documents", () => {
    const m = checkMentions(["roof"], [doc("bylaws.pdf", "bylaws", "Pets are allowed.")]);
    assert.equal(m.status, "not_mentioned");
    if (m.status === "not_mentioned") assert.equal(m.minutesSearched, false);
  });

  it("is 'not_run' (never 'not mentioned') without document text", () => {
    assert.equal(checkMentions(["roof"], []).status, "not_run");
    assert.equal(checkMentions(["roof"], [doc("scan.pdf", "minutes_agm", "  ")]).status, "not_run");
  });
});

describe("fetchMajorPermits", () => {
  const now = new Date("2026-10-24T12:00:00Z");

  it("queries the address and 5-year window, filters and sorts", async () => {
    let seen = "";
    const fetchImpl = (async (url: RequestInfo | URL) => {
      seen = decodeURIComponent(String(url));
      return new Response(
        JSON.stringify([
          permitRow({ permitnum: "BP2022-1", issueddate: "2022-06-01T00:00:00", description: "Parkade slab repair" }),
          permitRow({ permitnum: "BP2025-9", issueddate: "2025-02-01T00:00:00", description: "Balcony replacement" }),
          permitRow({ permitnum: "BP2025-9", issueddate: "2025-02-01T00:00:00", description: "Balcony replacement" }),
          permitRow({ permitnum: "BP2023-5", description: "Tenant improvement, suite 100" }),
        ]),
        { status: 200 }
      );
    }) as typeof fetch;
    const { permits, query_url } = await fetchMajorPermits(["1111 6 AV SW"], now, { fetchImpl });
    assert.deepEqual(permits.map((p) => p.permit_number), ["BP2025-9", "BP2022-1"]);
    assert.match(seen, /upper\(originaladdress\) like '%1111 6 AV SW%'/);
    assert.match(seen, new RegExp(`issueddate >= '${lookbackStart(now)}'`));
    assert.match(query_url, /c2es-76ed/);
  });

  it("surfaces API failure as CityDataError", async () => {
    const fetchImpl = (async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    await assert.rejects(fetchMajorPermits(["1111 6 AV SW"], now, { fetchImpl }), CityDataError);
  });
});

describe("permitToFact", () => {
  it("is a public-record fact keyed by permit number", async () => {
    const { permitToFact } = await import("../calgary/facts.ts");
    const p = toMajorPermit(permitRow(), ADDR, SINCE)!;
    const f = permitToFact(p, "0812345");
    assert.equal(f.source_type, "public_record");
    assert.equal(f.fact_key, "permit:BP2024-01234");
    assert.equal(f.source_url, p.source_url);
    assert.match(f.text, /City of Calgary building permit BP2024-01234 issued 2024-05-10 at 1111 6 AV SW \(condominium plan 0812345\)/);
    assert.match(f.text, /\$450,000 CAD/);
  });
});
