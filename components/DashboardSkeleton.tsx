/**
 * Shown under a dashboard's nav the moment a tab is clicked, while the
 * page renders on the server (dashboards are per-user, so never static).
 */
export default function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className="loadbar w-full mb-8" aria-hidden />
      <div className="animate-pulse">
        <div className="h-9 w-64 max-w-full rounded-lg bg-surface" />
        <div className="h-5 w-96 max-w-full rounded bg-surface mt-3" />
        <div className="flex flex-wrap gap-8 items-start mt-8">
          <div className="flex-[999_1_560px] min-w-0 space-y-4">
            <div className="h-48 rounded-2xl bg-surface" />
            <div className="h-32 rounded-2xl bg-surface" />
          </div>
          <div className="flex-[1_1_300px] h-56 rounded-2xl bg-surface" />
        </div>
      </div>
      <p className="sr-only">Loading…</p>
    </div>
  );
}
