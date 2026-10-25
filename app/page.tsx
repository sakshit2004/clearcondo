import Link from "next/link";
import HeroScene from "@/components/HeroScene";
import Reveal from "@/components/Reveal";
import { Arrow, SectionHead } from "@/components/landing/parts";
import { RoadmapIcon, ScanDoc, Skyline, TaxDrop } from "@/components/landing/Motion";

/** Where the two checks go after condos. Only "Now" is live. */
const ROADMAP: { when: "Now" | "Next" | "Later"; what: string; icon: "condo" | "house" | "land"; before: string; own: string }[] = [
  {
    when: "Now",
    icon: "condo",
    what: "Condos",
    before: "the document package, every red flag priced and traced to its page.",
    own: "property tax and a savings estimate, live in Calgary; insurance, energy and your mortgage next.",
  },
  {
    when: "Next",
    icon: "house",
    what: "Houses",
    before: "the home inspection, title and survey.",
    own: "property tax first: the same assessment check, for detached and semi-detached homes.",
  },
  {
    when: "Later",
    icon: "land",
    what: "Land",
    before: "zoning, land-use applications and title.",
    own: "property tax and land-use changes nearby.",
  },
];

/** The two jobs, kept apart: buying and owning. */
const TRACKS: {
  key: "buy" | "own";
  label: string;
  title: string;
  body: string;
  points: string[];
  href: string;
  cta: string;
  secondary?: { href: string; label: string };
  pricing: string;
}[] = [
  {
    key: "buy",
    label: "Buying a condo",
    title: "Know the real price before your conditions come off.",
    body: "Upload the document package from the seller or property manager. ClearCondo reads every page and prices what's buried in it.",
    points: [
      "Special assessments, reserve shortfalls and lawsuits, priced per unit",
      "Every claim traced to the page it came from",
      "City records for Calgary buildings: value trend, permits, appeals",
    ],
    href: "/buyers",
    cta: "ClearCondo for buyers",
    secondary: { href: "/demo", label: "See a sample report" },
    pricing: "Free during beta.",
  },
  {
    key: "own",
    label: "Owning a condo",
    title: "Find out if you're paying too much property tax.",
    body: "Enter your address and unit. See what the City says it's worth, the tax that comes with it, and your potential saving.",
    points: [
      "Your unit's assessment, change since last year and est. tax",
      "How it sits against the rest of the building",
      "A savings estimate from comparable sales, on request",
    ],
    href: "/owners",
    cta: "ClearCondo for owners",
    secondary: { href: "/demo/own", label: "See a sample report" },
    pricing: "You only pay if you save: 30% of the saving, plus $10/month for the software. Free during beta.",
  },
];

export default function LandingPage() {
  return (
    <div>
      {/* Hero: full-bleed night scene, headline over it */}
      <section className="landing-hero relative isolate min-h-[max(640px,100svh)] bg-[#070a12] text-white overflow-hidden flex flex-col">
        <HeroScene flagCard={false} />
        <div className="relative z-10 mt-auto mx-auto w-full max-w-6xl px-4 sm:px-6 pb-14 sm:pb-20 pt-40">
          <p className="rise-in text-[15px] text-white/65">For condo buyers and owners</p>
          <h1
            className="rise-in mt-4 max-w-3xl font-semibold tracking-[-0.035em] leading-[1.02] text-[44px] sm:text-[64px] lg:text-[80px]"
            style={{ animationDelay: "80ms", textWrap: "balance" }}
          >
            Stop overpaying for your condo.
          </h1>
          <p className="rise-in mt-6 max-w-2xl text-lg sm:text-xl leading-relaxed text-white/70" style={{ animationDelay: "180ms" }}>
            The money side of a condo, in one place: what it really costs before you buy, and what you pay every
            year once you own. Pick the one that&apos;s you.
          </p>
          <div className="rise-in mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "280ms" }}>
            <Link
              href="/buyers"
              className="btn-lift inline-flex items-center gap-2.5 rounded-full bg-white text-ink font-semibold pl-6 pr-2 min-h-12"
            >
              I&apos;m buying a condo
              <span className="w-9 h-9 rounded-full bg-ink text-white inline-flex items-center justify-center">
                <Arrow />
              </span>
            </Link>
            <Link
              href="/owners"
              className="inline-flex items-center gap-2.5 rounded-full border border-white/30 hover:border-white text-white font-semibold pl-6 pr-2 min-h-12 transition-colors"
            >
              I own a condo
              <span className="w-9 h-9 rounded-full border border-white/30 inline-flex items-center justify-center">
                <Arrow />
              </span>
            </Link>
          </div>
          <p className="rise-in mt-5 text-sm text-white/50" style={{ animationDelay: "380ms" }}>
            Free during beta
          </p>
        </div>
      </section>

      {/* Buying vs owning */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
          <SectionHead
            title="Two ways to stop overpaying."
            body="Buying and owning are different jobs, so they get different tools. Pick the one you need."
          />
          <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-2 gap-5">
            {TRACKS.map((t, i) => {
              const dark = t.key === "own";
              return (
                <Reveal key={t.key} delay={i * 100}>
                  <div
                    className={`flex h-full flex-col rounded-[18px] p-7 sm:p-8 ${
                      dark ? "bg-ink text-white" : "bg-white border border-line"
                    }`}
                  >
                    {dark ? <TaxDrop className="mb-6" /> : <ScanDoc className="mb-6" />}
                    <span
                      className={`self-start rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] ${
                        dark ? "bg-white/10 text-white" : "bg-accent-soft text-accent-dark"
                      }`}
                    >
                      {t.label}
                    </span>
                    <h3 className={`mt-5 text-2xl sm:text-[28px] font-bold tracking-[-0.02em] leading-tight ${dark ? "" : "text-ink"}`}>
                      {t.title}
                    </h3>
                    <p className={`mt-3 leading-relaxed ${dark ? "text-[#c3cad4]" : "text-muted"}`}>{t.body}</p>
                    <ul className="mt-5 space-y-2.5 flex-1">
                      {t.points.map((pt) => (
                        <li key={pt} className={`flex gap-3 text-[15px] ${dark ? "text-white/85" : "text-ink2"}`}>
                          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className={`flex-none mt-0.5 ${dark ? "text-white" : "text-accent"}`}>
                            <path d="M4 9.5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {pt}
                        </li>
                      ))}
                    </ul>
                    <p className={`mt-6 pt-5 text-sm border-t ${dark ? "border-white/15 text-[#c3cad4]" : "border-line text-subtle"}`}>
                      {t.pricing}
                    </p>
                    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                      <Link
                        href={t.href}
                        className={`btn-lift inline-flex items-center gap-2.5 rounded-[10px] font-semibold px-6 min-h-12 ${
                          dark ? "bg-white text-ink" : "bg-ink hover:bg-accent text-white"
                        }`}
                      >
                        {t.cta} <Arrow />
                      </Link>
                      {t.secondary && (
                        <Link
                          href={t.secondary.href}
                          className={`font-semibold underline underline-offset-4 ${
                            dark ? "text-white decoration-white/40 hover:decoration-white" : "text-ink decoration-line2 hover:decoration-ink"
                          }`}
                        >
                          {t.secondary.label}
                        </Link>
                      )}
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* The vision */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
          <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 lg:gap-14 items-start">
            <Reveal>
              <span className="micro-label text-accent-dark">Where this goes</span>
              <h2 className="mt-3 text-3xl sm:text-[40px] font-bold tracking-[-0.025em] leading-[1.1]">
                Buying is the first bill. Owning is the rest.
              </h2>
              <p className="mt-4 text-lg text-muted leading-relaxed">
                We&apos;re starting with condos in Calgary. The same two checks, before you buy and once you own,
                work for any home: houses next, then land.
              </p>
            </Reveal>
            <ol className="grid gap-3" aria-label="Where ClearCondo goes next">
              <li className="hidden sm:grid grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)] gap-5 px-6 list-none">
                <span />
                <span className="micro-label text-stone-500">Before you buy</span>
                <span className="micro-label text-stone-500">Once you own</span>
              </li>
              {ROADMAP.map((r, i) => (
                <Reveal key={r.what} delay={i * 100}>
                  <li
                    className={`list-none rounded-[14px] p-5 sm:px-6 grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)] gap-3 sm:gap-5 ${
                      r.when === "Now" ? "bg-white border border-ink" : "bg-white/60 border border-dashed border-line2"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <RoadmapIcon kind={r.icon} live={r.when === "Now"} />
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                            r.when === "Now" ? "bg-ink text-white" : "bg-info-soft text-info-dark"
                          }`}
                        >
                          {r.when}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-bold tracking-[-0.01em] text-ink">{r.what}</h3>
                    </div>
                    <p className="text-sm text-muted leading-relaxed">
                      <span className="sm:hidden font-semibold text-ink">Before you buy: </span>
                      {r.before}
                    </p>
                    <p className="text-sm text-muted leading-relaxed">
                      <span className="sm:hidden font-semibold text-ink">Once you own: </span>
                      {r.own}
                    </p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="bg-ink text-white overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.025em] leading-tight max-w-2xl">
            Don&apos;t overpay at the offer, or on the tax bill.
          </h2>
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] md:grid-cols-2 gap-4">
            <div className="rounded-[14px] border border-white/15 p-6 flex flex-col">
              <span className="micro-label text-white/60">Buying</span>
              <p className="mt-2 text-[#c3cad4] leading-relaxed flex-1">
                What the document package hides, priced per unit, before your conditions come off.
              </p>
              <Link
                href="/buyers"
                className="btn-lift mt-5 self-start inline-flex items-center gap-2.5 rounded-[10px] bg-white text-ink font-semibold px-6 min-h-12"
              >
                I&apos;m buying a condo <Arrow />
              </Link>
            </div>
            <div className="rounded-[14px] bg-white/[0.06] border border-white/15 p-6 flex flex-col">
              <span className="micro-label text-white/60">Owning</span>
              <p className="mt-2 text-[#c3cad4] leading-relaxed flex-1">
                Whether you&apos;re paying too much property tax, and what you could save.
              </p>
              <Link
                href="/owners"
                className="btn-lift mt-5 self-start inline-flex items-center gap-2.5 rounded-[10px] bg-white text-ink font-semibold px-6 min-h-12"
              >
                I own a condo <Arrow />
              </Link>
            </div>
          </div>
          <p className="mt-6 text-sm text-[#c3cad4]">
            <Link href="/privacy" className="text-white underline underline-offset-4 decoration-[#5b6168] hover:decoration-white">
              Privacy
            </Link>
          </p>
        </div>
        <Skyline />
      </section>
    </div>
  );
}
