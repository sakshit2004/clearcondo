import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildingLabels,
  factsToMemoryText,
  isAgentMemoryConfigured,
  recallBuildingMemory,
  recallSharedMemory,
  rememberBuildingFacts,
  rememberPublicRecordFacts,
  sanitizeLabelSegment,
} from "../agent-memory.ts";
import type {
  BuildingFacts,
  VerifiedStructuredFacts,
} from "../report-schema.ts";

const ENV_KEYS = [
  "SPECTRON_URL",
  "SPECTRON_CONTEXT_ID",
  "SPECTRON_API_KEY",
] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

function setAgentMemoryEnv() {
  process.env.SPECTRON_URL = "https://memory.example.test";
  process.env.SPECTRON_CONTEXT_ID = "ctx-123";
  process.env.SPECTRON_API_KEY = "sp-test-key";
}

const building: BuildingFacts = {
  name: "North Hill Terrace",
  corp_number: "0614321",
  address: "1234 North Hill Terrace NW, Calgary, Alberta",
  units: 84,
  year_built: 2009,
  monthly_contribution_avg_cad: 512,
};

const facts = {
  doc_date: "2026-09-09",
  reserve_balance_cad: 745000,
  reserve_recommended_cad: 1221000,
  contribution_monthly_cad: 512,
  insurance_deductible_cad: 100000,
  special_assessments: [
    {
      amount_per_unit_cad: 8500,
      total_cad: 714000,
      purpose: "parkade membrane replacement",
      status: "levied",
      evidence: {
        file_id: "f1",
        page: 2,
        document_name: "agm.pdf",
        quote: "a special assessment of $8,500 per unit",
        verified: true,
        matched_page: 2,
        match_type: "exact_page",
        ocr: false,
      },
    },
  ],
  litigation: [
    {
      subject: "window water-ingress claim",
      units_affected: "304, 305, 406",
      status: "in mediation",
      evidence: {
        file_id: "f1",
        page: 5,
        document_name: "minutes.pdf",
        quote: "remains in mediation",
        verified: true,
        matched_page: 5,
        match_type: "exact_page",
        ocr: false,
      },
    },
  ],
  rental_rules: "Rentals capped at 15% of units.",
  rental_rules_evidence: null,
  fee_change_pct: 9,
} as unknown as VerifiedStructuredFacts;

describe("sanitizeLabelSegment", () => {
  it("lowercases and replaces non-alphanumerics with dashes", () => {
    assert.equal(sanitizeLabelSegment("building:abc123"), "building-abc123");
    assert.equal(sanitizeLabelSegment("User_42/X"), "user-42-x");
  });
  it("falls back to unknown for empty input", () => {
    assert.equal(sanitizeLabelSegment(""), "unknown");
    assert.equal(sanitizeLabelSegment("!!!"), "unknown");
  });
});

describe("buildingLabels", () => {
  it("builds app/owner/building labels", () => {
    assert.deepEqual(buildingLabels("user_123", "building:abc"), [
      "app=clearcondo",
      "owner=user-123",
      "building=building-abc",
    ]);
  });
  it("adds doc_date when provided", () => {
    const labels = buildingLabels("u", "b", "2026-09-09");
    assert.ok(labels.includes("doc_date=2026-09-09"));
  });
});

describe("factsToMemoryText", () => {
  it("serializes identity, reserve math, assessments, litigation", () => {
    const text = factsToMemoryText(building, facts);
    assert.ok(text.includes("North Hill Terrace"));
    assert.ok(text.includes("0614321"));
    assert.ok(text.includes("745,000"));
    assert.ok(text.includes("61%")); // 745000/1221000
    assert.ok(text.includes("parkade membrane replacement"));
    assert.ok(text.includes("levied"));
    assert.ok(text.includes("window water-ingress claim"));
    assert.ok(text.includes("in mediation"));
    assert.ok(text.includes("100,000"));
    assert.ok(text.includes("15% of units"));
  });
  it("skips null facts without leaking 'null'", () => {
    const empty = factsToMemoryText(
      { ...building, corp_number: null, address: null },
      {
        ...facts,
        reserve_balance_cad: null,
        reserve_recommended_cad: null,
        insurance_deductible_cad: null,
        special_assessments: [],
        litigation: [],
        rental_rules: null,
        fee_change_pct: null,
      }
    );
    assert.ok(!empty.includes("null"));
    assert.ok(!empty.includes("Insurance deductible"));
    assert.ok(!empty.includes("Special assessment"));
  });
});

describe("isAgentMemoryConfigured", () => {
  it("is false when env vars are absent", () => {
    assert.equal(isAgentMemoryConfigured(), false);
  });
  it("is true when all three vars are set", () => {
    setAgentMemoryEnv();
    assert.equal(isAgentMemoryConfigured(), true);
  });
  it("is false when any var is missing", () => {
    setAgentMemoryEnv();
    delete process.env.SPECTRON_API_KEY;
    assert.equal(isAgentMemoryConfigured(), false);
  });
});

describe("rememberBuildingFacts", () => {
  it("skips when unconfigured", async () => {
    const res = await rememberBuildingFacts({
      ownerId: "u",
      buildingRecordId: "building:abc",
      building,
      facts,
    });
    assert.deepEqual(res, { ok: false, skipped: "unconfigured" });
  });

  it("never throws on network failure", async () => {
    setAgentMemoryEnv();
    const failingFetch = (async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    const res = await rememberBuildingFacts(
      { ownerId: "u", buildingRecordId: "building:abc", building, facts },
      failingFetch
    );
    assert.deepEqual(res, { ok: false, skipped: "error" });
  });

  it("posts facts to the context endpoint with bearer auth and labels", async () => {
    setAgentMemoryEnv();
    let capturedUrl = "";
    let capturedInit: RequestInit = {};
    const okFetch = (async (url: unknown, init?: unknown) => {
      capturedUrl = String(url);
      capturedInit = (init ?? {}) as RequestInit;
      return new Response(JSON.stringify({ extraction: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const res = await rememberBuildingFacts(
      { ownerId: "user_1", buildingRecordId: "building:abc", building, facts },
      okFetch
    );
    assert.equal(res.ok, true);
    assert.ok(capturedUrl.includes("/api/v1/ctx-123/facts"));
    const headers = new Headers(capturedInit.headers);
    assert.equal(headers.get("authorization"), "Bearer sp-test-key");
    const body = JSON.parse(String(capturedInit.body));
    assert.equal(body.infer, "full");
    assert.ok(body.labels.includes("app=clearcondo"));
    assert.ok(body.labels.includes("building=building-abc"));
    assert.ok(body.text.includes("North Hill Terrace"));
  });
});

describe("recallBuildingMemory", () => {
  it("returns null when unconfigured", async () => {
    assert.equal(await recallBuildingMemory("u", "building:abc"), null);
  });

  it("returns null on network failure instead of throwing", async () => {
    setAgentMemoryEnv();
    const failingFetch = (async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    assert.equal(
      await recallBuildingMemory("u", "building:abc", failingFetch),
      null
    );
  });

  it("parses hits and tier from the query response", async () => {
    setAgentMemoryEnv();
    let capturedUrl = "";
    const okFetch = (async (url: unknown, init?: unknown) => {
      capturedUrl = String(url);
      const reqBody = JSON.parse(String((init as RequestInit).body));
      assert.ok(reqBody.labels.includes("building=building-abc"));
      return new Response(
        JSON.stringify({
          classificationKind: "hybrid",
          hits: [
            { text: "Reserve fund balance was $745,000.", score: 0.92 },
            { text: "", score: 0.1 },
          ],
          tier: "hybrid",
          trace: {},
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    }) as unknown as typeof fetch;

    const res = await recallBuildingMemory("u", "building:abc", okFetch);
    assert.ok(res);
    assert.equal(res.tier, "hybrid");
    assert.equal(res.hits.length, 1); // empty text filtered out
    assert.ok(res.hits[0].text.includes("745,000"));
    assert.ok(capturedUrl.includes("/api/v1/ctx-123/query"));
  });
});

describe("recall budget and cache", () => {
  const body = JSON.stringify({ hits: [{ text: "Reserve fund balance was $412,000.", score: 0.9 }], tier: "hybrid" });
  const json = () => new Response(body, { status: 200, headers: { "content-type": "application/json" } });

  it("gives up after the budget, then serves the finished recall from cache", async () => {
    setAgentMemoryEnv();
    let calls = 0;
    const slowFetch = (async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 150));
      return json();
    }) as unknown as typeof fetch;
    const t0 = Date.now();
    assert.equal(await recallSharedMemory("plan:0614321", slowFetch, 30), null);
    assert.ok(Date.now() - t0 < 120, "the page doesn't wait for the slow call");
    await new Promise((r) => setTimeout(r, 200)); // the call finishes in the background
    const cached = await recallSharedMemory("plan:0614321", slowFetch, 30);
    assert.equal(cached?.hits[0].text, "Reserve fund balance was $412,000.");
    assert.equal(calls, 1, "served from cache, no second call");
  });

  it("remembering new facts clears that building's cached recall", async () => {
    setAgentMemoryEnv();
    let queries = 0;
    const fetchImpl = (async (url: unknown) => {
      if (String(url).includes("/query")) queries++;
      return json();
    }) as unknown as typeof fetch;
    await recallSharedMemory("plan:7777777", fetchImpl);
    await recallSharedMemory("plan:7777777", fetchImpl);
    assert.equal(queries, 1);
    await rememberBuildingFacts(
      {
        ownerId: "u",
        buildingRecordId: "building:x",
        sharedKey: "plan:7777777",
        building: { name: "B", corp_number: "7777777", address: null, units: null, year_built: null, monthly_contribution_avg_cad: null },
        facts: { doc_date: "2025-03", reserve_balance_cad: 1000, reserve_recommended_cad: null, contribution_monthly_cad: null, insurance_deductible_cad: null, special_assessments: [], litigation: [], rental_rules: null, rental_rules_evidence: null, fee_change_pct: null },
      },
      fetchImpl
    );
    await recallSharedMemory("plan:7777777", fetchImpl);
    assert.equal(queries, 2);
  });
});

describe("rememberPublicRecordFacts", () => {
  const fact = {
    source_type: "public_record" as const,
    dataset: "c2es-76ed",
    source_name: "City of Calgary Open Data — Building Permits",
    source_url: "https://data.calgary.ca/resource/c2es-76ed.json?permitnum=BP2024-01234",
    fact_key: "permit:BP2024-01234",
    categories: ["roof"],
    observed_on: "2024-05-10",
    declared_value_cad: 450000,
    text: "City of Calgary building permit BP2024-01234 issued 2024-05-10: Re-roof.",
  };

  it("is skipped when Agent Memory is unconfigured", async () => {
    const r = await rememberPublicRecordFacts({ ownerId: "u", buildingRecordId: "building:x", facts: [fact] });
    assert.deepEqual(r, { ok: false, skipped: "unconfigured" });
  });

  it("labels the write as a public-record source and never throws", async () => {
    setAgentMemoryEnv();
    let body = "";
    const ok = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      body = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const r = await rememberPublicRecordFacts({ ownerId: "u", buildingRecordId: "building:x", facts: [fact] }, ok);
    assert.equal(r.ok, true);
    assert.match(body, /source=public-record/);
    assert.match(body, /not from the condominium's own documents/);

    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    const r2 = await rememberPublicRecordFacts({ ownerId: "u", buildingRecordId: "building:x", facts: [fact] }, down);
    assert.equal(r2.ok, false);
  });
});
