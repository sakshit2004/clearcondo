import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { withDb, listReports, dbQuery, isDbConfigured } from "@/lib/db";
import { cad, formatDate, timeAgo } from "@/lib/format";
import SetupNotice from "@/components/SetupNotice";


export default async function DashboardPage() {
  if (!isClerkConfigured()) return <SetupNotice />;
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  if (!isDbConfigured()) {
    return <DbNotice />;
  }

  const data = await withDb(async (db) => {
    const reports = await listReports(db, userId);
    const counts = await dbQuery<{ id: string; n: number }[]>(
      db,
      `SELECT report AS id, count() AS n FROM flag WHERE owner_id = $owner GROUP BY report`,
      { owner: userId }
    );
    const countById = new Map(
      (counts ?? []).map((c) => [String(c.id), c.n])
    );
    return reports.map((r) => ({ ...r, flagCount: countById.get(String(r.id)) ?? 0 }));
  });

  const reports = data ?? [];

  return (
    <div>
      <div className="flex items-end justify-between mb-7">
        <div>
          <span className="micro-label text-signal-dark">Dashboard</span>
          <h1 className="font-display uppercase text-4xl sm:text-5xl tracking-tight text-ink mt-1.5">
            My reports
          </h1>
        </div>
        <Link
          href="/app/new"
          className="bg-signal hover:bg-signal-dark text-ink px-5 py-2.5 rounded-full font-bold text-sm transition-colors"
        >
          New analysis
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-ink/30 bg-cream p-10 text-center">
          <h2 className="font-display uppercase text-2xl tracking-wide text-ink mb-2">
            No reports yet
          </h2>
          <p className="text-stone-600 text-sm mb-6 max-w-md mx-auto">
            Upload a condo&apos;s document stack — reserve fund study, bylaws,
            minutes — and get a red-flag report in a few minutes.
          </p>
          <Link
            href="/app/new"
            className="inline-block bg-signal hover:bg-signal-dark text-ink px-6 py-3 rounded-full font-bold text-sm transition-colors"
          >
            Analyze your first building
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {reports.map((r) => (
            <Link
              key={String(r.id)}
              href={`/app/reports/${encodeURIComponent(String(r.id).split(":")[1] ?? String(r.id))}`}
              className="report-paper rounded-lg p-5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_rgba(10,10,14,0.16)] transition-all"
            >
              <div className="font-bold text-ink mb-1">
                {r.building_name || "Unnamed building"}
              </div>
              <div className="micro-label !text-[10px] text-stone-500 mb-3">
                {formatDate(String(r.created_at))} · {timeAgo(String(r.created_at))}
              </div>
              <p className="text-sm text-stone-600 line-clamp-3 mb-4">
                {r.summary}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="micro-label text-stone-500">
                  {r.flagCount} flag{r.flagCount === 1 ? "" : "s"}
                </span>
                {r.money_exposure_total_cad != null && (
                  <span className="font-display text-xl text-ink tracking-wide">
                    {cad(r.money_exposure_total_cad)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function DbNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
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
