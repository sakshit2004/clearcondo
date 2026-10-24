import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getUserId } from "@/lib/auth";
import { isDbConfigured, listOwnerProperties, withDb, type OwnerPropertyRow } from "@/lib/db";
import { cad, formatDate } from "@/lib/format";
import { ownerBuildingHref } from "@/lib/owner-links";
import CalgarySearch from "@/components/CalgarySearch";
import OwnerSearchResults from "@/components/owner/OwnerSearchResults";
import OwnerPricing from "@/components/owner/OwnerPricing";

export const metadata: Metadata = {
  title: "Property tax — ClearCondo",
  description: "Check your Calgary condo's property tax assessment, see the tax it means, and get a savings estimate.",
};

/** The other owner bills, in the order ClearCondo is taking them on. */
const COMING = ["Home & condo insurance", "Energy & electricity", "Mortgage & refinancing"];

const STEPS: [string, string][] = [
  ["Find your unit", "Search the address on your tax notice, with your unit number."],
  ["See the facts", "Your unit's assessment, the tax it means, and how it sits against the building."],
  ["Get your number", "Tell us about the unit and we reply with your potential saving."],
];

function Properties({ rows }: { rows: OwnerPropertyRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="report-paper rounded-2xl p-6 sm:p-8" aria-labelledby="my-props">
      <h2 id="my-props" className="text-lg font-bold">Your properties</h2>
      <p className="text-sm text-subtle mt-1 mb-4">Saved when you check a unit. Checked again each time you open it.</p>
      <ul className="divide-y divide-[#eceee9]">
        {rows.map((p) => (
          <li key={p.id}>
            <Link href={ownerBuildingHref(p.plan, p.unit)} className="group flex items-center gap-4 py-3.5 no-underline">
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-ink truncate">{p.address}</span>
                <span className="block text-[13px] text-subtle">
                  Plan {p.plan} · checked {formatDate(p.checked_at)}
                  {p.requested_at && " · estimate requested"}
                </span>
              </span>
              <span className="text-right tabular-nums">
                <span className="block font-semibold text-ink">{cad(p.assessed_value)}</span>
                <span className="block text-[13px] text-subtle">
                  {p.est_tax != null ? `${cad(p.est_tax)}/yr tax` : "—"}
                </span>
              </span>
              <span aria-hidden className="text-subtle group-hover:text-ink transition">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function SavedProperties() {
  const userId = await getUserId();
  if (!userId || !isDbConfigured()) return null;
  let rows: OwnerPropertyRow[] = [];
  try {
    rows = (await withDb((db) => listOwnerProperties(db, userId))) ?? [];
  } catch {
    return null;
  }
  return <Properties rows={rows} />;
}

/**
 * Owning, signed in: find your Calgary condo unit and check its property
 * tax. Mirrors the buying side's layout (New analysis): a main column for
 * the work and an aside for pricing and what's next.
 */
export default async function OwnPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").slice(0, 120).trim();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div className="max-w-2xl">
          <span className="micro-label text-accent-dark">Owning · Calgary</span>
          <h1 className="rise-in font-bold text-3xl sm:text-4xl tracking-[-0.025em] mt-1.5">Property tax</h1>
          <p className="rise-in text-muted text-[17px] leading-relaxed mt-2" style={{ animationDelay: "80ms" }}>
            Find your unit on the City&apos;s assessment roll. See what it&apos;s assessed at, the tax that comes
            with it, and whether you could be paying less.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-8 items-start">
        <div className="flex-[999_1_560px] min-w-0 space-y-4">
          <section className="report-paper rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold mb-1">Find your condo</h2>
            <p className="text-sm text-subtle mb-5">
              The address on your tax notice, with your unit number, or the condo plan number.
            </p>
            <CalgarySearch defaultValue={query} />
            <p className="text-[13px] text-subtle mt-3">
              e.g. &ldquo;1203-1111 6 Ave SW&rdquo; or &ldquo;#1203 1111 6 Ave SW&rdquo;. Building names aren&apos;t on
              the City roll.
            </p>
          </section>

          {query && (
            <Suspense key={query} fallback={<p className="text-sm text-stone-500 px-1">Searching the City roll…</p>}>
              <OwnerSearchResults q={query} />
            </Suspense>
          )}

          <Suspense fallback={null}>
            <SavedProperties />
          </Suspense>

          <section className="report-paper rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold mb-4">How it works</h2>
            <ol className="grid sm:grid-cols-3 gap-5">
              {STEPS.map(([title, body], i) => (
                <li key={title}>
                  <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-accent-soft text-accent-dark text-sm font-bold">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold text-ink mt-2">{title}</h3>
                  <p className="text-sm text-stone-600 mt-1 leading-relaxed">{body}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="flex-[1_1_300px] space-y-4" aria-label="Pricing and what's next">
          <OwnerPricing />
          <section className="report-paper rounded-2xl p-6">
            <h2 className="text-lg font-bold">Coming next</h2>
            <p className="text-sm text-subtle mt-1 mb-3">The other bills that come with owning a condo.</p>
            <ul className="space-y-2">
              {COMING.map((c) => (
                <li key={c} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink">{c}</span>
                  <span className="rounded-md bg-info-soft text-info-dark px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                    Soon
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
