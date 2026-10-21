/**
 * Route-segment loading UI (React Suspense boundary).
 * Shown while a page's content streams in — styled as the loader screen:
 * ink panel, particle dot grid, thin signal progress bar.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 sm:px-6 py-10"
      aria-label="Loading"
      role="status"
    >
      <div className="relative overflow-hidden rounded-lg bg-ink px-6 py-10 sm:px-10">
        <div className="absolute inset-0 dotgrid-light opacity-40" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-2.5 h-2.5 rounded-full bg-signal animate-pulse" />
            <span className="font-display uppercase tracking-wide text-white text-xl pt-0.5">
              ClearCondo
            </span>
          </div>
          <div className="loadbar w-full max-w-md" />
          <p className="micro-label text-white/45 mt-5">Loading</p>
        </div>
      </div>
      <div className="animate-pulse space-y-5 mt-8">
        <div className="h-36 rounded-lg bg-ink/[0.07]" />
        <div className="grid gap-5 md:grid-cols-2">
          <div className="h-40 rounded-lg bg-ink/[0.07]" />
          <div className="h-40 rounded-lg bg-ink/[0.07]" />
        </div>
      </div>
      <p className="sr-only">Loading…</p>
    </div>
  );
}
