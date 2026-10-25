/**
 * The BUILDING MEMORY block given to Claude on a building's next analysis.
 * Two sources, both from SurrealDB:
 *   - prior verified flags from the deterministic `flag` table (auditable)
 *   - reconciled beliefs recalled from SurrealDB Agent Memory (compounding:
 *     the service end-dates superseded beliefs instead of overwriting them)
 * Either may be empty; returns null when both are.
 */
export interface PriorFlagLine {
  severity: string;
  title: string;
  explanation: string;
}

const MAX_BELIEFS = 6;
const MAX_BELIEF_CHARS = 400;

export function buildMemoryContext(prior: PriorFlagLine[], beliefs: string[]): string | null {
  const parts: string[] = [];
  if (prior.length > 0) {
    parts.push(
      "Verified flags from previous analyses of this building:\n" +
        prior.map((f) => `- [${f.severity}] ${f.title}: ${f.explanation}`).join("\n")
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
