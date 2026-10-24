import { NextResponse } from "next/server";
import { cachedCondoSearch } from "@/lib/calgary/search-cache";

/**
 * GET /api/calgary/search?q=… — public: condo buildings on the City of
 * Calgary assessment roll matching an address or plan number. Powers the
 * suggestions on /calgary. Public data, no AI calls, cached.
 */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 120);
  try {
    const out = await cachedCondoSearch(q);
    if (!out) return NextResponse.json({ results: [], nearbyStreet: null, tooShort: true });
    return NextResponse.json(
      { results: out.results, nearbyStreet: out.nearbyStreet, tooShort: false },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch {
    return NextResponse.json(
      { error: "City data unavailable. Please try again in a moment." },
      { status: 503 }
    );
  }
}
