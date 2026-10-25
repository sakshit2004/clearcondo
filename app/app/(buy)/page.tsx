import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { withDb, listReports, dbQuery, isDbConfigured } from "@/lib/db";
import { cad, formatDate, timeAgo } from "@/lib/format";
import SetupNotice from "@/components/SetupNotice";
import SeverityBar, { type SeverityMix } from "@/components/SeverityBar";


export default async function DashboardPage() {
  // DB-backed and per-user: render at request time (see /app layout).
  await connection();
  if (!isClerkConfigured()) return <SetupNotice />;
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  if (!isDbConfigured()) {
    return <DbNotice />;
  }

  const data = await withDb(async (db) => {
    const reports = await listReports(db, userId);
    const counts = await dbQuery<{ id: string; severity: string; n: number }[]>(
      db,
      `SELECT report AS id, severity, count() AS n FROM flag WHERE owner_id = $owner GROUP BY report, severity`,
      { owner: userId }
    );
    const mix = new Map<string, SeverityMix>();
    for (const c of counts ?? []) {
      const m = mix.get(String(c.id)) ?? { critical: 0, warning: 0, info: 0 };
      if (c.severity === "critical" || c.severity === "warning" || c.severity === "info") m[c.severity] += c.n;
      mix.set(String(c.id), m);
    }
    return reports.map((r) => {
      const m = mix.get(String(r.id)) ?? { critical: 0, warning: 0, info: 0 };
      return { ...r, mix: m, flagCount: m.critical + m.warning + m.info };
    });
  });

  const reports = data ?? [];
  const maxExposure = Math.max(0, ...reports.map((r) => r.money_exposure_total_cad ?? 0));

  return (
    <div>
      <div className="flex items-end justify-between mb-7">
        <div>
          <span className="micro-label text-stone-400">Dashboard</span>
          <h1 className="font-bold text-4xl tracking-[-0.02em] text-ink mt-1.5">
            My reports
          </h1>
        </div>
        <Link
          href="/app/new"
          className="bg-ink text-white hover:bg-accent px-5 py-2.5 font-semibold text-sm transition-colors"
        >
          New analysis
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="border-2 border-dashed border-stone-300 bg-white p-10 text-center">
          <h2 className="font-bold text-2xl tracking-tight text-ink mb-2">
            No reports yet
          </h2>
          <p className="text-stone-600 text-sm mb-6 max-w-md mx-auto">
            Upload a condo&apos;s document stack — reserve fund study, bylaws,
            minutes — and get a red-flag report in a few minutes.
          </p>
          <Link
            href="/app/new"
            className="inline-block bg-ink text-white hover:bg-accent px-6 py-3 font-semibold text-sm transition-colors"
          >
            Analyze your first building
          </Link>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {reports.map((r, i) => (
              <Link
                key={String(r.id)}
                href={`/app/reports/${encodeURIComponent(String(r.id).split(":")[1] ?? String(r.id))}`}
                className="hover-card stagger report-paper p-5 flex flex-col no-underline"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="font-bold text-ink mb-1">{r.building_name || "Unnamed building"}</div>
                <div className="micro-label !text-[10px] text-stone-500 mb-3">
                  {formatDate(String(r.created_at))} · {timeAgo(String(r.created_at))}
                </div>
                <p className="text-sm text-stone-600 line-clamp-3 mb-4 flex-1">{r.summary}</p>
                <SeverityBar mix={r.mix} />
                {r.money_exposure_total_cad != null && maxExposure > 0 && (
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-subtle">Money at stake</span>
                      <span className="font-bold text-xl text-ink tabular-nums">{cad(r.money_exposure_total_cad)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#eceee9] overflow-hidden" aria-hidden>
                      <div
                        className="bar-in h-full rounded-full bg-ink"
                        style={{ width: r.money_exposure_total_cad > 0 ? `${Math.max(4, (r.money_exposure_total_cad / maxExposure) * 100)}%` : 0 }}
                      />
                    </div>
                  </div>
                )}
                <span className="mt-4 pt-3 border-t border-[#eceee9] text-sm font-semibold text-ink flex items-center justify-between">
                  Open report <span className="go-arrow" aria-hidden>→</span>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DbNotice() {
  return (
    <div className=" border border-amber-200 bg-amber-50 p-6">
      <h1 className="text-lg font-bold text-amber-900 mb-2">
        Database isn&apos;t configured
      </h1>
      <p className="text-sm text-amber-800">
        Add <code className="font-mono text-xs">SURREAL_URL</code> (plus
        namespace, database, and credentials) to the environment to persist
        reports and building memory. The sample report at{" "}
        <Link href="/demo" className="underline font-semibold">
          /demo
        </Link>{" "}
        works without it.
      </p>
    </div>
  );
}
