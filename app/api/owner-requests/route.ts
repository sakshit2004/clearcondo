import { NextResponse } from "next/server";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { createOwnerRequest, isDbConfigured, withDb } from "@/lib/db";
import { OwnerRequestSchema } from "@/lib/owner";
import { estimateSaving, savingIfLowered } from "@/lib/owner-estimate";
import { fetchUnitRecord } from "@/lib/calgary/unit";

/** Reductions shown when the owner's numbers don't give a tailored estimate. */
const SCENARIOS = [1, 5, 10];

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
  // The page sends the unit's City value; if it couldn't load it, look it up
  // here so the owner still gets a number back (best effort, short timeout).
  let assessed = r.assessed_value;
  if (!assessed && r.unit) {
    assessed =
      (await fetchUnitRecord(r.plan, r.unit, { timeoutMs: 6000 }).catch(() => null))?.assessed_value ?? undefined;
    if (assessed) r.assessed_value = assessed;
  }
  const estimate = assessed
    ? estimateSaving({
        assessed_value: assessed,
        unit_size_sqft: r.unit_size_sqft,
        purchase_price: r.purchase_price,
        purchase_date: r.purchase_date,
        appraisal_value: r.appraisal_value,
        appraisal_date: r.appraisal_date,
        comparables: r.comparables,
      })
    : null;
  const scenarios = assessed ? SCENARIOS.map((pct) => ({ pct, ...savingIfLowered(assessed, pct) })) : null;

  try {
    const id = await withDb((db) => createOwnerRequest(db, userId, r, estimate ?? undefined));
    return NextResponse.json({ ok: true, id, estimate, scenarios });
  } catch {
    return NextResponse.json({ error: "Couldn't save your request. Please try again." }, { status: 500 });
  }
}
