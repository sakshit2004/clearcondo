/**
 * Payload guard for the analysis pipeline.
 *
 * checkRunPayloadCap — stateless, always enforced: the run route must
 * not accept more pages than the start route could ever produce
 * (12 files x 100 pages). A crafted POST that bypasses /api/analyze/start
 * gets a 413 here. This equals the physical maximum of a legitimate
 * stack, so it never blocks real use.
 *
 * (The former per-user daily analysis cap was removed at the owner's
 * direction on 2026-10-24 — beta usage is uncapped. The daily_usage
 * table remains in the schema, unused, if a cap is ever wanted back.)
 */

/**
 * Max total pages the run route accepts in one request. Mirrors the
 * start-route caps (12 files x 100 pages/file in lib/extract.ts).
 * Tunable via MAX_PAGES_PER_RUN.
 */
export function maxPagesPerRun(): number {
  const v = Number(process.env.MAX_PAGES_PER_RUN);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 1200;
}

/**
 * Server-side guard for the run route's client-supplied pages. The start
 * route caps uploads (12 files / 4 MB) and lib/extract.ts caps pages per
 * doc (100) and chars per doc (150k), but /api/analyze/run accepts `pages`
 * arrays straight from the client — a crafted request can bypass all of
 * those and send an arbitrarily large prompt to Claude.
 *
 * Returns null when the payload is within budget, otherwise a
 * { status, error } the route should return directly (413).
 */
export function checkRunPayloadCap(
  docs: { pages?: { text?: string }[] }[]
): { status: 413; error: string } | null {
  const cap = maxPagesPerRun();
  let pages = 0;
  for (const d of docs) pages += d.pages?.length ?? 0;
  if (pages > cap) {
    return {
      status: 413,
      error: `That stack has ${pages} pages — the per-analysis limit is ${cap}. Split it into smaller stacks and try again.`,
    };
  }
  return null;
}
