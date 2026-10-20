"use client";

import { useEffect } from "react";
import Link from "next/link";

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
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">
        <span role="img" aria-label="Warning">
          ⚠️
        </span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Something went wrong
      </h1>
      <p className="mt-3 text-stone-600">
        ClearCondo hit an unexpected error loading this page. Your uploaded
        documents are safe — nothing was lost.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        {tryAgain && (
          <button
            onClick={tryAgain}
            className="rounded-lg bg-teal-800 px-5 py-2.5 font-medium text-white hover:bg-teal-900"
          >
            Try again
          </button>
        )}
        <Link
          href="/"
          className="rounded-lg border border-stone-300 px-5 py-2.5 font-medium text-stone-700 hover:bg-stone-50"
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
