"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Two-step delete control for the report page. Deletes the report, its
 * flags, its documents (metadata + extracted page text), and — when it was
 * the building's last report — the building shell.
 */
export default function DeleteReportButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeleted(true);
      setTimeout(() => {
        router.push("/app");
        router.refresh();
      }, 1400);
    } catch {
      setError("Couldn't delete the report. Please try again.");
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (deleted) {
    return (
      <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
        Report deleted — the report, its flags, its documents, and the
        extracted page text are gone. (If building memory is enabled, its
        learned beliefs are removed on a best-effort basis.)
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-sm text-stone-500 hover:text-red-700 underline underline-offset-2"
      >
        Delete this report
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 max-w-xl">
      <p className="text-sm font-semibold text-red-900 mb-1">
        Delete this report permanently?
      </p>
      <p className="text-sm text-red-800 mb-3">
        This removes the report, its flags, its documents, and the extracted
        page text. This cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="px-4 py-2 rounded-lg border border-stone-300 bg-white text-sm font-medium text-stone-700 hover:border-stone-400 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          onClick={doDelete}
          disabled={deleting}
          className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-medium disabled:opacity-60"
        >
          {deleting ? "Deleting…" : "Yes, delete it"}
        </button>
      </div>
      {error && <p className="text-sm text-red-800 mt-2">{error}</p>}
    </div>
  );
}
