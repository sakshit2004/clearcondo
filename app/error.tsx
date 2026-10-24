"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";

/**
 * Route-segment error boundary. Next.js renders this when a page throws
 * during render or data fetching. The runtime passes `reset`; the docs
 * name it `retry` — accept both so a rename never breaks the button.
 */
export default function Error({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  const tryAgain = reset ?? retry;

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("ClearCondo route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-16 text-center">
      <div className="mx-auto mb-6 flex justify-center">
        <LogoMark size={48} />
      </div>
      <h1 className="font-bold text-3xl tracking-tight text-ink">
        Something went wrong
      </h1>
      <p className="mt-3 text-muted">
        ClearCondo hit an unexpected error loading this page. Your uploaded
        documents are safe — nothing was lost.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        {tryAgain && (
          <button
            onClick={tryAgain}
            className="btn-lift rounded-[10px] bg-ink px-6 min-h-11 font-semibold text-white hover:bg-accent"
          >
            Try again
          </button>
        )}
        <Link
          href="/"
          className="inline-flex items-center rounded-[10px] border border-line2 px-6 min-h-11 font-semibold text-ink hover:border-ink transition-colors"
        >
          Back to home
        </Link>
      </div>
      {error?.digest && (
        <p className="mt-6 text-xs text-stone-400">
          Error reference: {error.digest}
        </p>
      )}
    </div>
  );
}
