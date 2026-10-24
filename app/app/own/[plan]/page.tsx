import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { getUserId } from "@/lib/auth";
import { getOwnerProperty, isDbConfigured, upsertOwnerProperty, withDb } from "@/lib/db";
import { normalizePlanNumber } from "@/lib/calgary/match";
import { assessReport, getCityRecords } from "@/lib/calgary/check";
import { CALGARY_DATASETS, datasetPageUrl } from "@/lib/calgary/socrata";
import { fetchUnitRecord } from "@/lib/calgary/unit";
import { annualSaving, ownerSavingsCut } from "@/lib/owner";
import PublicRecordsSection from "@/components/PublicRecordsSection";
import { PublicRecordsPending } from "@/components/PublicRecords";
import UnitTaxCard from "@/components/owner/UnitTaxCard";
import OwnerRequestForm from "@/components/owner/OwnerRequestForm";
import OwnerPricing from "@/components/owner/OwnerPricing";
import SavingsPanel from "@/components/owner/SavingsPanel";

export const metadata: Metadata = {
  title: "Your property tax — ClearCondo",
  description: "Your Calgary condo unit's assessment, the property tax it means, and your potential saving.",
};

type Params = Promise<{ plan: string }>;
type Search = Promise<{ unit?: string | string[] }>;

const SAFE_UNIT = /^[0-9]{1,6}[A-Z]?$/;

function UnitPicker({ plan, unit, notFoundUnit }: { plan: string; unit: string; notFoundUnit: boolean }) {
  return (
    <section className="report-paper rounded-2xl p-6 sm:p-8" aria-labelledby="pick-unit">
      <h2 id="pick-unit" className="text-lg font-bold">Which unit is yours?</h2>
      <p className="text-sm text-subtle mt-1 mb-4">
        {notFoundUnit
          ? `Unit ${unit} isn't on the City roll for condo plan ${plan}. Check the unit number on your tax notice.`
          : "Add your unit number to see its own assessment and tax, not just the building's."}
      </p>
      <form method="get" className="flex flex-wrap gap-3">
        <label htmlFor="unit-no" className="sr-only">Unit number</label>
        <input
          id="unit-no"
          name="unit"
          required
          maxLength={8}
          defaultValue={unit}
          placeholder="e.g. 1203"
          className="field-input w-40 rounded-lg border border-line2 bg-white px-3.5 min-h-[46px] text-[15px] text-ink placeholder:text-subtle focus:outline-2 focus:outline-accent focus:border-accent"
        />
        <button type="submit" className="btn-lift rounded-lg bg-ink hover:bg-accent text-white font-semibold text-[15px] px-5 min-h-[46px]">
          Check my unit
        </button>
      </form>
    </section>
  );
}

async function OwnerUnit({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ plan: raw }, sp] = await Promise.all([params, searchParams]);
  const plan = normalizePlanNumber(decodeURIComponent(raw));
  if (!plan) notFound();
  const wanted = (typeof sp.unit === "string" ? sp.unit : "").trim().toUpperCase().replace(/^#/, "");
  const unitParam = SAFE_UNIT.test(wanted) ? wanted : "";

  const [{ records }, unitResult] = await Promise.all([
    getCityRecords({ planCandidates: [plan], address: null }, { cacheKey: `plan:${plan}` }),
    unitParam
      ? fetchUnitRecord(plan, unitParam).then(
          (u) => ({ ok: true as const, unit: u }),
          () => ({ ok: false as const, unit: null })
        )
      : Promise.resolve({ ok: true as const, unit: null }),
  ]);
  const check = assessReport(records, { docPlans: [plan], docAddress: null, docUnits: null, docs: [] });
  const matched = records.status === "matched" ? records : null;
  const buildingAddress = matched?.building_addresses[0] ?? null;
  const unit = unitResult.unit;

  // Save the checked unit to the owner's properties (best effort).
  const userId = await getUserId();
  const alreadyRequested =
    userId && unit && isDbConfigured()
      ? await withDb(async (db) => {
          await upsertOwnerProperty(db, userId, { ...unit, plan });
          return Boolean((await getOwnerProperty(db, userId, plan, unit.unit))?.requested_at);
        }).catch(() => false) // the page works without it
      : false;
  const user = userId ? await currentUser().catch(() => null) : null;

  const cut = ownerSavingsCut();
  const saving = unit?.assessed_value != null && cut ? Math.round(annualSaving(unit.assessed_value, cut)) : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div className="max-w-2xl min-w-0">
          <span className="micro-label text-accent-dark">Owning · Property tax</span>
          <h1 className="rise-in font-bold text-3xl sm:text-4xl tracking-[-0.025em] mt-1.5 break-words">
            {unit ? unit.address : buildingAddress ?? `Condo plan ${plan}`}
          </h1>
          <p className="rise-in text-muted text-[17px] leading-relaxed mt-2" style={{ animationDelay: "80ms" }}>
            Condo plan {plan}
            {matched?.comm_name ? ` · ${matched.comm_name}` : ""}
            {matched?.year_of_construction ? ` · built ${matched.year_of_construction}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-8 items-start">
        <div className="flex-[999_1_560px] min-w-0 space-y-4">
          {!unitResult.ok ? (
            <p className="report-paper rounded-2xl px-6 py-5 text-sm text-stone-600">
              <strong className="text-ink">City data unavailable.</strong> Your unit&apos;s record couldn&apos;t be
              loaded. Please try again in a moment.
            </p>
          ) : unit ? (
            <UnitTaxCard
              unit={unit}
              buildingMedian={matched?.current_median ?? null}
              sourceUrl={matched?.roll_query_url ?? datasetPageUrl(CALGARY_DATASETS.currentRoll)}
            />
          ) : (
            <UnitPicker plan={plan} unit={unitParam || wanted} notFoundUnit={Boolean(unitParam)} />
          )}

          <SavingsPanel unit={unit} saving={saving} />

          <section id="estimate" className="report-paper rounded-2xl p-6 sm:p-8 scroll-mt-6" aria-labelledby="estimate-heading">
            <h2 id="estimate-heading" className="text-lg font-bold">Get my savings estimate</h2>
            <p className="text-sm text-subtle mt-1 mb-6 max-w-2xl">
              Add what you know and see an instant estimate. We then check it against recent sales and confirm by email, before anything is filed.
            </p>
            <OwnerRequestForm
              plan={plan}
              address={unit?.address ?? buildingAddress}
              unit={unit?.unit ?? (unitParam || null)}
              defaultName={user?.fullName ?? ""}
              defaultEmail={user?.primaryEmailAddress?.emailAddress ?? ""}
              alreadyRequested={Boolean(alreadyRequested)}
              assessedValue={unit?.assessed_value ?? null}
            />
          </section>

          <div className="pt-4">
            <h2 className="font-bold text-xl tracking-tight text-ink mb-3">Your building</h2>
            <PublicRecordsSection check={check} lookup={{}} />
          </div>
        </div>

        <aside className="flex-[1_1_300px] space-y-4" aria-label="Pricing and deadlines">
          <OwnerPricing saving={saving} />
          <section className="report-paper rounded-2xl p-6">
            <h2 className="text-lg font-bold">What the estimate uses</h2>
            <ul className="text-sm text-stone-600 mt-3 space-y-2 list-disc pl-5 leading-relaxed">
              <li>Your unit&apos;s size, layout, parking and storage</li>
              <li>Condition and renovations</li>
              <li>Recent sales of comparable units</li>
              <li>The City&apos;s value, and any past complaints</li>
            </ul>
            <p className="text-[13px] text-subtle mt-4 leading-relaxed">
              Assessment notices go out each January, and complaints to the Assessment
              Review Board have a deadline about two months later. Check yours early.
            </p>
          </section>
          <Link href="/app/own" className="block text-[15px] text-muted hover:text-ink px-1">
            ← Check another unit
          </Link>
        </aside>
      </div>
    </>
  );
}

function Pending() {
  return (
    <div className="space-y-4">
      <div className="h-24" aria-hidden />
      <PublicRecordsPending />
    </div>
  );
}

/** Owning, signed in: one unit's property tax, a savings estimate, and the building's public record. */
export default function OwnerUnitPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <Suspense fallback={<Pending />}>
      <OwnerUnit params={params} searchParams={searchParams} />
    </Suspense>
  );
}
