import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { withDb, getBuildingHistory, isDbConfigured } from "@/lib/db";
import { cad, formatDate } from "@/lib/format";
import { FLAG_TYPE_LABELS } from "@/lib/report-schema";
import SetupNotice from "@/components/SetupNotice";
import SeverityBadge from "@/components/SeverityBadge";
import AgentMemoryPanel from "@/components/AgentMemoryPanel";
import BuildingTimeline from "@/components/BuildingTimeline";
import { pointFromFacts } from "@/lib/timeline";
import type { Severity } from "@/lib/report-schema";


const shortId = (rid: string) => {
  const parts = String(rid).split(":");
  return encodeURIComponent(parts.length > 1 ? parts[1] : rid);
};

/** Collapse flags across reports into distinct issues with occurrence counts. */
function accumulateFlags(flags: { flag_type: string; severity: string; title: string; created_at: string; report: string }[]) {
  const map = new Map<string, { flag_type: string; severity: string; title: string; firstSeen: string; reports: Set<string> }>();
  for (const f of flags) {
    const key = `${f.flag_type}::${f.title}`;
    const existing = map.get(key);
    if (existing) {
      existing.reports.add(String(f.report));
      if (String(f.created_at) < existing.firstSeen) existing.firstSeen = String(f.created_at);
    } else {
      map.set(key, {
        flag_type: f.flag_type,
        severity: f.severity,
        title: f.title,
        firstSeen: String(f.created_at),
        reports: new Set([String(f.report)]),
      });
    }
  }
  return [...map.values()].sort((a, b) => b.reports.size - a.reports.size);
}

export default async function BuildingHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isClerkConfigured()) return <SetupNotice />;
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");
  if (!isDbConfigured()) return notFound();

  const { id } = await params;
  const fullId = `building:${decodeURIComponent(id)}`;
  const data = await withDb((db) => getBuildingHistory(db, userId, fullId));
  if (!data) return notFound();

  const { building, reports, flags } = data;
  const accumulated = accumulateFlags(flags);

  return (
    <div className="max-w-4xl">
      <div className="mb-9">
        <span className="micro-label text-stone-400">Building memory</span>
        <h1 className="font-bold text-4xl tracking-[-0.02em] text-ink mt-1.5">{building.name}</h1>
        <p className="data-label text-stone-500 mt-2.5">
          {[building.corp_number ? `Corp No. ${building.corp_number}` : null, building.address, building.units ? `${building.units} units` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-sm text-stone-600 mt-3">
          {reports.length} report{reports.length === 1 ? "" : "s"} ·{" "}
          {accumulated.length} distinct issue{accumulated.length === 1 ? "" : "s"} tracked
          in this building&apos;s memory.
        </p>
      </div>

      {/* Risk over time — reserve health / exposure / deductible across reviews */}
      {reports.length >= 2 && (
        <div className="mb-10">
          <BuildingTimeline
            points={reports.flatMap((r) =>
              r.facts_snapshot
                ? [
                    pointFromFacts({
                      facts: r.facts_snapshot,
                      docDate: r.doc_date,
                      exposureCad: r.money_exposure_total_cad,
                      fallbackLabel: formatDate(String(r.created_at)),
                      fallbackSortKey: String(r.created_at),
                    }),
                  ]
                : []
            )}
          />
        </div>
      )}

      {/* Accumulated memory */}
      <section className="mb-10">
        <h2 className="font-bold text-2xl tracking-tight text-ink mb-4">Building memory</h2>
        {accumulated.length === 0 ? (
          <p className="text-stone-600 text-sm">No flags recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {accumulated.map((a, i) => (
              <div key={i} className="report-paper px-5 py-4 flex flex-wrap items-center gap-3">
                <SeverityBadge severity={a.severity as Severity} />
                <div className="flex-1 min-w-48">
                  <div className="font-semibold text-ink">{a.title}</div>
                  <div className="micro-label !text-[10px] text-stone-500 mt-1">
                    {FLAG_TYPE_LABELS[a.flag_type as keyof typeof FLAG_TYPE_LABELS] || a.flag_type}
                    {" · "}first seen {formatDate(a.firstSeen)}
                  </div>
                </div>
                <span className="micro-label text-stone-600 bg-stone-100 px-2 py-1">
                  seen in {a.reports.size} report{a.reports.size === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Agent Memory recall — reconciled beliefs, when configured */}
      <AgentMemoryPanel ownerId={userId} buildingRecordId={fullId} />

      {/* Report timeline */}
      <section>
        <h2 className="font-bold text-2xl tracking-tight text-ink mb-4">Reports</h2>
        <div className="space-y-3">
          {reports.map((r) => (
            <Link
              key={String(r.id)}
              href={`/app/reports/${shortId(r.id)}`}
              className="report-paper px-5 py-4 flex items-center gap-4 hover:border-ink transition-colors"
            >
              <div className="flex-1">
                <div className="micro-label !text-[10px] text-stone-500">{formatDate(String(r.created_at))}</div>
                <div className="text-stone-700 text-sm line-clamp-2 mt-1.5">{r.summary}</div>
              </div>
              {r.money_exposure_total_cad != null && (
                <div className="font-bold text-2xl text-ink tabular-nums">{cad(r.money_exposure_total_cad)}</div>
              )}
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8">
        <Link
          href="/app/new"
          className="inline-block bg-ink text-white hover:bg-accent px-6 py-3 font-semibold text-sm transition-colors"
        >
          Upload fresh documents for this building
        </Link>
      </div>
    </div>
  );
}
