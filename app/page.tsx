import Link from "next/link";
import { readFileSync } from "fs";
import { join } from "path";
import { VerifiedAnalysisSchema } from "@/lib/report-schema";
import { cad } from "@/lib/format";
import FlagCard from "@/components/FlagCard";
import Reveal from "@/components/Reveal";

function getSamplePreview() {
  const json = JSON.parse(
    readFileSync(join(process.cwd(), "sample-data", "sample-report-2026.json"), "utf8")
  );
  const parsed = VerifiedAnalysisSchema.safeParse(json);
  if (!parsed.success) return null;
  return {
    summary: parsed.data.summary,
    total: parsed.data.money_exposure_total_cad,
    flags: parsed.data.flags.slice(0, 2),
  };
}

const TICKER_ITEMS = [
  "Special assessments",
  "Reserve funds",
  "Litigation",
  "Insurance deductibles",
  "Bylaws",
  "Board minutes",
  "Rental rules",
  "Fee increases",
];

export default function LandingPage() {
  const preview = getSamplePreview();

  return (
    <div>
      {/* Hero — ink field, radial glow, oversized type */}
      <section className="relative bg-ink text-white overflow-hidden">
        <div className="absolute inset-0 dotgrid-light opacity-60" aria-hidden />
        <div className="absolute inset-0 hero-glow glow-pulse" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-10 pb-16 sm:pt-14 sm:pb-24">
          <div className="flex justify-between micro-label text-white/45 mb-12 sm:mb-16 rise-in">
            <span>ClearCondo — Verified red-flag reports</span>
            <span className="hidden sm:inline">Calgary · Alberta</span>
          </div>

          <div className="rise-in" style={{ animationDelay: "80ms" }}>
            <h1 className="font-display uppercase leading-[0.92] tracking-tight text-[17vw] sm:text-8xl lg:text-[7.5rem]">
              Know what
              <br />
              you&apos;re buying
            </h1>
            <p className="font-serif italic text-signal text-4xl sm:text-6xl mt-3 sm:mt-4">
              before you buy it.
            </p>
          </div>

          <p
            className="rise-in mt-8 max-w-2xl text-base sm:text-lg text-white/70 leading-relaxed"
            style={{ animationDelay: "160ms" }}
          >
            Sellers hand you a stack of condo documents — reserve fund studies,
            bylaws, meeting minutes — and expect you to spot the $8,500 special
            assessment buried on page 47. Professional reviews cost $400–800
            and take days. ClearCondo gives you a verified red-flag report in
            minutes.
          </p>

          <div
            className="rise-in mt-9 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "240ms" }}
          >
            <Link
              href="/app/new"
              className="bg-signal hover:bg-signal-dark text-ink font-bold px-7 py-3.5 rounded-full text-sm sm:text-base transition-colors"
            >
              Analyze your documents
            </Link>
            <Link
              href="/demo"
              className="border border-white/30 hover:border-white/70 text-white px-7 py-3.5 rounded-full font-semibold text-sm sm:text-base transition-colors"
            >
              See a sample report
            </Link>
          </div>

          <div
            className="rise-in mt-12 pt-6 border-t border-white/12 flex flex-wrap gap-x-10 gap-y-2 micro-label text-white/45"
            style={{ animationDelay: "320ms" }}
          >
            <span>Every claim traced to its page</span>
            <span>Report in minutes, not days</span>
            <span>Beta — reports are free</span>
          </div>
        </div>
      </section>

      {/* Ticker strip */}
      <div className="bg-paper border-b border-ink/70 overflow-hidden py-3" aria-hidden>
        <div className="marquee-track flex whitespace-nowrap w-max">
          {[0, 1].map((copy) => (
            <span key={copy} className="micro-label !text-[12px] text-ink/70">
              {TICKER_ITEMS.map((item) => (
                <span key={`${copy}-${item}`} className="mx-5">
                  {item} <span className="text-signal ml-10">✳</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* How it works — signal field */}
      <section className="bg-signal text-ink">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
          <Reveal>
            <div className="flex items-baseline justify-between mb-10">
              <h2 className="font-display uppercase text-4xl sm:text-6xl tracking-tight">
                How it works
              </h2>
              <span className="micro-label hidden sm:inline">The flow — 03 steps</span>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-px bg-ink/70 border border-ink/70">
            {[
              {
                n: "01",
                title: "Upload the document stack",
                body: "Reserve fund study, bylaws, board and AGM minutes, information statements — whatever the seller gave you, as PDFs.",
              },
              {
                n: "02",
                title: "We read every page",
                body: "ClearCondo extracts the text and analyzes it for the things that cost buyers money: assessments, reserves, litigation, insurance, restrictions, and what's coming next.",
              },
              {
                n: "03",
                title: "Get the red-flag report",
                body: "Each flag comes with the exact quote and document it came from, a dollar exposure where one exists, and questions to take to your realtor or lawyer.",
              },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 110} className="bg-signal">
                <div className="p-7 sm:p-8 h-full">
                  <div className="font-display text-5xl mb-5">{s.n}</div>
                  <h3 className="font-bold text-lg mb-2.5">{s.title}</h3>
                  <p className="text-ink/75 text-sm leading-relaxed">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Sample preview */}
      {preview && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
          <Reveal>
            <div className="flex items-baseline justify-between mb-2">
              <span className="micro-label text-signal-dark">From a sample report</span>
              <Link
                href="/demo"
                className="micro-label text-ink hover:text-signal-dark transition-colors"
              >
                Full report →
              </Link>
            </div>
            <h2 className="font-display uppercase text-4xl sm:text-5xl tracking-tight text-ink mb-5">
              Proof, not promises
            </h2>
            <p className="text-stone-600 mb-8 max-w-3xl leading-relaxed">{preview.summary}</p>
          </Reveal>
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            {preview.flags.map((f, i) => (
              <Reveal key={i} delay={i * 110}>
                <FlagCard flag={f} />
              </Reveal>
            ))}
          </div>
          {preview.total != null && (
            <Reveal>
              <p className="text-stone-700">
                Estimated buyer exposure in this sample:{" "}
                <span className="font-display text-2xl text-ink tracking-wide">
                  {cad(preview.total)}
                </span>
              </p>
            </Reveal>
          )}
        </section>
      )}

      {/* Who it's for — ink field */}
      <section className="bg-ink text-white relative overflow-hidden">
        <div className="absolute inset-0 dotgrid-light opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
          <Reveal>
            <h2 className="font-display uppercase text-4xl sm:text-6xl tracking-tight mb-12">
              Who it&apos;s for
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-10">
            {[
              {
                tag: "Today",
                title: "Condo buyers",
                body: "Upload the resale package before you remove conditions. Know the assessments, the reserve health, and the litigation risk — with every claim traced to the page it came from.",
              },
              {
                tag: "Next",
                title: "Realtors & brokerages",
                body: "White-labeled reports for every listing — show buyers you did the homework, and catch deal-killers before they kill the deal.",
              },
              {
                tag: "Next",
                title: "Condo managers",
                body: "Portfolio-wide monitoring: every building's documents, remembered over time, with change alerts when new minutes land.",
              },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 110}>
                <div className="border-t-2 border-signal pt-5">
                  <div className="micro-label text-signal mb-3">{c.tag}</div>
                  <h3 className="font-bold text-xl mb-2.5">{c.title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Building memory */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
        <Reveal>
          <div className="max-w-3xl">
            <span className="micro-label text-signal-dark">Building memory</span>
            <h2 className="font-display uppercase text-4xl sm:text-5xl tracking-tight text-ink mt-3 mb-3">
              Buildings have memories.
            </h2>
            <p className="font-serif italic text-3xl text-stone-700 mb-6">
              Now your reports do too.
            </p>
            <p className="text-stone-600 leading-relaxed mb-4">
              Every analysis is tied to its building. Upload a fresh set of
              minutes six months later and ClearCondo remembers what it flagged
              last time — what&apos;s new, what&apos;s resolved, and what the
              trend looks like.
            </p>
            <p className="text-stone-600 leading-relaxed">
              One report costs less than fifteen minutes of a lawyer&apos;s
              time, and it reads the documents most buyers never finish.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Privacy */}
      <section className="border-t border-ink/15">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
          <Reveal>
            <div className="max-w-3xl">
              <span className="micro-label text-signal-dark">Privacy</span>
              <h2 className="font-display uppercase text-4xl sm:text-5xl tracking-tight text-ink mt-3 mb-5">
                Your documents, your control.
              </h2>
              <p className="text-stone-600 leading-relaxed mb-5">
                Your PDFs are read in memory and never stored as files. We keep
                the extracted text and document details for 30 days, then delete
                them automatically. Your report stays until you delete it — and
                “Delete this report” on any report page removes it, its
                documents, and the extracted text, permanently.
              </p>
              <Link
                href="/privacy"
                className="micro-label text-ink hover:text-signal-dark transition-colors"
              >
                Read the privacy note →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA — signal field */}
      <section className="bg-signal text-ink">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20 text-center">
          <Reveal>
            <h2 className="font-display uppercase leading-[0.95] text-5xl sm:text-7xl tracking-tight">
              Got the document stack?
            </h2>
            <p className="font-serif italic text-3xl sm:text-4xl mt-3 mb-9">
              Get the truth in it.
            </p>
            <Link
              href="/app/new"
              className="inline-block bg-ink text-white hover:bg-ink2 px-9 py-4 rounded-full font-bold text-base sm:text-lg transition-colors"
            >
              Analyze your documents
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
