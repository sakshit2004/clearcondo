import Link from "next/link";

/**
 * Plain-language privacy note, for both sides: buyers' documents and
 * owners' units and estimate requests. Linked from the footer, the landing
 * page, and the upload form's consent checkbox.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <span className="micro-label text-stone-400">Privacy</span>
      <h1 className="font-bold text-4xl tracking-[-0.02em] text-ink mt-2 mb-2">
        Privacy &amp; data retention
      </h1>
      <p className="text-stone-500 text-sm mb-10">
        Last updated October 2026. Plain language on purpose. ClearCondo is
        made in Canada.
      </p>

      <div className="space-y-10 text-stone-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            If you&apos;re buying: your documents
          </h2>
          <h3 className="font-semibold text-stone-900 mt-5 mb-1.5">What we store</h3>
          <p>
            Your uploaded PDFs are read in memory to extract their text — the
            files themselves are <strong>never stored</strong>. We keep the
            extracted text and basic document details (filename, document
            type, page count) so your report can be traced back to its
            sources, and we keep your report itself: the summary, the flags,
            and the key facts.
          </p>
          <h3 className="font-semibold text-stone-900 mt-5 mb-1.5">How long we keep it</h3>
          <p>
            Extracted text and document details are{" "}
            <strong>automatically deleted 30 days after upload</strong>. Your
            report — the summary, flags, and key facts — stays in your
            account until you delete it. We never auto-delete reports.
          </p>
          <h3 className="font-semibold text-stone-900 mt-5 mb-1.5">How to delete</h3>
          <p>
            Open any report and use <strong>“Delete this report”</strong> at
            the bottom of the page. That permanently removes the report, its
            flags, its documents, and the extracted text. It cannot be
            undone. Verified facts your report added to the building&apos;s
            shared record (below) stay there, because they&apos;re about the
            building and carry no link to you.
          </p>
          <h3 className="font-semibold text-stone-900 mt-5 mb-1.5">Your consent</h3>
          <p>
            Uploading requires checking a consent box confirming you have the
            right to upload the documents and understand how they&apos;ll be
            processed and stored. Only upload documents you&apos;re entitled
            to share.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            The shared building record
          </h2>
          <p>
            Every condo building has one shared record, built from the
            document packages all ClearCondo users check. When you check a
            package, its <strong>verified facts</strong> are added: figures
            and statuses such as the reserve fund balance, condo fees, the
            insurance deductible, special assessments, lawsuits and rental
            rules, each with its document date, document type and page.
            Only facts we could match to a page are added.
          </p>
          <p className="mt-3">
            <strong>Never added:</strong> your documents, their text,
            filenames or quotes, your name, or anything that says who
            uploaded them. Names of private individuals are removed from the
            facts first.
          </p>
          <p className="mt-3">
            Anyone checking the same building sees the record: what earlier
            packages said, what changed, and anything an earlier package
            reported that a newer one leaves out. Facts stay in the record
            after you delete your report. Owners&apos; pages also add the
            City&apos;s assessment for the building each year. Building
            memory (Agent Memory, when enabled) learns from the same facts.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            If you own: your unit and your estimate
          </h2>
          <h3 className="font-semibold text-stone-900 mt-5 mb-1.5">What we store</h3>
          <p>
            When you check a unit, we save it to your account: the address,
            the unit number, and what the City&apos;s records say about it
            (its assessed value, last year&apos;s value, the estimated tax and
            any past complaints), so it&apos;s there next time.
          </p>
          <p className="mt-3">
            If you ask for a savings estimate, we also keep what you send: your
            name, email and phone (if you give one), and what you tell us about
            the unit — size, rooms, parking, storage, condition, renovations,
            what you paid and when, an appraisal, sales of similar units, and
            any notes. We use it to work out your estimate and to contact you
            about it. <strong>Nothing is filed with the City without your
            go-ahead</strong>, and we don&apos;t sell your details or share
            them for marketing.
          </p>
          <h3 className="font-semibold text-stone-900 mt-5 mb-1.5">How long we keep it, and how to delete it</h3>
          <p>
            Saved units and estimate requests stay until you ask us to delete
            them. There&apos;s no delete button for these yet: reply to any
            email from us and we&apos;ll remove your saved units and requests.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Public records
          </h2>
          <p>
            Building and unit facts — assessments, Assessment Review Board
            complaints, permits — come from the City of Calgary&apos;s open
            data, which anyone can look up. We keep a copy for up to 24 hours
            so pages load quickly, then fetch it fresh.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Services we use
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Clerk runs sign-in; we never see your password.</li>
            <li>
              Anthropic&apos;s Claude reads the extracted document text (and
              scanned pages, when a PDF has no text) to write your report.
              Owner estimates are plain calculations and aren&apos;t sent to
              it.
            </li>
            <li>
              SurrealDB stores your account&apos;s reports, saved units and
              requests, the shared building records, and building memory
              when it&apos;s enabled.
            </li>
            <li>Stripe handles payment for paid reports; your card details never reach us.</li>
            <li>Vercel hosts the site.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            What this isn&apos;t
          </h2>
          <p>
            ClearCondo summarizes condominium documents and checks public
            assessment records. It is not legal, financial, tax, or real-estate
            advice. A savings estimate is a calculation from what you tell us,
            not a promise that your assessment will come down. Ask your lawyer
            or reviewer about anything flagged before you act on it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Technical notes
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Document contents are never written to production logs — only
              counts and error types.
            </li>
            <li>
              The shared building record and building memory store factual
              summaries (balances, assessments, dates), not document prose.
            </li>
          </ul>
        </section>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/app/new"
          className="inline-block bg-ink text-white hover:bg-accent px-7 py-3 font-semibold transition-colors"
        >
          Analyze your documents
        </Link>
        <Link
          href="/app/own"
          className="inline-block border border-line2 text-ink hover:border-ink px-7 py-3 font-semibold transition-colors"
        >
          Check your property tax
        </Link>
      </div>
    </div>
  );
}
