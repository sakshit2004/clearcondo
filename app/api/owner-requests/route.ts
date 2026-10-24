import { NextResponse } from "next/server";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { createOwnerRequest, isDbConfigured, withDb } from "@/lib/db";
import { OwnerRequestSchema } from "@/lib/owner";

/**
 * POST /api/owner-requests (signed in): an owner asks for a property tax
 * savings estimate. Stored for the team, who reply by email; nothing is
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

  try {
    const id = await withDb((db) => createOwnerRequest(db, userId, parsed.data));
    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ error: "Couldn't save your request. Please try again." }, { status: 500 });
  }
}
