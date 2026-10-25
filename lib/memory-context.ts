/**
 * The BUILDING MEMORY block given to Claude on a building's next analysis.
 * Three sources, all from SurrealDB:
 *   - prior verified flags from this user's own reports (`flag` table)
 *   - the shared building record: verified, dated facts from every user's
 *     packages for this building (lib/shared-record.ts)
 *   - reconciled beliefs recalled from SurrealDB Agent Memory (compounding:
 *     the service end-dates superseded beliefs instead of overwriting them)
 * Any may be empty; returns null when all are.
 */
export interface PriorFlagLine {
  severity: string;
  title: string;
  explanation: string;
}

const MAX_BELIEFS = 6;
const MAX_BELIEF_CHARS = 400;

export function buildMemoryContext(prior: PriorFlagLine[], beliefs: string[], record: string[] = []): string | null {
  const parts: string[] = [];
  if (prior.length > 0) {
    parts.push(
      "Verified flags from previous analyses of this building:\n" +
        prior.map((f) => `- [${f.severity}] ${f.title}: ${f.explanation}`).join("\n")
    );
  }
  if (record.length > 0) {
    parts.push(
      "Shared building record (verified facts from earlier document packages for this building, from all ClearCondo users, each with its document date). Use it to say what changed, and to point out anything earlier packages reported that these documents don't mention; it is not evidence for this report's flags:\n" +
        record.map((l) => `- ${l}`).join("\n")
    );
  }
  const clean = beliefs
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, MAX_BELIEFS)
    .map((b) => (b.length > MAX_BELIEF_CHARS ? `${b.slice(0, MAX_BELIEF_CHARS)}…` : b));
  if (clean.length > 0) {
    parts.push(
      "What Agent Memory currently believes about this building (reconciled over time; superseded beliefs are end-dated):\n" +
        clean.map((b) => `- ${b}`).join("\n")
    );
  }
  return parts.length ? parts.join("\n\n") : null;
}
