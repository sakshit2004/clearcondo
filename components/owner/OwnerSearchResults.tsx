import Link from "next/link";
import { cachedCondoSearch } from "@/lib/calgary/search-cache";
import { MIN_QUERY, type CondoSearchResponse, type MatchQuality } from "@/lib/calgary/search";
import { extractUnit } from "@/lib/calgary/unit";
import { ownerBuildingHref } from "@/lib/owner-links";

const MATCH_LABEL: Record<MatchQuality, string | null> = {
  exact: "Exact address",
  prefix: null,
  words: null,
  plan: "Plan number",
  nearby: "Same street",
};

function MatchBadge({ match }: { match: MatchQuality }) {
  const label = MATCH_LABEL[match];
  if (!label) return null;
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
        match === "nearby" ? "bg-warn-soft text-warn-dark" : "bg-accent-soft text-accent-dark"
      }`}
    >
      {label}
    </span>
  );
}

function ResultList({ q, out, unit }: { q: string; out: CondoSearchResponse; unit: string | null }) {
  const { results, nearbyStreet } = out;
  if (results.length === 0) {
    return (
      <div className="report-paper rounded-2xl px-6 py-5">
        <p className="font-semibold text-ink">No condo buildings match &ldquo;{q}&rdquo;.</p>
        <ul className="text-sm text-stone-600 mt-2 space-y-1 list-disc pl-5">
          <li>Use the address as it appears on your tax notice, e.g. &ldquo;1203-1111 6 Ave SW&rdquo;.</li>
          <li>Or search the condo plan number from your title or condo documents, e.g. &ldquo;0812345&rdquo;.</li>
          <li>Building names aren&apos;t on the City roll, so they can&apos;t be searched.</li>
        </ul>
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm text-stone-500 mb-3">
        {nearbyStreet ? (
          <>
            No condos at that civic number. Condo buildings on <strong className="text-ink">{nearbyStreet}</strong>,
            nearest first:
          </>
        ) : (
          <>
            {results.length} condo building{results.length === 1 ? "" : "s"} on the City roll
            {unit && <>. Opening unit {unit}</>}
          </>
        )}
      </p>
      <ul className="grid gap-3">
        {results.map((b, i) => (
          <li key={b.plan} className="stagger" style={{ animationDelay: `${i * 50}ms` }}>
            <Link
              href={ownerBuildingHref(b.plan, unit)}
              className="group hover-card report-paper rounded-2xl px-5 py-4 flex items-center gap-4 no-underline"
            >
              <span className="flex-1 min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink text-[17px] break-words">
                    {unit ? `Unit ${unit}, ` : ""}
                    {b.addresses[0] ?? `Condo plan ${b.plan}`}
                  </span>
                  <MatchBadge match={b.match} />
                </span>
                <span className="block text-[13px] text-stone-500 mt-1">
                  Plan {b.plan}
                  {b.community ? ` · ${b.community}` : ""}
                  {b.year_built ? ` · built ${b.year_built}` : ""}
                  {` · ${b.units} unit${b.units === 1 ? "" : "s"}`}
                </span>
              </span>
              <span aria-hidden className="text-subtle group-hover:text-ink group-hover:translate-x-0.5 transition">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Server-rendered results for /app/own?q=… (the no-JavaScript path and the full list). */
export default async function OwnerSearchResults({ q }: { q: string }) {
  let out: CondoSearchResponse | null;
  try {
    out = await cachedCondoSearch(q);
  } catch {
    return (
      <p className="report-paper rounded-2xl px-6 py-5 text-sm text-stone-600">
        <strong className="text-ink">City data unavailable.</strong> The City of Calgary open-data service
        didn&apos;t answer in time. Please try again in a moment.
      </p>
    );
  }
  if (!out) {
    return (
      <p className="text-sm text-stone-600">
        Enter at least {MIN_QUERY} characters: your address or a condo plan number.
      </p>
    );
  }
  return <ResultList q={q} out={out} unit={extractUnit(q)} />;
}
