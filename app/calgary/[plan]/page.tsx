import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { normalizePlanNumber } from "@/lib/calgary/match";
import { assessReport, getCityRecords } from "@/lib/calgary/check";
import PublicRecordsSection from "@/components/PublicRecordsSection";
import { PublicRecordsPending } from "@/components/PublicRecords";

export const metadata: Metadata = {
  title: "Calgary condo public records — ClearCondo",
  description:
    "A Calgary condo building's assessed value trend, similar buildings, and major permits from City of Calgary open data.",
};

/** Where "add documents" goes: the upload flow, with the building pre-filled. */
function addDocsHref(plan: string, address: string | null): string {
  const name = address ?? `Condo plan ${plan}`;
  return `/app/new?building=${encodeURIComponent(name)}`;
}

async function BuildingRecords({ params }: { params: Promise<{ plan: string }> }) {
  const { plan: raw } = await params;
  const plan = normalizePlanNumber(decodeURIComponent(raw));
  if (!plan) notFound();

  // Same 24h process cache as reports; keyed by plan, no owner (public data).
  const { records } = await getCityRecords({ planCandidates: [plan], address: null }, { cacheKey: `plan:${plan}` });
  const check = assessReport(records, { docPlans: [plan], docAddress: null, docUnits: null, docs: [] });
  const address = records.status === "matched" ? records.building_addresses[0] ?? null : null;

  return (
    <>
      <h1 className="font-bold text-3xl sm:text-4xl tracking-[-0.02em] text-ink mt-1.5 mb-6 break-words">
        {address ?? `Condo plan ${plan}`}
      </h1>
      <PublicRecordsSection check={check} lookup={{ addDocsHref: addDocsHref(plan, address) }} />
    </>
  );
}

/**
 * Public, no login: one Calgary condo building's public-records report,
 * before any documents. Uploading documents (sign-in) adds the full
 * red-flag analysis on top.
 */
export default function CalgaryBuildingPage({ params }: { params: Promise<{ plan: string }> }) {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 sm:py-12">
      <Link href="/calgary" className="text-[15px] text-muted hover:text-ink">
        ← Search another building
      </Link>
      <div className="mt-6">
        <span className="micro-label text-stone-400">Calgary condo</span>
        <Suspense fallback={<div className="mt-4"><PublicRecordsPending /></div>}>
          <BuildingRecords params={params} />
        </Suspense>
      </div>
    </div>
  );
}
