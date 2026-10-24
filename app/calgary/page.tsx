import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import CalgarySearch from "@/components/CalgarySearch";
import { cachedCondoSearch } from "@/lib/calgary/search-cache";
import { MIN_QUERY, type CondoSearchResponse, type MatchQuality } from "@/lib/calgary/search";
import { CALGARY_DATASETS, DATASET_TITLES, datasetPageUrl } from "@/lib/calgary/socrata";

export const metadata: Metadata = {
  title: "Look up a Calgary condo — ClearCondo",
  description:
    "Search any Calgary condo building by address or plan number: assessed value trend, similar buildings, and major permits from City of Calgary open data.",
};

const MATCH_LABEL: Record<MatchQuality, string | null> = {
  exact: "Exact address",
  prefix: null,
  words: null,
  plan: "Plan number",
  nearby: "Same street",
};

const WHAT_YOU_GET: [string, string, string][] = [
  ["Building facts", "Plan number, units on the roll, address, community and year built, checked against the City's assessment roll.", "M3 16V3.5A1.5 1.5 0 014.5 2h6A1.5 1.5 0 0112 3.5V16M12 7h1.5A1.5 1.5 0 0115 8.5V16M1.5 16h15"],
  ["Value over time", "Ten years of assessed values for the building, set against similar condos in the same community.", "M2 15l4.5-5 3 3L16 5M12 5h4v4"],
  ["Major permits", "Roof, envelope, parkade, balcony and structural permits from the last 5 years, with declared values.", "M3 3h9l3 3v9H3zM6 8h6M6 11h4"],
];

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

function ResultList({ q, out }: { q: string; out: CondoSearchResponse }) {
  const { results, nearbyStreet } = out;
  if (results.length === 0) {
    return (
      <div className="report-paper px-6 py-5">
        <p className="font-semibold text-ink">No condo buildings match &ldquo;{q}&rdquo;.</p>
        <ul className="text-sm text-stone-600 mt-2 space-y-1 list-disc pl-5">
          <li>Use the street address as it appears on a tax notice, e.g. &ldquo;1111 6 Ave SW&rdquo;. A unit number is fine.</li>
          <li>Or search the condo plan number from the documents, e.g. &ldquo;0812345&rdquo;.</li>
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
          </>
        )}
      </p>
      <ul className="grid gap-3">
        {results.map((b) => (
          <li key={b.plan}>
            <Link
              href={`/calgary/${encodeURIComponent(b.plan)}`}
              className="group report-paper px-5 py-4 flex items-center gap-4 hover:border-ink transition-colors no-underline"
            >
              <span className="flex-1 min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink text-[17px] break-words">
                    {b.addresses[0] ?? `Condo plan ${b.plan}`}
                  </span>
                  <MatchBadge match={b.match} />
                </span>
                <span className="block text-[13px] text-stone-500 mt-1">
                  Plan {b.plan}
                  {b.community ? ` · ${b.community}` : ""}
                  {b.year_built ? ` · built ${b.year_built}` : ""}
                  {` · ${b.units} unit${b.units === 1 ? "" : "s"}`}
                  {b.addresses.length > 1 ? ` · also ${b.addresses.slice(1).join(", ")}` : ""}
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

async function Results({ q }: { q: string }) {
  let out: CondoSearchResponse | null;
  try {
    out = await cachedCondoSearch(q);
  } catch {
    return (
      <p className="report-paper px-6 py-5 text-sm text-stone-600">
        <strong className="text-ink">City data unavailable.</strong> The City of Calgary open-data service
        didn&apos;t answer in time. Please try again in a moment.
      </p>
    );
  }
  if (!out) {
    return (
      <p className="text-sm text-stone-600">
        Enter at least {MIN_QUERY} characters: a street address or a condo plan number.
      </p>
    );
  }
  return <ResultList q={q} out={out} />;
}

async function SearchArea({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").slice(0, 120).trim();
  return (
    <>
      <CalgarySearch defaultValue={query} />
      {query && (
        <div className="mt-8 text-left">
          <Suspense key={query} fallback={<p className="text-sm text-stone-500">Searching the City roll…</p>}>
            <Results q={query} />
          </Suspense>
        </div>
      )}
    </>
  );
}

/**
 * Public, no login: find a Calgary condo building on the City's assessment
 * roll and open its public-records report. No AI calls are made here.
 */
export default function CalgaryLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  return (
    <div>
      <section className="bg-surface border-b border-line">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-14 pb-12 sm:pt-20 sm:pb-16">
          <span className="micro-label text-accent-dark">Calgary public records · free · no sign-in</span>
          <h1 className="font-bold text-[34px] sm:text-5xl tracking-[-0.03em] leading-[1.08] text-ink mt-3" style={{ textWrap: "balance" }}>
            Check any Calgary condo before you read a single page.
          </h1>
          <p className="text-[17px] text-ink2 mt-4 mb-8 max-w-2xl leading-relaxed">
            Search by street address or condo plan number. ClearCondo pulls the building&apos;s record from City
            of Calgary open data: what it&apos;s assessed at, how that compares to similar buildings, and what
            major work has been permitted.
          </p>
          <Suspense fallback={<CalgarySearch />}>
            <SearchArea searchParams={searchParams} />
          </Suspense>
          <p className="text-[13px] text-subtle mt-3">
            A unit number is fine (&ldquo;1203-1111 6th Ave SW&rdquo;). Building names aren&apos;t on the City
            roll, so search the address or plan instead.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-14 sm:py-16">
        <h2 className="font-bold text-2xl tracking-tight text-ink">What you&apos;ll see</h2>
        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          {WHAT_YOU_GET.map(([title, body, icon]) => (
            <div key={title} className="report-paper p-6">
              <svg width="22" height="22" viewBox="0 0 18 18" aria-hidden className="text-accent">
                <path d={icon} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3 className="font-bold text-ink mt-3">{title}</h3>
              <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-[14px] bg-ink text-white p-6 sm:p-7 flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex-1 min-w-64">
            <h3 className="font-bold text-lg">Then add the documents for the full report</h3>
            <p className="text-sm text-[#c3cad4] mt-1.5 leading-relaxed">
              Minutes, reserve fund study and bylaws come from the seller or property manager. ClearCondo reads
              them for special assessments, reserve health and litigation, checks every claim against its page,
              and flags permits the minutes never mention.
            </p>
          </div>
          <Link
            href="/demo"
            className="btn-lift inline-flex items-center justify-center rounded-lg bg-white text-ink font-semibold text-[15px] px-5 min-h-11"
          >
            See a sample report
          </Link>
        </div>
        <p className="text-[13px] text-stone-500 mt-8">
          Source:{" "}
          <a href={datasetPageUrl(CALGARY_DATASETS.currentRoll)} target="_blank" rel="noopener noreferrer" className="underline">
            {DATASET_TITLES[CALGARY_DATASETS.currentRoll]}
          </a>
          , City of Calgary Open Data. Context, not a verdict.
        </p>
      </section>
    </div>
  );
}
