/**
 * Data retention policy for ClearCondo — the single place that documents
 * what we keep, for how long, and why.
 *
 * The guiding rule: raw bulk text and uploads go first; the user's report
 * shell (summary, flags, facts) is never auto-deleted.
 *
 * | Data                                    | Retention                              | Why                                                      |
 * |-----------------------------------------|----------------------------------------|----------------------------------------------------------|
 * | Raw PDF bytes                           | Never stored (memory only)             | Processed during extraction, then dropped. Nothing to delete. |
 * | Extracted page text (`document.pages`)  | Auto-deleted after RETENTION_DAYS      | Bulk sensitive text; only needed for the verification audit window. |
 * | Document rows (filename, type, status)  | Auto-deleted with page text            | Identify the source docs; not needed once the text is gone. |
 * | Report shell (summary, money exposure,  | Kept until the user deletes the report | The deliverable the user created; never auto-deleted.    |
 * | questions, verification stats, facts)   |                                        |                                                          |
 * | Flags + evidence quotes                 | Kept with the report                   | Short excerpts the user already saw; part of the report. |
 * | Building row                            | Kept until its last report is deleted  | Dedupe anchor and memory shell; removed when empty.      |
 * | Agent Memory beliefs (hosted service)   | Best-effort delete on report delete;   | The service exposes semantic forget per query, but no     |
 * |                                         | no auto-delete                         | bulk age-based purge — documented limitation.             |
 * | Credit rows (Stripe test mode)          | Kept (billing record)                  | Out of scope for retention.                              |
 *
 * Auto-deletion runs as a daily Vercel Cron hitting
 * `/api/retention/cleanup`, authorized by the CRON_SECRET env var
 * (Vercel sends `Authorization: Bearer <CRON_SECRET>`).
 */
import { z } from "zod";

/**
 * Minimal query surface the cleanup needs. The real Surreal client satisfies
 * this structurally; tests pass a recording fake. Kept separate from db.ts
 * so this module stays importable without a database driver.
 */
export interface CleanupDb {
  query: (
    sql: string,
    params?: Record<string, unknown>
  ) => Promise<unknown[]>;
}

export const DEFAULT_RETENTION_DAYS = 30;
/** Hard ceiling so a typo can't silently keep data for decades. */
export const MAX_RETENTION_DAYS = 3650;

const RetentionDaysSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(MAX_RETENTION_DAYS);

/** Retention window in days, from RETENTION_DAYS (default 30). Invalid values fall back to the default. */
export function getRetentionDays(): number {
  const parsed = RetentionDaysSchema.safeParse(process.env.RETENTION_DAYS);
  return parsed.success ? parsed.data : DEFAULT_RETENTION_DAYS;
}

/** Pure: the instant before which data counts as expired. */
export function retentionCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/* ------------------------------------------------------------------ */
/* Upload consent                                                       */
/* ------------------------------------------------------------------ */

const ConsentValueSchema = z.union([z.literal(true), z.literal("true")]);

/**
 * True when the uploader confirmed the consent checkbox. Accepts the JSON
 * boolean from the run route and the "true" form-field string from the
 * start route.
 */
export function hasUploadConsent(value: unknown): boolean {
  return ConsentValueSchema.safeParse(value).success;
}

/* ------------------------------------------------------------------ */
/* Cron authorization                                                   */
/* ------------------------------------------------------------------ */

/**
 * Pure check: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 * Never true when the secret is unset — a misconfigured deployment must
 * fail closed, not run unauthenticated cleanups.
 */
export function isCronAuthorized(
  authHeader: string | null,
  secret: string | undefined
): boolean {
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}

/* ------------------------------------------------------------------ */
/* Cleanup                                                              */
/* ------------------------------------------------------------------ */

export interface CleanupResult {
  documentsDeleted: number;
  cutoff: string;
  retentionDays: number;
}

/**
 * Delete document rows (metadata + embedded page text) older than the
 * retention window. Report shells, flags, facts, and buildings are never
 * touched here — see the policy table above.
 */
export async function runRetentionCleanup(
  db: CleanupDb,
  now: Date = new Date()
): Promise<CleanupResult> {
  const retentionDays = getRetentionDays();
  const cutoff = retentionCutoff(now, retentionDays).toISOString();
  const res = await db.query("DELETE document WHERE created_at < $cutoff RETURN id", {
    cutoff,
  });
  const deleted = (res[0] ?? []) as { id: unknown }[];
  return { documentsDeleted: deleted.length, cutoff, retentionDays };
}
