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
  ["Upload the package", "The reserve study, bylaws, minutes and information statement that came with the listing."],
  ["We check every page", "Every risk is matched to the exact sentence that supports it."],
  ["Get the report", "Red flags, the dollar exposure per unit, and the questions to ask — in minutes, before your conditions expire."],
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
          <p className="rise-in text-[15px] text-white/65">For condo buyers</p>
          <h1
            className="rise-in mt-4 max-w-3xl font-semibold tracking-[-0.035em] leading-[1.02] text-[44px] sm:text-[64px] lg:text-[80px]"
            style={{ animationDelay: "80ms", textWrap: "balance" }}
          >
            Don&apos;t overpay for a condo.
          </h1>
          <p className="rise-in mt-5 max-w-xl text-lg leading-relaxed text-white/70" style={{ animationDelay: "180ms" }}>
            The list price isn&apos;t the real price. ClearCondo reads the full
            document package and prices what&apos;s buried in it — special
            assessments, thin reserves, lawsuits — every claim traced to the
            page it came from, before your conditions expire.
          </p>
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
          </div>
          <p className="rise-in mt-5 text-sm text-white/50" style={{ animationDelay: "380ms" }}>
            Free during beta
          </p>
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
          body="Each new package is checked against what we already verified for that building. Facts that changed are dated, not overwritten — so the next buyer starts from the record, not from zero."
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
            body="ClearCondo starts with the purchase — what a condo will really cost you before you own it. Next we're building the same check for property tax assessments: if a city overvalues your home, we flag it and build the appeal. One record of what your property actually costs you."
          />
        </div>
      </section>

      {/* Close */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-xl">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.025em] leading-tight">
              Know what you&apos;re buying into.
            </h2>
            <p className="mt-3 text-[#c3cad4]">
              PDFs are read in memory and never stored.{" "}
              <Link href="/privacy" className="text-white underline underline-offset-4 decoration-[#5b6168] hover:decoration-white">
                Privacy
              </Link>
            </p>
          </div>
          <Link
            href="/app"
            className="btn-lift inline-flex items-center gap-2.5 rounded-[10px] bg-white text-ink font-semibold px-6 min-h-12"
          >
            Take me to dashboard <Arrow />
          </Link>
        </div>
      </section>
    </div>
  );
}
