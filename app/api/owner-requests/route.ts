import { NextResponse } from "next/server";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { createOwnerRequest, isDbConfigured, withDb } from "@/lib/db";
import { OwnerRequestSchema } from "@/lib/owner";
import { estimateSaving } from "@/lib/owner-estimate";

/**
 * POST /api/owner-requests (signed in): an owner asks for a property tax
 * savings estimate. Returns the instant estimate from the evidence they
 * entered and stores both for the team, who confirm by email; nothing is
 * filed with the City from here.
 */
export async function POST(req: Request) {
  if (!isClerkConfigured()) {
    return NextResponse.json({ error: "Sign-in isn't configured." }, { status: 503 });
  }
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Requests open at launch: the database isn't configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Could not read the request." }, { status: 400 });
  }
  const parsed = OwnerRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message ?? "Please check the form.", field: issue?.path[0] }, { status: 400 });
  }

  const r = parsed.data;
  const estimate = r.assessed_value
    ? estimateSaving({
        assessed_value: r.assessed_value,
        unit_size_sqft: r.unit_size_sqft,
        purchase_price: r.purchase_price,
        purchase_date: r.purchase_date,
        appraisal_value: r.appraisal_value,
        appraisal_date: r.appraisal_date,
        comparables: r.comparables,
      })
    : null;

  try {
    const id = await withDb((db) => createOwnerRequest(db, userId, r, estimate ?? undefined));
    return NextResponse.json({ ok: true, id, estimate });
  } catch {
    return NextResponse.json({ error: "Couldn't save your request. Please try again." }, { status: 500 });
  }
}
