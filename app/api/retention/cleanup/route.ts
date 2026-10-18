import { NextResponse } from "next/server";
import { withDb, isDbConfigured } from "@/lib/db";
import {
  isCronAuthorized,
  runRetentionCleanup,
  getRetentionDays,
} from "@/lib/retention";

/**
 * Daily data-retention cleanup, triggered by Vercel Cron.
 *
 * Deletes document rows (metadata + extracted page text) older than
 * RETENTION_DAYS. Report shells, flags, facts, and buildings are never
 * touched here — see lib/retention.ts for the full policy.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 * Fails closed when CRON_SECRET is unset.
 */
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isCronAuthorized(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({
      ok: true,
      skipped: "database_not_configured",
      retentionDays: getRetentionDays(),
    });
  }
  try {
    const result = await withDb((db) => runRetentionCleanup(db));
    if (!result) {
      return NextResponse.json(
        { error: "Database connection failed." },
        { status: 502 }
      );
    }
    // Counts only — never log document contents.
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cleanup failed." },
      { status: 500 }
    );
  }
}
