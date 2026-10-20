/**
 * Route-segment loading UI (React Suspense boundary).
 * Shown while a page's content streams in — e.g. the report page while
 * the analysis result loads. Skeleton matches the site's stone/teal theme.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 sm:px-6 py-10"
      aria-label="Loading"
      role="status"
    >
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-2/3 rounded-lg bg-stone-200" />
        <div className="h-4 w-1/2 rounded bg-stone-200" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-40 rounded-xl bg-stone-200" />
          <div className="h-40 rounded-xl bg-stone-200" />
        </div>
        <div className="h-24 rounded-xl bg-stone-200" />
      </div>
      <p className="sr-only">Loading…</p>
    </div>
  );
}
