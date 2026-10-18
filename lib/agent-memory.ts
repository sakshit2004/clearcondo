/**
 * SurrealDB Agent Memory integration — the belief layer for building memory.
 *
 * Our SurrealDB tables (building/document/report/flag) are the deterministic
 * application store: every number the UI shows comes from them. Agent Memory
 * (the hosted `agent-memory` service, formerly "Spectron") is the second
 * layer: each completed analysis is *remembered* as factual text, the service
 * extracts entities/attributes/relations itself (`infer: "full"`), reconciles
 * them against what it already believes about the building, and end-dates
 * superseded beliefs instead of overwriting them (tri-temporal history).
 * Recall then answers "what does the building's history look like?" with
 * hybrid retrieval over that reconciled graph.
 *
 * Everything here is env-gated and failure-tolerant: when SPECTRON_* vars are
 * absent or the service is unreachable, the app behaves exactly as before.
 * Nothing in this module may throw to its callers.
 */
import { AgentMemory } from "@surrealdb/memory";
import type {
  BuildingFacts,
  VerifiedStructuredFacts,
} from "./report-schema";

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

/** True when all three Agent Memory env vars are present. */
export function isAgentMemoryConfigured(): boolean {
  return Boolean(
    process.env.SPECTRON_URL &&
      process.env.SPECTRON_CONTEXT_ID &&
      process.env.SPECTRON_API_KEY
  );
}

function createClient(
  fetchImpl?: typeof fetch
): AgentMemory | null {
  if (!isAgentMemoryConfigured()) return null;
  return new AgentMemory({
    endpoint: process.env.SPECTRON_URL!.replace(/\/+$/, ""),
    context: process.env.SPECTRON_CONTEXT_ID!,
    apiKey: process.env.SPECTRON_API_KEY!,
    timeoutMs: 15_000,
    maxRetries: 1,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
}

/* ------------------------------------------------------------------ */
/* Labels: how one building's memory is partitioned                    */
/* ------------------------------------------------------------------ */

/**
 * Scope paths require a separate registration step, so we partition with
 * labels instead: they filter reads within the key's region and need no
 * setup beyond the Context + API key. Writes without explicit scopes land
 * in the key's default write region (per the Agent Memory docs) and are
 * immediately queryable.
 */
export function sanitizeLabelSegment(s: string): string {
  const out = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || "unknown";
}

/** Labels tagging one building's facts: app, owner, building record id. */
export function buildingLabels(
  ownerId: string,
  buildingRecordId: string,
  docDate?: string | null
): string[] {
  const labels = [
    "app=clearcondo",
    `owner=${sanitizeLabelSegment(ownerId)}`,
    `building=${sanitizeLabelSegment(buildingRecordId)}`,
  ];
  if (docDate) labels.push(`doc_date=${sanitizeLabelSegment(docDate)}`);
  return labels;
}

/* ------------------------------------------------------------------ */
/* Serialization: verified facts -> remember() text                    */
/* ------------------------------------------------------------------ */

function cad(n: number): string {
  return n.toLocaleString("en-CA", { maximumFractionDigits: 0 });
}

/**
 * Serialize a verified analysis into factual sentences for Agent Memory.
 * Only verified, numeric/factual content goes in — no personal names from
 * minutes (those are stripped upstream), no freeform prose.
 */
export function factsToMemoryText(
  building: BuildingFacts,
  facts: VerifiedStructuredFacts
): string {
  const lines: string[] = [];
  const identity = [
    building.name,
    building.corp_number
      ? `condominium corporation ${building.corp_number}`
      : null,
    building.address,
  ]
    .filter(Boolean)
    .join(", ");
  lines.push(`Condominium building: ${identity || "identity not stated"}.`);
  if (facts.doc_date) lines.push(`Document date: ${facts.doc_date}.`);
  if (building.units) lines.push(`The building has ${building.units} units.`);
  if (building.year_built)
    lines.push(`Built in ${building.year_built}.`);

  if (facts.reserve_balance_cad != null) {
    let s = `Reserve fund balance: $${cad(facts.reserve_balance_cad)} CAD`;
    if (facts.reserve_recommended_cad) {
      const pct = Math.round(
        (facts.reserve_balance_cad / facts.reserve_recommended_cad) * 100
      );
      s += `, which is ${pct}% of the study-recommended $${cad(
        facts.reserve_recommended_cad
      )} CAD`;
    }
    lines.push(s + ".");
  }
  if (facts.contribution_monthly_cad != null)
    lines.push(
      `Average monthly condominium contribution: $${cad(
        facts.contribution_monthly_cad
      )} CAD per unit.`
    );
  if (facts.insurance_deductible_cad != null)
    lines.push(
      `Corporation insurance deductible: $${cad(
        facts.insurance_deductible_cad
      )} CAD per occurrence.`
    );
  for (const sa of facts.special_assessments ?? []) {
    const amount = [
      sa.amount_per_unit_cad != null
        ? `$${cad(sa.amount_per_unit_cad)} CAD per unit`
        : null,
      sa.total_cad != null ? `$${cad(sa.total_cad)} CAD total` : null,
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(
      `Special assessment (${sa.status}) for ${sa.purpose}${
        amount ? `: ${amount}` : ""
      }.`
    );
  }
  for (const lit of facts.litigation ?? []) {
    lines.push(
      `Litigation: ${lit.subject} — status: ${lit.status}${
        lit.units_affected ? ` (units affected: ${lit.units_affected})` : ""
      }.`
    );
  }
  if (facts.rental_rules) lines.push(`Rental rules: ${facts.rental_rules}.`);
  if (facts.fee_change_pct != null)
    lines.push(
      `Contribution change: ${facts.fee_change_pct > 0 ? "+" : ""}${
        facts.fee_change_pct
      }%.`
    );
  return lines.join(" ");
}

/* ------------------------------------------------------------------ */
/* Remember: dual-write each completed analysis                        */
/* ------------------------------------------------------------------ */

export interface RememberResult {
  ok: boolean;
  skipped?: "unconfigured" | "empty" | "error";
}

/**
 * Remember one analysis in Agent Memory. Best-effort by design: it never
 * throws and never fails the caller's request. Agent Memory extracts
 * entities/attributes itself and reconciles against prior beliefs about
 * this building (supersession is end-dated, not overwritten).
 */
export async function rememberBuildingFacts(
  opts: {
    ownerId: string;
    buildingRecordId: string;
    building: BuildingFacts;
    facts: VerifiedStructuredFacts;
  },
  fetchImpl?: typeof fetch
): Promise<RememberResult> {
  const client = createClient(fetchImpl);
  if (!client) return { ok: false, skipped: "unconfigured" };
  const text = factsToMemoryText(opts.building, opts.facts);
  if (!text.trim()) return { ok: false, skipped: "empty" };
  try {
    await client.remember(text, {
      infer: "full",
      labels: buildingLabels(
        opts.ownerId,
        opts.buildingRecordId,
        opts.facts.doc_date
      ),
    });
    return { ok: true };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      // Never log document contents — only that the write failed.
      console.warn(
        "[agent-memory] remember failed:",
        err instanceof Error ? err.message : String(err)
      );
    }
    return { ok: false, skipped: "error" };
  }
}

/* ------------------------------------------------------------------ */
/* Forget: best-effort removal of one report's beliefs                 */
/* ------------------------------------------------------------------ */

export interface ForgetResult {
  ok: boolean;
  skipped?: "unconfigured" | "error";
}

/**
 * Best-effort removal of one analysis run's beliefs from Agent Memory.
 * The hosted service only offers *semantic* forget (POST /forget matches
 * memories by similarity and soft-deletes them) — there is no hard-delete or
 * bulk age-based purge, which is why auto-retention does not cover beliefs
 * (documented in lib/retention.ts). The query names the building record and
 * document date to scope the match; other reports' facts should survive, but
 * this is approximate by nature. Never throws.
 */
export async function forgetReportBeliefs(
  opts: {
    ownerId: string;
    buildingRecordId: string;
    docDate?: string | null;
  },
  fetchImpl?: typeof fetch
): Promise<ForgetResult> {
  const client = createClient(fetchImpl);
  if (!client) return { ok: false, skipped: "unconfigured" };
  try {
    await client.forget(
      `Forget all facts remembered from the ClearCondo condominium document analysis for building record ${opts.buildingRecordId}${
        opts.docDate ? ` with document date ${opts.docDate}` : ""
      }.`
    );
    return { ok: true };
  } catch {
    return { ok: false, skipped: "error" };
  }
}

/* ------------------------------------------------------------------ */
/* Recall: what Agent Memory believes about a building                 */
/* ------------------------------------------------------------------ */

export interface RecallHit {
  text: string;
  score: number;
}

export interface RecallResult {
  hits: RecallHit[];
  tier: string;
}

/**
 * Recall reconciled beliefs about a building. Returns null when Agent
 * Memory is unconfigured or unreachable — callers render nothing in that
 * case. Hits are the ranked memory rows (text + score); tier is one of
 * direct | cache | hybrid | escalated.
 */
export async function recallBuildingMemory(
  ownerId: string,
  buildingRecordId: string,
  fetchImpl?: typeof fetch
): Promise<RecallResult | null> {
  const client = createClient(fetchImpl);
  if (!client) return null;
  try {
    const res = await client.recall(
      "Summarize the known facts about this condominium building: reserve fund balance, special assessments, litigation, insurance deductible, and rental rules. Include how each changed over time, most recent first.",
      { k: 6, labels: buildingLabels(ownerId, buildingRecordId) }
    );
    const hits: RecallHit[] = (res.hits ?? [])
      .map((h) => ({
        text: String((h as { text?: unknown }).text ?? ""),
        score: Number((h as { score?: unknown }).score ?? 0),
      }))
      .filter((h) => h.text.length > 0);
    return { hits, tier: String(res.tier ?? "unknown") };
  } catch {
    return null;
  }
}
