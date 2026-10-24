import Link from "next/link";
import { readFileSync } from "fs";
import { join } from "path";
import { VerifiedAnalysisSchema } from "@/lib/report-schema";
import { computeDeltas } from "@/lib/deltas";
import { pointFromFacts } from "@/lib/timeline";
import EvidenceDemo from "@/components/EvidenceDemo";
import HeroScene from "@/components/HeroScene";
import MemoryRecord, { recordRows } from "@/components/MemoryRecord";
import Reveal from "@/components/Reveal";

const STEPS = [
  ["Look up the building", "Free for any Calgary condo, no sign-in: what it's worth, its major work, the tax that comes with it."],
  ["Add the documents", "The PDFs from your seller or property manager: minutes, reserve study, bylaws."],
  ["Get the real price", "Every red flag priced per unit and traced to its page, online or as a PDF for your lawyer, before conditions come off."],
];

/** Three ways in: see a report, check your own documents, check the tax side. */
const PRICE_PARTS: { title: string; body: string; href: string; cta: string; preview?: boolean }[] = [
  {
    title: "See what the documents hide",
    body: "A full sample report: special assessments, reserve shortfalls, lawsuits and insurance deductibles, priced per unit and quoted from the page they came from.",
    href: "/demo",
    cta: "See a sample report",
  },
  {
    title: "Check your condo before you buy",
    body: "Upload the document package from your seller or property manager. ClearCondo prices every red flag per unit and traces each claim to its page, before your conditions come off.",
    href: "/app",
    cta: "Analyze your documents",
  },
  {
    title: "Check the tax side after you buy",
    body: "What the City says the building is worth against similar buildings, the property tax on a typical unit, and whether owners have appealed. Starting in Calgary.",
    href: "/calgary",
    cta: "Check a Calgary condo",
    preview: true,
  },
];

/** The sample building's record across its two reviews (sample data). */
function getSampleRecord() {
  const load = (f: string) =>
    VerifiedAnalysisSchema.parse(
      JSON.parse(readFileSync(join(process.cwd(), "sample-data", f), "utf8"))
    );
  const older = load("sample-report-2024.json");
  const newer = load("sample-report-2026.json");
  const [from, to] = [older, newer].map((r, i) =>
    pointFromFacts({
      facts: r.structured_facts,
      docDate: r.structured_facts.doc_date,
      exposureCad: r.money_exposure_total_cad,
      fallbackLabel: i === 0 ? "Earlier" : "Latest",
      fallbackSortKey: String(i),
    })
  );
  const b = newer.building;
  return {
    buildingName: b.name || "Sample building",
    buildingMeta: b.corp_number ? `Corp No. ${b.corp_number}` : "",
    fromLabel: from.label,
    toLabel: to.label,
    rows: recordRows(
      [from.fundedPct, to.fundedPct],
      computeDeltas(older.structured_facts, newer.structured_facts)
    ),
  };
}

function Arrow() {
  return (
    <svg className="nudge" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionHead({ title, body }: { title: string; body: string }) {
  return (
    <Reveal className="max-w-2xl mb-10">
      <h2 className="text-3xl sm:text-[40px] font-bold tracking-[-0.025em] leading-[1.1]">{title}</h2>
      <p className="mt-3 text-lg text-muted leading-relaxed">{body}</p>
    </Reveal>
  );
}

const primaryBtn =
  "btn-lift inline-flex items-center gap-2.5 rounded-[10px] bg-ink hover:bg-accent text-white font-semibold px-6 min-h-12";

export default function LandingPage() {
  const record = getSampleRecord();

  return (
    <div>
      {/* Hero: full-bleed night scene, headline over it */}
      <section className="landing-hero relative isolate min-h-[max(640px,100svh)] bg-[#070a12] text-white overflow-hidden flex flex-col">
        <HeroScene />
        <div className="relative z-10 mt-auto mx-auto w-full max-w-6xl px-4 sm:px-6 pb-14 sm:pb-20 pt-40">
          <p className="rise-in text-[15px] text-white/65">For condo buyers and owners</p>
          <h1
            className="rise-in mt-4 max-w-3xl font-semibold tracking-[-0.035em] leading-[1.02] text-[44px] sm:text-[64px] lg:text-[80px]"
            style={{ animationDelay: "80ms", textWrap: "balance" }}
          >
            Stop overpaying for your condo.
          </h1>
          <dl className="rise-in mt-6 max-w-2xl grid gap-4 text-lg leading-relaxed text-white/70" style={{ animationDelay: "180ms" }}>
            <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
              <dt className="flex-none sm:w-32 sm:pt-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-white">
                Before you buy
              </dt>
              <dd>
                We read the document package and price what&apos;s buried in it:
                special assessments, thin reserves, lawsuits, every claim traced
                to its page.
              </dd>
            </div>
            <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
              <dt className="flex-none sm:w-32 sm:pt-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-white">
                After you buy
              </dt>
              <dd>
                We check what the City says your building is worth, the tax that
                comes with it, and whether owners have appealed. Starting in
                Calgary.
              </dd>
            </div>
          </dl>
          <div className="rise-in mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "280ms" }}>
            <Link
              href="/app"
              className="btn-lift inline-flex items-center gap-2.5 rounded-full bg-white text-ink font-semibold pl-6 pr-2 min-h-12"
            >
              Take me to dashboard
              <span className="w-9 h-9 rounded-full bg-ink text-white inline-flex items-center justify-center">
                <Arrow />
              </span>
            </Link>
            <Link
              href="/calgary"
              className="inline-flex items-center rounded-full border border-white/30 hover:border-white text-white font-semibold px-6 min-h-12 transition-colors"
            >
              Look up a Calgary condo
            </Link>
          </div>
          <p className="rise-in mt-5 text-sm text-white/50" style={{ animationDelay: "380ms" }}>
            Free during beta
          </p>
        </div>
      </section>

      {/* The real price */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
          <SectionHead
            title="Three ways to stop overpaying."
            body="See what a report finds, check your own condo's documents before you buy, then check the tax side once you own."
          />
          <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-3 gap-4">
            {PRICE_PARTS.map((p, i) => (
              <Reveal key={p.title} delay={i * 100}>
                <Link
                  href={p.href}
                  className="group flex h-full flex-col rounded-[14px] border border-line bg-white p-6 hover:border-ink transition-colors no-underline"
                >
                  <span className="flex items-center gap-2">
                    <span className="data-label text-subtle">0{i + 1}</span>
                    {p.preview && (
                      <span className="rounded-md bg-ink text-white px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide">
                        Preview
                      </span>
                    )}
                  </span>
                  <h3 className="mt-3 text-xl font-bold tracking-[-0.01em] text-ink">{p.title}</h3>
                  <p className="mt-2 text-muted leading-relaxed flex-1">{p.body}</p>
                  <span className="mt-5 inline-flex items-center gap-2 font-semibold text-ink">
                    {p.cta} <Arrow />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Verification */}
      <section className="bg-surface border-b border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
          <SectionHead
            title="Every red flag, traced to the page."
            body="Every claim is matched to the sentence it came from. If we can't find it, the flag is downgraded and loses its dollar figure."
          />
          <EvidenceDemo />
        </div>
      </section>

      {/* Building memory */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
        <SectionHead
          title="The building remembers."
          body="Every building keeps one record of what it really costs. Each new package is checked against what we already verified, and facts that changed are dated, not overwritten."
        />
        <MemoryRecord {...record} />
        <Reveal className="mt-5">
          <p className="text-sm text-subtle max-w-2xl">
            Only verified facts are written to a building&apos;s record, so it
            can&apos;t drift on a guess. Sample data shown.
          </p>
        </Reveal>
      </section>

      {/* How it works */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
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

      {/* The vision */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
          <SectionHead
            title="Buying is the first bill. Owning is the rest."
            body="ClearCondo starts with the purchase: what a condo will really cost you before you own it. What comes after has started too: every Calgary building page already shows its property tax and assessment appeal history. Next, the same check for your own assessment: if the City overvalues your home, we flag it and help you build the appeal. One record of what your property actually costs you."
          />
          <Reveal>
            <Link href="/calgary" className={primaryBtn}>
              See a building&apos;s tax &amp; appeals <Arrow />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Close */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-xl">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.025em] leading-tight">
              Don&apos;t overpay at the offer, or on the tax bill.
            </h2>
            <p className="mt-3 text-[#c3cad4]">
              PDFs are read in memory and never stored.{" "}
              <Link href="/privacy" className="text-white underline underline-offset-4 decoration-[#5b6168] hover:decoration-white">
                Privacy
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/calgary"
              className="inline-flex items-center rounded-[10px] border border-white/30 hover:border-white text-white font-semibold px-6 min-h-12 transition-colors"
            >
              Look up a Calgary condo
            </Link>
            <Link
              href="/app"
              className="btn-lift inline-flex items-center gap-2.5 rounded-[10px] bg-white text-ink font-semibold px-6 min-h-12"
            >
              Take me to dashboard <Arrow />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
