/**
 * Cost guards for the analysis pipeline.
 *
 * With STRIPE_ENABLED=false (the default beta mode) there is no payment
 * gate, so without these a signed-in stranger could run unlimited analyses
 * and burn the owner's Anthropic budget (a 100-page stack is ~35k input
 * tokens; worst case ~180k). Two guards:
 *
 *  1. checkRunPayloadCap — stateless, always enforced: the run route must
 *     not accept more pages than the start route could ever produce
 *     (12 files x 40 pages). A crafted POST that bypasses /api/analyze/start
 *     gets a 413 here.
 *  2. checkDailyAnalysisLimit — per-user daily counter in SurrealDB
 *     (env MAX_ANALYSES_PER_DAY, default 10). Only applies when the DB is
 *     configured: serverless has nowhere durable to count otherwise.
 */

/** Daily analysis cap per user. Tunable via MAX_ANALYSES_PER_DAY. */
export function maxAnalysesPerDay(): number {
  const v = Number(process.env.MAX_ANALYSES_PER_DAY);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 10;
}

/**
 * Max total pages the run route accepts in one request. Mirrors the
 * start-route caps (12 files x 40 pages/file in lib/extract.ts).
 * Tunable via MAX_PAGES_PER_RUN.
 */
export function maxPagesPerRun(): number {
  const v = Number(process.env.MAX_PAGES_PER_RUN);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 480;
}

export interface DailyUsage {
  allowed: boolean;
  used: number;
  limit: number;
  /** YYYY-MM-DD (UTC) bucket the count was recorded in. */
  day: string;
}

/** Minimal DB surface: anything with .query works (real Surreal or a test fake). */
export interface UsageDb {
  query: (
    sql: string,
    params?: Record<string, unknown>
  ) => Promise<unknown[]>;
}

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Record one analysis attempt for this user today and report whether
 * another run is allowed. Read-then-write in a single call; a tiny race
 * window between concurrent requests is acceptable for a cost guard
 * (worst case: a small overshoot, not a bypass).
 *
 * Call AFTER input validation and BEFORE analyzeDocuments — only attempts
 * that actually reach the model should count.
 */
export async function checkDailyAnalysisLimit(
  db: UsageDb,
  ownerId: string
): Promise<DailyUsage> {
  const day = utcDay();
  const limit = maxAnalysesPerDay();
  const key = `${ownerId}:${day}`;
  const res = (await db.query(
    `SELECT VALUE count FROM ONLY type::thing("daily_usage", $key)`,
    { key }
  )) as unknown[];
  const used = Number(res[0] ?? 0) + 1;
  await db.query(
    `UPSERT type::thing("daily_usage", $key) SET owner_id = $owner, day = $day, count = $used`,
    { key, owner: ownerId, day, used }
  );
  return { allowed: used <= limit, used, limit, day };
}

/**
 * Server-side guard for the run route's client-supplied pages. The start
 * route caps uploads (12 files / 4 MB) and lib/extract.ts caps pages per
 * doc (40) and chars per doc (60k), but /api/analyze/run accepts `pages`
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
