import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { searchCondoBuildings, MIN_QUERY, type CondoSearchResult } from "@/lib/calgary/search";
import { CALGARY_DATASETS, DATASET_TITLES, datasetPageUrl } from "@/lib/calgary/socrata";

export const metadata: Metadata = {
  title: "Look up a Calgary condo — ClearCondo",
  description:
    "Search any Calgary condo building by address or plan number: assessed value trend, similar buildings, and major permits from City of Calgary open data.",
};

/** Process-local cache of search results (City data changes daily at most). */
const SEARCH_TTL_MS = 60 * 60 * 1000;
const searchCache = new Map<string, { at: number; results: CondoSearchResult[] | null }>();

async function cachedSearch(q: string): Promise<CondoSearchResult[] | null> {
  const key = q.trim().toLowerCase();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_TTL_MS) return hit.results;
  const out = await searchCondoBuildings(q);
  const results = out ? out.results : null;
  if (searchCache.size > 500) searchCache.clear();
  searchCache.set(key, { at: Date.now(), results });
  return results;
}

function SearchForm({ defaultValue }: { defaultValue: string }) {
  return (
    <form action="/calgary" method="get" role="search" className="flex flex-col sm:flex-row gap-3">
      <label htmlFor="calgary-q" className="sr-only">
        Street address or condo plan number
      </label>
      <input
        id="calgary-q"
        name="q"
        defaultValue={defaultValue}
        minLength={MIN_QUERY}
        maxLength={80}
        required
        autoComplete="off"
        placeholder="e.g. 1111 6 Ave SW, or plan 0812345"
        className="flex-1 min-w-0 rounded-lg border border-line2 bg-white px-4 min-h-12 text-[16px] focus:outline-none focus:border-accent"
      />
      <button
        type="submit"
        className="btn-lift rounded-lg bg-ink hover:bg-accent text-white font-semibold text-[15px] px-6 min-h-12"
      >
        Search
      </button>
    </form>
  );
}

async function Results({ q }: { q: string }) {
  let results: CondoSearchResult[] | null;
  try {
    results = await cachedSearch(q);
  } catch {
    return (
      <p className="report-paper px-5 py-4 text-sm text-stone-600">
        <strong className="text-ink">City data unavailable.</strong> The City of Calgary open-data service
        didn&apos;t answer in time. Please try again in a moment.
      </p>
    );
  }
  if (results === null) {
    return (
      <p className="text-sm text-stone-600">
        Enter at least {MIN_QUERY} characters: a street address (with or without the unit number) or a
        condo plan number.
      </p>
    );
  }
  if (results.length === 0) {
    return (
      <p className="report-paper px-5 py-4 text-sm text-stone-600">
        No condo buildings on the City&apos;s assessment roll match <strong className="text-ink">{q}</strong>.
        Try the street address as it appears on a tax notice (e.g. &ldquo;1111 6 Ave SW&rdquo;) or the condo
        plan number. Building names aren&apos;t on the City roll, so they can&apos;t be searched.
      </p>
    );
  }
  return (
    <div>
      <p className="text-sm text-stone-500 mb-3">
        {results.length} condo building{results.length === 1 ? "" : "s"} on the City roll
      </p>
      <ul className="space-y-3">
        {results.map((b) => (
          <li key={b.plan}>
            <Link
              href={`/calgary/${encodeURIComponent(b.plan)}`}
              className="report-paper px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-1 hover:border-ink transition-colors no-underline"
            >
              <span className="flex-1 min-w-48">
                <span className="block font-semibold text-ink">{b.addresses[0] ?? `Condo plan ${b.plan}`}</span>
                <span className="block text-[13px] text-stone-500 mt-0.5">
                  Plan {b.plan}
                  {b.community ? ` · ${b.community}` : ""}
                  {b.year_built ? ` · built ${b.year_built}` : ""}
                  {b.addresses.length > 1 ? ` · also ${b.addresses.slice(1).join(", ")}` : ""}
                </span>
              </span>
              <span className="micro-label text-stone-600 bg-stone-100 px-2 py-1">
                {b.units} unit{b.units === 1 ? "" : "s"} matched
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function SearchArea({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").slice(0, 120).trim();
  return (
    <>
      <SearchForm defaultValue={query} />
      {query && (
        <div className="mt-8">
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
 * roll and open its public-records report. No AI calls are made here, so
 * there's no per-search cost beyond the free City API.
 */
export default function CalgaryLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12 sm:py-14">
      <span className="micro-label text-stone-400">Calgary public records</span>
      <h1 className="font-bold text-3xl sm:text-4xl tracking-[-0.02em] text-ink mt-1.5">
        Look up a Calgary condo
      </h1>
      <p className="text-[17px] text-ink2 mt-3 mb-7 max-w-2xl leading-relaxed">
        Search by street address or condo plan number. You&apos;ll see the building&apos;s assessed value
        trend against similar buildings and its major permits from the last 5 years, straight from City of
        Calgary open data. No sign-in, no documents needed.
      </p>
      <Suspense fallback={<SearchForm defaultValue="" />}>
        <SearchArea searchParams={searchParams} />
      </Suspense>
      <p className="text-[13px] text-stone-500 mt-10">
        Source:{" "}
        <a href={datasetPageUrl(CALGARY_DATASETS.currentRoll)} target="_blank" rel="noopener noreferrer" className="underline">
          {DATASET_TITLES[CALGARY_DATASETS.currentRoll]}
        </a>
        , City of Calgary Open Data. Context, not a verdict.
      </p>
    </div>
  );
}
