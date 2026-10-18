import { NextResponse } from "next/server";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import {
  withDb,
  getReport,
  deleteReportCascade,
  isDbConfigured,
} from "@/lib/db";
import { forgetReportBeliefs } from "@/lib/agent-memory";

/**
 * DELETE /api/reports/:id — permanently delete a report and everything its
 * analysis run produced: flags, documents (metadata + extracted page text),
 * and the report row. The building shell is removed too if it has no
 * remaining reports. Agent Memory beliefs are forgotten best-effort
 * (semantic forget — approximate by nature, documented in lib/retention.ts).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isClerkConfigured()) {
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 }
    );
  }
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  const { id } = await params;
  const fullId = `report:${decodeURIComponent(id)}`;

  // Fetch first: confirms ownership and gives the doc_date for the
  // best-effort Agent Memory forget.
  const data = await withDb((db) => getReport(db, userId, fullId));
  if (!data) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const result = await withDb((db) =>
    deleteReportCascade(db, userId, fullId)
  );
  if (!result) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  // Best-effort — never fails the delete.
  await forgetReportBeliefs({
    ownerId: userId,
    buildingRecordId: result.buildingId,
    docDate: data.report.doc_date,
  });

  return NextResponse.json({
    ok: true,
    buildingDeleted: result.buildingDeleted,
  });
}
