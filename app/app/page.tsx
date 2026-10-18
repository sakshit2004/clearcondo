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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">My reports</h1>
        <Link
          href="/app/new"
          className="bg-teal-800 hover:bg-teal-900 text-white px-4 py-2 rounded-lg font-medium text-sm"
        >
          New analysis
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-stone-900 mb-2">
            No reports yet
          </h2>
          <p className="text-stone-600 text-sm mb-6 max-w-md mx-auto">
            Upload a condo&apos;s document stack — reserve fund study, bylaws,
            minutes — and get a red-flag report in about a minute.
          </p>
          <Link
            href="/app/new"
            className="inline-block bg-teal-800 hover:bg-teal-900 text-white px-6 py-2.5 rounded-lg font-medium text-sm"
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
              className="report-paper rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="font-semibold text-stone-900 mb-1">
                {r.building_name || "Unnamed building"}
              </div>
              <div className="text-xs text-stone-500 mb-3">
                {formatDate(String(r.created_at))} · {timeAgo(String(r.created_at))}
              </div>
              <p className="text-sm text-stone-600 line-clamp-3 mb-4">
                {r.summary}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-500">
                  {r.flagCount} flag{r.flagCount === 1 ? "" : "s"}
                </span>
                {r.money_exposure_total_cad != null && (
                  <span className="font-bold text-stone-900">
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
