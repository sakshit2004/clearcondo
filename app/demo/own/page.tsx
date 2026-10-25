import type { Metadata } from "next";
import Link from "next/link";
import type { UnitRecord } from "@/lib/calgary/unit";
import { estimateSaving } from "@/lib/owner-estimate";
import type { SharedFactRow } from "@/lib/shared-record";
import EstimateCard from "@/components/owner/EstimateCard";
import { OwnerBuildingRecord } from "@/components/SharedRecord";
import UnitTaxCard from "@/components/owner/UnitTaxCard";
import SavingsPanel from "@/components/owner/SavingsPanel";
import OwnerPricing from "@/components/owner/OwnerPricing";

export const metadata: Metadata = {
  title: "Sample owner report — ClearCondo",
  description: "What an owner sees: a condo unit's assessment, the property tax it means, a savings estimate, and the building's money over time. Sample data.",
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

/** What the owner entered (sample): their purchase, an appraisal, and sales of similar units. */
const ESTIMATE = estimateSaving({
  assessed_value: UNIT.assessed_value!,
  unit_size_sqft: 690,
  purchase_price: 389_000,
  purchase_date: "2025-04",
  appraisal_value: 392_000,
  appraisal_date: "2025-08",
  comparables: [
    { price: 372_000, sqft: 680, date: "2025-06" },
    { price: 401_000, sqft: 720, date: "2025-03" },
    { price: 384_500, sqft: 700, date: "2025-09" },
  ],
});
const SAMPLE_SAVING = ESTIMATE.annual_saving;

/** The building's shared record (sample): dated facts from earlier packages and the City. */
const r = (o: Partial<SharedFactRow> & Pick<SharedFactRow, "fact_key" | "label" | "as_of">): SharedFactRow => ({
  kind: "money",
  value_num: null,
  value_text: null,
  doc_type: null,
  page: null,
  source: "document",
  seen_count: 1,
  first_seen: "",
  ...o,
});
const RECORD: SharedFactRow[] = [
  r({ fact_key: "reserve_balance", label: "Reserve fund balance", value_num: 1_180_000, as_of: "2026-03", doc_type: "reserve_study", page: 4 }),
  r({ fact_key: "reserve_balance", label: "Reserve fund balance", value_num: 1_420_000, as_of: "2025-03", doc_type: "financials", page: 6 }),
  r({ fact_key: "contribution_monthly", label: "Average monthly condo fee", value_num: 512, as_of: "2026-03", doc_type: "budget", page: 2 }),
  r({ fact_key: "contribution_monthly", label: "Average monthly condo fee", value_num: 468, as_of: "2025-03", doc_type: "budget", page: 2 }),
  r({ fact_key: "special_assessment:balcony-repairs", label: "Special assessment: Balcony repairs (per unit)", value_num: 3_400, value_text: "proposed", as_of: "2026-03", doc_type: "minutes_agm", page: 3 }),
  r({ fact_key: "city_median_assessment", label: "Median home assessment (City of Calgary)", value_num: 365_000, as_of: "2025-07", source: "public_record" }),
  r({ fact_key: "city_median_assessment", label: "Median home assessment (City of Calgary)", value_num: 347_500, as_of: "2024-07", source: "public_record" }),
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
            A fictional Calgary condo unit: its assessment and tax, how it sits against the building, an instant
            savings estimate, and the building&apos;s money over time.
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
                The owner entered three things: what they paid in April 2025, an appraisal, and three sales of similar
                units. The estimate is worked out in the open, then we check it by hand.
              </p>
              <EstimateCard estimate={ESTIMATE} />
              <p className="text-[13px] text-stone-500 mt-4 leading-relaxed max-w-2xl">
                Sample only. Nothing is filed with the City without your go-ahead. A complaint can lower the value, keep
                it, or occasionally raise it.
              </p>
            </section>

            <OwnerBuildingRecord rows={RECORD} />
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
