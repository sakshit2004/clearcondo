import { NextResponse } from "next/server";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { cachedCondoSearch } from "@/lib/calgary/search-cache";
import { extractUnit } from "@/lib/calgary/unit";

/**
 * GET /api/calgary/search?q=… (signed in): condo buildings on the City of
 * Calgary assessment roll matching an address or plan number, plus the
 * unit number if one was typed. Powers the owner search on /app/own.
 * Public data, no AI calls, cached.
 */
export async function GET(req: Request) {
  if (isClerkConfigured() && !(await getUserId())) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 120);
  const unit = extractUnit(q);
  try {
    const out = await cachedCondoSearch(q);
    if (!out) return NextResponse.json({ results: [], nearbyStreet: null, unit, tooShort: true });
    return NextResponse.json(
      { results: out.results, nearbyStreet: out.nearbyStreet, unit, tooShort: false },
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  } catch {
    return NextResponse.json(
      { error: "City data unavailable. Please try again in a moment." },
      { status: 503 }
    );
  }
}
