import type { Metadata } from "next";
import Link from "next/link";
import { annualTax } from "@/lib/calgary/appeals";
import { cad } from "@/lib/format";
import type { UnitRecord } from "@/lib/calgary/unit";
import UnitTaxCard from "@/components/owner/UnitTaxCard";
import SavingsPanel from "@/components/owner/SavingsPanel";
import OwnerPricing from "@/components/owner/OwnerPricing";

export const metadata: Metadata = {
  title: "Sample owner report — ClearCondo",
  description: "What an owner sees: a condo unit's assessment, the property tax it means, and a savings estimate. Sample data.",
};

/** A fictional unit. Every number on this page is sample data. */
const UNIT: UnitRecord = {
  unit: "1203",
  address: "1203 500 SAMPLE ST SW",
  assessed_value: 412_000,
  roll_year: 2026,
  prev_year: 2025,
  prev_value: 389_000,
  change: 412_000 / 389_000 - 1,
  complaints: [],
};
const BUILDING_MEDIAN = 365_000;
const SUGGESTED_VALUE = 392_000;
const SAMPLE_SAVING = Math.round(annualTax(UNIT.assessed_value!) - annualTax(SUGGESTED_VALUE));

/** The facts an owner sent with their request (sample). */
const SENT: [string, string][] = [
  ["Size", "690 sq ft"],
  ["Layout", "1 bed, 1 bath"],
  ["Parking", "Assigned stall"],
  ["Condition", "Original 2008 kitchen and bath"],
];

/**
 * Sample owner report, public: what /app/own shows for a unit, plus what
 * a savings-estimate reply looks like. Fictional unit, labelled as such.
 */
export default function OwnerDemoPage() {
  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="rise-in rounded-[14px] border border-line bg-white px-5 py-4 text-sm mb-8 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="rounded-md bg-accent-soft text-accent-dark text-xs font-semibold px-2 py-1">Sample data</span>
          <span className="text-muted">
            A fictional Calgary condo unit, showing what an owner sees after searching their address, and what a
            savings estimate looks like.
          </span>
        </div>

        <div className="mb-8 max-w-2xl">
          <span className="micro-label text-accent-dark">Owning · Property tax</span>
          <h1 className="rise-in font-bold text-3xl sm:text-4xl tracking-[-0.025em] mt-1.5">{UNIT.address}</h1>
          <p className="rise-in text-muted text-[17px] leading-relaxed mt-2" style={{ animationDelay: "80ms" }}>
            Sample building · built 2008 · 120 units
          </p>
        </div>

        <div className="flex flex-wrap gap-8 items-start">
          <div className="flex-[999_1_560px] min-w-0 space-y-4">
            <UnitTaxCard unit={UNIT} buildingMedian={BUILDING_MEDIAN} />
            <SavingsPanel unit={UNIT} saving={null} ctaHref="/app/own" ctaLabel="Check my property tax" />

            <section className="report-paper rounded-2xl p-6 sm:p-8" aria-labelledby="sample-estimate">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="sample-estimate" className="text-lg font-bold">Your savings estimate</h2>
                <span className="rounded-md bg-warn-soft text-warn-dark px-2 py-0.5 text-xs font-semibold">Sample</span>
              </div>
              <p className="text-sm text-subtle mt-1 mb-5 max-w-2xl">
                What comes back after the owner sends the details open data can&apos;t see.
              </p>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                {SENT.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="micro-label text-stone-400">{k}</dt>
                    <dd className="text-ink font-semibold mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  [cad(UNIT.assessed_value), "City's 2026 value"],
                  [cad(SUGGESTED_VALUE), "Value comparable sales support"],
                  [`~${cad(SAMPLE_SAVING)}/yr`, "Potential tax saving"],
                ].map(([v, l], i) => (
                  <div key={l} className={`rounded-xl border p-4 ${i === 2 ? "border-ink" : "border-line bg-white"}`}>
                    <div className="text-2xl font-bold tracking-tight text-ink tabular-nums">{v}</div>
                    <div className="text-[13px] text-ink2 mt-0.5">{l}</div>
                  </div>
                ))}
              </div>
              <p className="text-[13px] text-stone-500 mt-4 leading-relaxed max-w-2xl">
                Sample only: a real estimate compares your unit with recent sales of similar units, and nothing is filed
                with the City without your go-ahead. A complaint can lower the value, keep it, or occasionally raise it.
              </p>
            </section>
          </div>

          <aside className="flex-[1_1_300px] space-y-4" aria-label="Pricing">
            <OwnerPricing saving={SAMPLE_SAVING} />
            <section className="rounded-2xl bg-ink text-white p-6">
              <h2 className="text-lg font-bold">Check your own unit</h2>
              <p className="text-sm text-[#c3cad4] mt-1.5 mb-4 leading-relaxed">
                Search your address with your unit number. Free during beta.
              </p>
              <Link
                href="/app/own"
                className="btn-lift inline-flex items-center justify-center rounded-lg bg-white text-ink font-semibold text-[15px] px-5 min-h-11"
              >
                Check my property tax
              </Link>
            </section>
            <Link href="/" className="block text-[15px] text-muted hover:text-ink px-1">
              ← Home
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
