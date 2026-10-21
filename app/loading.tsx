/**
 * Route-segment loading UI (React Suspense boundary).
 * Shown while a page's content streams in: white, quiet — a wordmark,
 * a thin progress bar, and skeleton blocks in the page's own rhythm.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 sm:px-6 py-10"
      aria-label="Loading"
      role="status"
    >
      <div className="border border-stone-300 bg-white px-6 py-8 sm:px-10">
        <div className="flex items-baseline gap-2.5 mb-6">
          <span className="w-2.5 h-2.5 bg-signal inline-block animate-pulse" aria-hidden />
          <span className="font-bold tracking-tight text-ink text-[17px]">
            ClearCondo
          </span>
        </div>
        <div className="loadbar w-full max-w-md" />
        <p className="micro-label text-stone-400 mt-5">Loading</p>
      </div>
      <div className="animate-pulse space-y-5 mt-8">
        <div className="h-36 bg-stone-100" />
        <div className="grid gap-5 md:grid-cols-2">
          <div className="h-40 bg-stone-100" />
          <div className="h-40 bg-stone-100" />
        </div>
      </div>
      <p className="sr-only">Loading…</p>
    </div>
  );
}
