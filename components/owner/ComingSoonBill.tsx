import Link from "next/link";
import type { OwnerBill } from "@/lib/owner-bills";

function Icon({ d }: { d: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 18 18" aria-hidden className="text-accent">
      <path d={d} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A coming-soon owner dashboard tab, laid out like the property tax tab:
 * a main column saying what's planned, and an aside pointing to what's
 * live now. Nothing here can be used yet, and it says so.
 */
export default function ComingSoonBill({ bill }: { bill: OwnerBill }) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div className="max-w-2xl">
          <span className="micro-label text-accent-dark">Owning · Coming soon</span>
          <h1 className="rise-in font-bold text-3xl sm:text-4xl tracking-[-0.025em] mt-1.5">{bill.title}</h1>
          <p className="rise-in text-muted text-[17px] leading-relaxed mt-2" style={{ animationDelay: "80ms" }}>
            {bill.summary}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-8 items-start">
        <div className="flex-[999_1_560px] min-w-0 space-y-4">
          <section className="report-paper rounded-2xl p-6 sm:p-8" aria-labelledby="planned-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Icon d={bill.icon} />
              <span className="rounded-md bg-info-soft text-info-dark px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
                Coming soon
              </span>
            </div>
            <h2 id="planned-heading" className="text-lg font-bold mt-4">What it will do</h2>
            <p className="text-sm text-subtle mt-1 mb-5">
              This isn&apos;t available yet. Here&apos;s what we&apos;re planning.
            </p>
            <ul className="space-y-3">
              {bill.planned.map((p) => (
                <li key={p} className="flex gap-3 text-[15px] text-ink2">
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="flex-none mt-0.5 text-subtle">
                    <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="3 2.5" />
                  </svg>
                  {p}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="flex-[1_1_300px] space-y-4" aria-label="Live now">
          <section className="rounded-2xl bg-ink text-white p-6">
            <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
              Live now
            </span>
            <h2 className="text-lg font-bold mt-3">Property tax</h2>
            <p className="text-sm text-[#c3cad4] mt-1.5 mb-4 leading-relaxed">
              Find out if you&apos;re paying too much on your Calgary condo, and what you could save.
            </p>
            <Link
              href="/app/own"
              className="btn-lift inline-flex items-center justify-center rounded-lg bg-white text-ink font-semibold text-[15px] px-5 min-h-11"
            >
              Check my property tax
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
