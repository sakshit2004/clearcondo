import Link from "next/link";

/**
 * Plain-language privacy note. Linked from the footer, the landing page,
 * and the upload form's consent checkbox.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <h1 className="text-3xl font-bold text-stone-900 mb-2">
        Privacy &amp; data retention
      </h1>
      <p className="text-stone-500 text-sm mb-10">
        Last updated October 2026. Plain language on purpose.
      </p>

      <div className="space-y-8 text-stone-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            What we store
          </h2>
          <p>
            Your uploaded PDFs are read in memory to extract their text — the
            files themselves are <strong>never stored</strong>. We keep the
            extracted text and basic document details (filename, document
            type, page count) so your report can be traced back to its
            sources, and we keep your report itself: the summary, the flags,
            and the key facts.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            How long we keep it
          </h2>
          <p>
            Extracted text and document details are{" "}
            <strong>automatically deleted 30 days after upload</strong>. Your
            report — the summary, flags, and key facts — stays in your
            account until you delete it. We never auto-delete reports.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            How to delete
          </h2>
          <p>
            Open any report and use <strong>“Delete this report”</strong> at
            the bottom of the page. That permanently removes the report, its
            flags, its documents, and the extracted text. It cannot be
            undone. One caveat: if building memory (Agent Memory) is enabled,
            its learned beliefs about the building are removed on a
            best-effort basis only — the service offers no guaranteed purge.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Your consent
          </h2>
          <p>
            Uploading requires checking a consent box confirming you have the
            right to upload the documents and understand how they&apos;ll be
            processed and stored. Only upload documents you&apos;re entitled
            to share.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            What this isn&apos;t
          </h2>
          <p>
            ClearCondo summarizes condominium documents. It is not legal,
            financial, or real-estate advice. Ask your lawyer or reviewer
            about anything flagged before you act on it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Technical notes
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Accounts are handled by Clerk; we never see your password.</li>
            <li>
              Document contents are never written to production logs — only
              counts and error types.
            </li>
            <li>
              Building-memory features store factual summaries (balances,
              assessments, dates), not document prose.
            </li>
          </ul>
        </section>
      </div>

      <div className="mt-12">
        <Link
          href="/app/new"
          className="inline-block bg-teal-800 hover:bg-teal-900 text-white px-6 py-3 rounded-lg font-semibold"
        >
          Analyze your documents
        </Link>
      </div>
    </div>
  );
}
