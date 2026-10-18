import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { withDb, listBuildings, isDbConfigured } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import SetupNotice from "@/components/SetupNotice";


const shortId = (rid: string) => {
  const parts = String(rid).split(":");
  return encodeURIComponent(parts.length > 1 ? parts[1] : rid);
};

export default async function BuildingsPage() {
  if (!isClerkConfigured()) return <SetupNotice />;
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");
  if (!isDbConfigured()) {
    return (
      <p className="text-stone-600">
        Building memory needs SurrealDB. Add{" "}
        <code className="font-mono text-xs">SURREAL_URL</code> to the environment
        to enable it.
      </p>
    );
  }

  const buildings = (await withDb((db) => listBuildings(db, userId))) ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900 mb-2">Buildings</h1>
      <p className="text-stone-600 mb-6 max-w-2xl">
        Every building you analyze gets a memory: all reports and flags,
        accumulated over time. Re-upload fresh documents later and watch the
        picture change.
      </p>

      {buildings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-stone-600 text-sm mb-6">
            No buildings yet — run your first analysis to start a
            building&apos;s memory.
          </p>
          <Link
            href="/app/new"
            className="inline-block bg-teal-800 hover:bg-teal-900 text-white px-6 py-2.5 rounded-lg font-medium text-sm"
          >
            Analyze documents
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {buildings.map((b) => (
            <Link
              key={String(b.id)}
              href={`/app/buildings/${shortId(b.id)}`}
              className="report-paper rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="font-semibold text-stone-900 mb-1">{b.name}</div>
              <div className="text-xs text-stone-500 mb-3">
                {b.address || "Address unknown"}
                {b.units ? ` · ${b.units} units` : ""}
              </div>
              <div className="text-sm text-stone-600">
                {b.report_count} report{b.report_count === 1 ? "" : "s"}
                <span className="text-stone-400">
                  {" "}
                  · updated {timeAgo(String(b.updated_at))}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
