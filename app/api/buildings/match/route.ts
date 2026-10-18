import { NextResponse } from "next/server";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { withDb, matchBuildings, isDbConfigured } from "@/lib/db";

/** GET /api/buildings/match?hint=... — candidate buildings for the confirm/merge step on upload. */
export async function GET(req: Request) {
  if (!isClerkConfigured() || !isDbConfigured()) {
    return NextResponse.json({ buildings: [] });
  }
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const hint = searchParams.get("hint") || "";
  const buildings = await withDb((db) => matchBuildings(db, userId, hint));
  return NextResponse.json({
    buildings: (buildings ?? []).map((b) => ({
      id: String(b.id).split(":")[1] ?? String(b.id),
      name: b.name,
      corp_number: b.corp_number,
      address: b.address,
      report_count: b.report_count,
    })),
  });
}
