import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import CalgarySearch from "@/components/CalgarySearch";
import { cachedCondoSearch } from "@/lib/calgary/search-cache";
import { MIN_QUERY, type CondoSearchResponse, type MatchQuality } from "@/lib/calgary/search";
import { CALGARY_DATASETS, DATASET_TITLES, datasetPageUrl } from "@/lib/calgary/socrata";

export const metadata: Metadata = {
  title: "Check your condo's property tax — ClearCondo",
  description:
    "Check your Calgary condo's property tax: what the City says your building is worth against similar buildings, the tax on a typical unit, past assessment appeals and major work on record, from City of Calgary open data.",
};

const MATCH_LABEL: Record<MatchQuality, string | null> = {
  exact: "Exact address",
  prefix: null,
  words: null,
  plan: "Plan number",
  nearby: "Same street",
};

const WHAT_YOU_GET: [string, string, string][] = [
  [
    "What the City says it's worth",
    "Ten years of City assessments for the building, against similar condos in the same community.",
    "M2 15l4.5-5 3 3L16 5M12 5h4v4",
  ],
  [
    "Your tax & past appeals",
    "The yearly tax on a typical unit, and whether owners have appealed their assessments before.",
    "M3 2h12v14l-2-1.5L11 16l-2-1.5L7 16l-2-1.5L3 16zM6 6h6M6 9h6M6 12h3",
  ],
  [
    "Major work on record",
    "Roof, envelope, parkade, balcony and structural permits from the last 5 years, with declared values.",
    "M3 3h9l3 3v9H3zM6 8h6M6 11h4",
  ],
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
          <span className="micro-label text-accent-dark">Property tax check · Calgary · free · no sign-in</span>
          <h1 className="font-bold text-[34px] sm:text-5xl tracking-[-0.03em] leading-[1.08] text-ink mt-3" style={{ textWrap: "balance" }}>
            Check your condo&apos;s property tax.
          </h1>
          <p className="text-[17px] text-ink2 mt-4 mb-8 max-w-2xl leading-relaxed">
            Search your building by address or condo plan number. See what the City says it&apos;s worth against
            similar buildings, the property tax on a typical unit, whether owners have appealed their
            assessments, and the major work on record.
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
        <h2 className="font-bold text-2xl tracking-tight text-ink">What the check shows</h2>
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
            <h3 className="font-bold text-lg">Property tax is where owner savings start.</h3>
            <p className="text-sm text-[#c3cad4] mt-1.5 leading-relaxed">
              Insurance, energy and your mortgage are next. Buying instead? Upload the condo&apos;s document package
              and ClearCondo prices what&apos;s buried in it, every claim traced to its page.
            </p>
          </div>
          <Link
            href="/own"
            className="btn-lift inline-flex items-center justify-center rounded-lg bg-white text-ink font-semibold text-[15px] px-5 min-h-11"
          >
            More ways owners save
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
