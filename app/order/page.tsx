import ServiceOrderForm from "@/components/ServiceOrderForm";

const PROMISES = [
  [
    "Verified, or flagged",
    "Every claim is checked against its cited page. A claim that can't be verified is downgraded — never critical, never carrying a dollar figure.",
  ],
  [
    "Client-ready",
    "Your name and brokerage on the report, in plain language your client can act on — online or as a PDF.",
  ],
  [
    "Inside the window",
    "Built for the condition period: minutes of analysis instead of a $400–800 professional review that takes days.",
  ],
  [
    "Your documents, your control",
    "PDFs are read and discarded — never stored. Extracted text is deleted after 30 days.",
  ],
];

/**
 * The service desk. One page, no account: send the document package, get
 * a reference code, and the verified report comes back by email. This is
 * the front door of the service framing — the analysis app behind it is
 * the engine room, not the product the realtor operates.
 */
export default function OrderPage() {
  return (
    <div className="bg-surface">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-14">
        <ol aria-label="How ordering works" className="rise-in flex flex-wrap gap-x-7 gap-y-2 text-sm mb-7">
          {["Your details & documents", "We verify every page", "Report by email"].map((s, i) => (
            <li key={s} className={`flex items-center gap-2 ${i === 0 ? "font-semibold" : "text-subtle"}`}>
              <span
                className={`w-6 h-6 rounded-full text-xs inline-flex items-center justify-center ${
                  i === 0 ? "bg-ink text-white" : "border border-line2"
                }`}
              >
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <h1 className="rise-in font-bold tracking-[-0.025em] leading-[1.1] text-4xl sm:text-[44px] text-ink max-w-3xl" style={{ animationDelay: "80ms" }}>
          Send a document package
        </h1>
        <p className="rise-in text-muted text-[17px] leading-relaxed max-w-2xl mt-3" style={{ animationDelay: "160ms" }}>
          Forward the condo documents the seller&apos;s side delivered. We read
          every page, check every claim against the page it cites, and send
          back a finished report with your name on it — inside the condition
          window, not after it.
        </p>

        <div className="mt-10">
          <ServiceOrderForm />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
          {PROMISES.map(([title, body]) => (
            <div key={title} className="rounded-[14px] border border-line bg-white p-5">
              <div className="font-bold">{title}</div>
              <p className="text-sm text-muted leading-relaxed mt-1.5">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
