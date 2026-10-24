import ServiceOrderForm from "@/components/ServiceOrderForm";

const PROMISES = [
  [
    "Verified, or flagged",
    "Every claim is checked against its cited page. A claim that can't be verified is downgraded — never critical, never carrying a dollar figure.",
  ],
  [
    "Plain language",
    "Every flag explained in words you can act on, with questions to take to your lawyer — online or as a PDF.",
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
 * The order desk. One page, no account: a buyer sends the document
 * package, gets a reference code, and the verified report comes back by
 * email.
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
          Send your condo documents
        </h1>
        <p className="rise-in text-muted text-[17px] leading-relaxed max-w-2xl mt-3" style={{ animationDelay: "160ms" }}>
          Send the condo documents your seller or property manager gave you.
          We read every page, check every claim against the page it cites,
          and email you the finished report — inside your condition window,
          not after it.
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
