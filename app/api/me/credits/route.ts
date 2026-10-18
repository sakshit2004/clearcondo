import { NextResponse } from "next/server";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { isStripeEnabled, withDb, getCreditBalance } from "@/lib/db";

export async function GET() {
  if (!isStripeEnabled()) {
    return NextResponse.json({ enabled: false, balance: null });
  }
  if (!isClerkConfigured()) {
    return NextResponse.json({ error: "Auth not configured." }, { status: 503 });
  }
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const balance = await withDb((db) => getCreditBalance(db, userId));
  return NextResponse.json({ enabled: true, balance: balance ?? 0 });
}
