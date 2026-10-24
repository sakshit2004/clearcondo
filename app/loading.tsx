import { LogoMark } from "@/components/Logo";

/**
 * Route-segment loading UI (React Suspense boundary).
 * Shown while a page's content streams in: the monogram drawing itself,
 * a thin progress bar, and skeleton blocks in the page's own rhythm.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 sm:px-6 py-10"
      aria-label="Loading"
      role="status"
    >
      <div className="report-paper rounded-2xl px-6 py-8 sm:px-10 flex flex-col items-start gap-5">
        <LogoMark size={36} animate />
        <div className="loadbar w-full max-w-md" />
      </div>
      <div className="animate-pulse space-y-5 mt-8">
        <div className="h-36 rounded-[14px] bg-surface" />
        <div className="grid gap-5 md:grid-cols-2">
          <div className="h-40 rounded-[14px] bg-surface" />
          <div className="h-40 rounded-[14px] bg-surface" />
        </div>
      </div>
      <p className="sr-only">Loading…</p>
    </div>
  );
}
