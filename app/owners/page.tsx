import type { Metadata } from "next";
import Reveal from "@/components/Reveal";
import { OWNER_PRICING } from "@/lib/owner";
import { OWNER_BILLS } from "@/lib/owner-bills";
import { AudienceHero, SectionHead, SwitchBand } from "@/components/landing/parts";

export const metadata: Metadata = {
  title: "For condo owners — ClearCondo",
  description:
    "Find out if you're paying too much property tax on your Calgary condo: your unit's assessment, the tax it means, and a savings estimate. You only pay if you save.",
};

const SEE: [string, string, string][] = [
  [
    "Your unit's assessment",
    "What the City says your unit is worth this year, and how much it moved since last year.",
    "M2 15l4.5-5 3 3L16 5M12 5h4v4",
  ],
  [
    "The tax that comes with it",
    "Your estimated property tax at this year's residential rate, worked out in the open.",
    "M3 2h12v14l-2-1.5L11 16l-2-1.5L7 16l-2-1.5L3 16zM6 6h6M6 9h6M6 12h3",
  ],
  [
    "Against your building",
    "How your unit sits against the building's median unit, and whether complaints were filed before.",
    "M3 16V3.5A1.5 1.5 0 014.5 2h6A1.5 1.5 0 0112 3.5V16M12 7h1.5A1.5 1.5 0 0115 8.5V16M1.5 16h15M6 5h3M6 8h3M6 11h3",
  ],
];

const STEPS: [string, string][] = [
  ["Find your unit", "Search the address on your tax notice, with your unit number."],
  ["See the facts", "Your assessment, the tax it means, and how it compares to the rest of the building."],
  ["Get your number", "Tell us about the unit (size, condition, parking) and we come back with your potential saving."],
];


/** Everything for owners, on one page. The owner dashboard is /app/own. */
export default function OwnersPage() {
  const { feeShare, softwareMonthly } = OWNER_PRICING;
  return (
    <div>
      <AudienceHero
        audience="owners"
        title="Find out if you're paying too much property tax."
        body="Enter your address and unit. See what the City says your condo is worth, the tax that comes with it, and what you could save. Live for Calgary condos."
        cta={{ href: "/app/own", label: "Open the owner dashboard" }}
        sample={{ href: "/demo/own", label: "See a sample report" }}
        note="You only pay if you save. Free during beta."
      />

      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
          <SectionHead title="What you see." body="From the City of Calgary's assessment roll, for your unit, not just your building." />
          <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-3 gap-4">
            {SEE.map(([title, body, icon], i) => (
              <Reveal key={title} delay={i * 100}>
                <div className="h-full rounded-[14px] border border-line bg-white p-6">
                  <svg width="22" height="22" viewBox="0 0 18 18" aria-hidden className="text-accent">
                    <path d={icon} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h3 className="mt-3 text-lg font-bold text-ink">{title}</h3>
                  <p className="mt-1.5 text-muted leading-relaxed">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface border-b border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
          <ol className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-3 gap-10 md:gap-8">
            {STEPS.map(([title, body], i) => (
              <Reveal key={title} delay={i * 100}>
                <li className="border-t border-ink pt-5 list-none">
                  <span className="data-label text-subtle">0{i + 1}</span>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.01em]">{title}</h2>
                  <p className="mt-1.5 text-muted">{body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-2 gap-10 items-start">
          <Reveal>
            <h2 className="text-3xl sm:text-[40px] font-bold tracking-[-0.025em] leading-[1.1]">You only pay if you save.</h2>
            <p className="mt-3 text-lg text-muted leading-relaxed">
              If your assessment doesn&apos;t come down, you pay nothing. Free while ClearCondo is in beta.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="rounded-[18px] bg-ink text-white p-7">
              <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-semibold">Free during beta</span>
              <dl className="mt-5 grid gap-5">
                <div className="flex gap-5">
                  <dt className="text-3xl font-bold tabular-nums w-28 flex-none">{Math.round(feeShare * 100)}%</dt>
                  <dd className="text-[#c3cad4] leading-relaxed">of the tax you save, once your assessment comes down.</dd>
                </div>
                <div className="flex gap-5">
                  <dt className="text-3xl font-bold tabular-nums w-28 flex-none">${softwareMonthly}/mo</dt>
                  <dd className="text-[#c3cad4] leading-relaxed">
                    for the software: your assessment checked every year, and a reminder before the complaint deadline.
                  </dd>
                </div>
              </dl>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
        <SectionHead title="Next for owners." body="The other bills that come with owning a condo, in the order we're taking them on." />
        <ul className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-3 gap-4">
          {OWNER_BILLS.map((b) => (
            <li key={b.slug} className="rounded-[14px] border border-dashed border-line2 bg-white p-5 flex items-center justify-between gap-3">
              <span className="font-semibold text-ink">{b.title}</span>
              <span className="rounded-md bg-info-soft text-info-dark px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                Soon
              </span>
            </li>
          ))}
        </ul>
      </section>

      <SwitchBand
        title="Buying a condo instead?"
        body="Know the real price before your conditions come off: what the document package hides, priced per unit."
        href="/buyers"
        label="ClearCondo for buyers"
      />
    </div>
  );
}
