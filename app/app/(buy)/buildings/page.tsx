import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { withDb, listBuildings, isDbConfigured } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import SetupNotice from "@/components/SetupNotice";


const shortId = (rid: string) => {
  const parts = String(rid).split(":");
  return encodeURIComponent(parts.length > 1 ? parts[1] : rid);
};

export default async function BuildingsPage() {
  // DB-backed and per-user: render at request time (see /app layout).
  await connection();
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
      <span className="micro-label text-stone-400">Building memory</span>
      <h1 className="font-bold text-4xl tracking-[-0.02em] text-ink mt-1.5 mb-3">Buildings</h1>
      <p className="text-stone-600 mb-7 max-w-2xl leading-relaxed">
        Every building you analyze gets a memory: all reports and flags,
        accumulated over time. Re-upload fresh documents later and watch the
        picture change.
      </p>

      {buildings.length === 0 ? (
        <div className="border-2 border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-stone-600 text-sm mb-6">
            No buildings yet — run your first analysis to start a
            building&apos;s memory.
          </p>
          <Link
            href="/app/new"
            className="inline-block bg-ink text-white hover:bg-accent px-6 py-3 font-semibold text-sm transition-colors"
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
              className="report-paper p-5 hover:border-ink transition-colors"
            >
              <div className="font-bold text-ink mb-1">{b.name}</div>
              <div className="micro-label !text-[10px] text-stone-500 mb-3">
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
