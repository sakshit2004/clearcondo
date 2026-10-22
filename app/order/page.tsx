import ServiceOrderForm from "@/components/ServiceOrderForm";

/**
 * The service desk. One page, no account: send the document package, get
 * a reference code, and the verified report comes back by email. This is
 * the front door of the service framing — the analysis app behind it is
 * the engine room, not the product the realtor operates.
 */
export default function OrderPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
      <div className="flex flex-wrap gap-x-8 gap-y-1 micro-label text-stone-500 mb-8">
        <span>The service desk</span>
        <span>No account</span>
        <span>Report delivered by email</span>
      </div>
      <h1 className="font-bold tracking-[-0.02em] leading-[1.05] text-4xl sm:text-5xl text-ink max-w-3xl">
        Send the package. Get the verdict.
      </h1>
      <p className="text-stone-600 leading-relaxed max-w-2xl mt-5">
        Forward the condo document package the seller&apos;s side delivered.
        We read every page, machine-check every claim against the page it
        cites, and send back a finished report with your name on it —
        inside the condition window, not after it.
      </p>

      <div className="grid lg:grid-cols-12 gap-8 mt-12">
        <div className="lg:col-span-8">
          <ServiceOrderForm />
        </div>
        <div className="lg:col-span-4">
          <div className="border-t-2 border-ink pt-4">
            <div className="micro-label text-stone-500 mb-4">The service promise</div>
            <dl className="text-sm">
              <div className="border-t border-stone-200 py-3">
                <dt className="font-bold text-ink">Verified, or flagged</dt>
                <dd className="text-stone-600 leading-relaxed mt-1">
                  Every claim is checked against its cited page. A claim that
                  can&apos;t be verified is downgraded — never critical,
                  never carrying a dollar figure.
                </dd>
              </div>
              <div className="border-t border-stone-200 py-3">
                <dt className="font-bold text-ink">Client-ready</dt>
                <dd className="text-stone-600 leading-relaxed mt-1">
                  The report carries your name and brokerage, in plain
                  language your client can act on, with the audit trail
                  behind every claim.
                </dd>
              </div>
              <div className="border-t border-stone-200 py-3">
                <dt className="font-bold text-ink">Inside the window</dt>
                <dd className="text-stone-600 leading-relaxed mt-1">
                  Built for the condition period: minutes of analysis
                  instead of a $400–800 professional review that takes days.
                </dd>
              </div>
              <div className="border-t border-b border-stone-200 py-3">
                <dt className="font-bold text-ink">Your documents, your control</dt>
                <dd className="text-stone-600 leading-relaxed mt-1">
                  PDFs are read and discarded — never stored. Extracted text
                  is deleted after 30 days.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
