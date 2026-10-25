import {
  isAgentMemoryConfigured,
  recallBuildingMemory,
  recallSharedMemory,
} from "@/lib/agent-memory";

/** How long the page waits for the memory service before rendering without it. */
const PAGE_RECALL_BUDGET_MS = 4_000;

const TIER_LABELS: Record<string, string> = {
  direct: "direct lookup",
  cache: "served from cache",
  hybrid: "hybrid retrieval",
  escalated: "escalated retrieval",
};

/**
 * "What Agent Memory believes" — reconciled beliefs about this building,
 * recalled from SurrealDB Agent Memory. Renders nothing when Agent Memory
 * is unconfigured or unreachable: the deterministic tables remain the
 * source of truth for the rest of the page.
 */
export default async function AgentMemoryPanel({
  ownerId,
  buildingRecordId,
  sharedKey,
}: {
  ownerId: string;
  buildingRecordId: string;
  /** The building's shared record: where analyses are remembered since the shared record shipped. */
  sharedKey?: string | null;
}) {
  if (!isAgentMemoryConfigured()) return null;
  // Shared beliefs first; this user's older, per-account beliefs as a fallback.
  // Both run at once, capped, and are cached for repeat views.
  const [shared, own] = await Promise.all([
    sharedKey ? recallSharedMemory(sharedKey, undefined, PAGE_RECALL_BUDGET_MS) : Promise.resolve(null),
    recallBuildingMemory(ownerId, buildingRecordId, undefined, PAGE_RECALL_BUDGET_MS),
  ]);
  const recall = shared && shared.hits.length > 0 ? shared : own;
  if (!recall || recall.hits.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex flex-wrap items-center gap-3 mb-1.5">
        <h2 className="font-bold text-2xl tracking-tight text-ink">
          Agent memory
        </h2>
        <span className="micro-label border border-ink px-2 py-1">
          {TIER_LABELS[recall.tier] ?? recall.tier}
        </span>
      </div>
      <p className="text-xs text-stone-500 mb-4 max-w-2xl">
        Recalled from SurrealDB Agent Memory — reconciled beliefs built up
        across every review of this building. Newer reviews supersede older
        ones; superseded beliefs are end-dated, never silently overwritten.
      </p>
      <div className="space-y-3">
        {recall.hits.map((hit, i) => (
          <div
            key={i}
            className="report-paper px-5 py-4"
          >
            <p className="text-sm text-stone-600 leading-relaxed">
              {hit.text}
            </p>
            <p className="data-label text-stone-400 mt-2.5">
              relevance {hit.score.toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Placeholder while the memory service answers (behind Suspense). */
export function AgentMemoryPending() {
  if (!isAgentMemoryConfigured()) return null;
  return (
    <section className="mb-10" aria-busy="true">
      <h2 className="font-bold text-2xl tracking-tight text-ink mb-1.5">Agent memory</h2>
      <p className="text-xs text-stone-500 mb-4">Recalling what&apos;s known about this building…</p>
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="report-paper px-5 py-4">
            <div className="loadbar max-w-xs" />
          </div>
        ))}
      </div>
    </section>
  );
}
