import type { Metadata } from "next";
import Link from "next/link";
import CalgarySearch from "@/components/CalgarySearch";

export const metadata: Metadata = {
  title: "Own a condo? Stop overpaying to keep it — ClearCondo",
  description:
    "Owning a condo means bills every year. ClearCondo starts with your property tax: check what the City says your building is worth and the tax that comes with it. Insurance, energy and your mortgage are next.",
};

/** What owners pay every year, in the order ClearCondo is taking them on. Only property tax is live. */
const COMING: { title: string; body: string; icon: string }[] = [
  {
    title: "Home & condo insurance",
    body: "Whether your unit policy fits what the corporation's insurance and deductible actually leave you exposed to.",
    icon: "M9 2l6 2.5v4.2c0 3.6-2.5 6.4-6 7.3-3.5-.9-6-3.7-6-7.3V4.5z",
  },
  {
    title: "Energy & electricity",
    body: "What your unit's power and utilities cost against similar units, and where the bill can come down.",
    icon: "M10 2L4 10h4.5L8 16l6-8H9.5z",
  },
  {
    title: "Mortgage & refinancing",
    body: "When a renewal or refinance would lower what you pay, using what you owe and what the unit is worth.",
    icon: "M2 9l7-6 7 6M4 7.5V16h10V7.5M7.5 16v-4h3v4",
  },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 18 18" aria-hidden className="text-accent">
      <path d={d} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The owner's door: what ClearCondo does once you own the condo. Property
 * tax is live (Calgary); the rest is on the roadmap and labelled as such —
 * nothing here pretends to work before it does.
 */
export default function OwnPage() {
  return (
    <div>
      <section className="bg-surface border-b border-line">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-14 pb-12 sm:pt-20 sm:pb-16">
          <span className="micro-label text-accent-dark">For condo owners</span>
          <h1
            className="font-bold text-[34px] sm:text-5xl tracking-[-0.03em] leading-[1.08] text-ink mt-3"
            style={{ textWrap: "balance" }}
          >
            Own a condo? Stop overpaying to keep it.
          </h1>
          <p className="text-[17px] text-ink2 mt-4 max-w-2xl leading-relaxed">
            Buying is the first bill. Property tax, insurance, energy and your mortgage come every year after.
            ClearCondo starts with property tax.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-14">
        <div className="report-paper rounded-2xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-2xl tracking-tight text-ink">Property tax check</h2>
            <span className="rounded-md bg-accent-soft text-accent-dark px-2 py-0.5 text-xs font-semibold">
              Live in Calgary
            </span>
          </div>
          <p className="text-[15px] text-stone-600 mt-2 mb-6 max-w-2xl leading-relaxed">
            Search your building by address or condo plan number. See what the City says it&apos;s worth against
            similar buildings, the tax on a typical unit, whether owners have appealed their assessments, and the
            major work on record. Free, no sign-in.
          </p>
          <CalgarySearch />
          <p className="text-[13px] text-subtle mt-3">
            A unit number is fine (&ldquo;1203-1111 6th Ave SW&rdquo;). From City of Calgary open data. Context, not a
            verdict.
          </p>
        </div>

        <h2 className="font-bold text-2xl tracking-tight text-ink mt-14">Coming next</h2>
        <p className="text-[15px] text-stone-600 mt-1.5 max-w-2xl">
          The other bills that come with owning a condo, in the order we&apos;re taking them on. We&apos;re starting
          with condos; houses and land come after.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          {COMING.map((c) => (
            <div key={c.title} className="rounded-[14px] border border-dashed border-line2 bg-white p-6">
              <div className="flex items-center justify-between gap-2">
                <Icon d={c.icon} />
                <span className="rounded-md bg-info-soft text-info-dark px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                  Coming soon
                </span>
              </div>
              <h3 className="font-bold text-ink mt-3">{c.title}</h3>
              <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-[14px] bg-ink text-white p-6 sm:p-7 flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex-1 min-w-64">
            <h3 className="font-bold text-lg">Buying instead?</h3>
            <p className="text-sm text-[#c3cad4] mt-1.5 leading-relaxed">
              Upload the condo&apos;s document package and ClearCondo prices what&apos;s buried in it: special
              assessments, thin reserves, lawsuits, every claim traced to its page.
            </p>
          </div>
          <Link
            href="/app"
            className="btn-lift inline-flex items-center justify-center rounded-lg bg-white text-ink font-semibold text-[15px] px-5 min-h-11"
          >
            Check a condo before you buy
          </Link>
        </div>
      </section>
    </div>
  );
}
