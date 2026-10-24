import Link from "next/link";
import { readFileSync } from "fs";
import { join } from "path";
import { VerifiedAnalysisSchema, type Severity } from "@/lib/report-schema";
import HeroReportCard, { type HeroFlag } from "@/components/HeroReportCard";
import Reveal from "@/components/Reveal";

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

/** Trim a quote to roughly `max` characters on a word boundary. */
function excerpt(text: string, max = 150): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "") + "…";
}

function getSamplePreview() {
  const json = JSON.parse(
    readFileSync(join(process.cwd(), "sample-data", "sample-report-2026.json"), "utf8")
  );
  const parsed = VerifiedAnalysisSchema.safeParse(json);
  if (!parsed.success) return null;
  const a = parsed.data;
  const sorted = [...a.flags].sort(
    (x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]
  );
  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0 };
  for (const f of a.flags) counts[f.severity]++;
  const flags: HeroFlag[] = sorted
    .filter((f) => f.evidence[0])
    .slice(0, 3)
    .map((f) => {
      const e = f.evidence[0];
      return {
        severity: f.severity,
        flagType: f.flag_type,
        title: f.title,
        quote: excerpt(e.quote_display ?? e.quote),
        source: `${e.document_name} · p.${e.matched_page ?? e.page}`,
      };
    });
  const b = a.building;
  return {
    buildingName: b.name || "Sample building",
    buildingMeta: [b.corp_number ? `Corp No. ${b.corp_number}` : null, b.units ? `${b.units} units` : null]
      .filter(Boolean)
      .join(" · "),
    exposure: a.money_exposure_total_cad,
    counts,
    verified: a.verification.verified_claims,
    total: a.verification.total_claims,
    totalFlags: a.flags.length,
    flags,
  };
}

const DOC_TYPES = [
  "Reserve fund studies",
  "Bylaws",
  "AGM minutes",
  "Board minutes",
  "Information statements",
  "Insurance certificates",
  "Financial statements",
  "Annual budgets",
];

const LOOK_FOR = [
  ["Special assessments", "Levied, voted, or being discussed — with the per-unit amount."],
  ["Reserve fund health", "Balance against what the reserve study recommends."],
  ["Unfunded capital projects", "Repairs on the horizon with no funding plan."],
  ["Litigation", "Claims, mediation and lawsuits involving the corporation."],
  ["Insurance deductibles", "What owners can be charged after the next claim."],
  ["Rental & use restrictions", "Caps and bylaw changes that affect investors."],
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="micro-label text-accent">{children}</div>;
}

function Arrow() {
  return (
    <svg className="nudge" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <circle cx="9" cy="9" r="8" fill="none" stroke="#15181c" strokeWidth="1.4" />
      <path d="M5.5 9.2l2.3 2.3 4.7-4.8" stroke="#15181c" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Large, faint CC arcs that slowly counter-rotate behind a section. */
function BackdropRings({ className, inverse = false }: { className: string; inverse?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className={`pointer-events-none absolute ${className}`}>
      <g className="spin-slow">
        <path d="M35.3 12.7A16 16 0 1 0 35.3 35.3" fill="none" stroke={inverse ? "#ffffff" : "#15181c"} strokeWidth="1.2" strokeLinecap="round" />
      </g>
      <g className="spin-slow-r">
        <path d="M30.4 17.6A9 9 0 1 0 30.4 30.4" fill="none" stroke={inverse ? "#7aa2ff" : "#1d4ed8"} strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

const primaryBtn =
  "btn-lift inline-flex items-center gap-2.5 rounded-[10px] bg-accent hover:bg-accent-dark text-white font-semibold px-6 min-h-12";
const secondaryBtn =
  "inline-flex items-center rounded-[10px] border border-line2 bg-white hover:border-ink text-ink font-semibold px-6 min-h-12 transition-colors";

export default function LandingPage() {
  const preview = getSamplePreview();

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative bg-surface border-b border-line overflow-hidden">
        <BackdropRings className="w-[1100px] h-[1100px] -right-[260px] -top-[240px] opacity-[0.07]" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-16 sm:pt-20 pb-20">
          <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-14 items-center">
            <div>
              <div className="rise-in inline-flex items-center gap-2.5 bg-white border border-line rounded-full px-3.5 py-1.5 text-[13px] font-medium text-muted mb-7">
                <span className="ping w-2 h-2 rounded-full bg-accent inline-block" />
                Free while in beta · Calgary, Alberta
              </div>
              <h1 className="font-bold tracking-[-0.03em] leading-[1.04] text-[40px] sm:text-[56px] lg:text-[60px] text-ink">
                <span className="rise-in block" style={{ animationDelay: "80ms" }}>Every red flag in</span>
                <span className="rise-in block" style={{ animationDelay: "180ms" }}>the condo documents,</span>
                <span className="rise-in block text-accent" style={{ animationDelay: "300ms" }}>traced to the page.</span>
              </h1>
              <p className="rise-in mt-6 text-lg sm:text-[19px] leading-relaxed text-muted max-w-xl" style={{ animationDelay: "420ms" }}>
                Send us the reserve fund study, bylaws and minutes. A verified
                report comes back with each risk, the dollar exposure, and the
                exact quote it came from — ready to walk your client through
                before conditions come off.
              </p>
              <div className="rise-in mt-9 flex flex-wrap gap-3" style={{ animationDelay: "550ms" }}>
                <Link href="/order" className={primaryBtn}>
                  Send a document package <Arrow />
                </Link>
                <Link href="/demo" className={secondaryBtn}>
                  See a sample report
                </Link>
              </div>
              <div className="rise-in mt-9 flex flex-wrap gap-6 text-sm text-muted" style={{ animationDelay: "700ms" }}>
                <span className="inline-flex items-center gap-2"><CheckCircle />No account needed</span>
                <span className="inline-flex items-center gap-2"><CheckCircle />Back in minutes</span>
                <span className="inline-flex items-center gap-2"><CheckCircle />Your name on the report</span>
              </div>
            </div>
            {preview && (
              <div className="rise-in" style={{ animationDelay: "300ms" }}>
                <HeroReportCard {...preview} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Document ticker */}
      <section aria-label="Documents we read" className="marquee-box border-b border-line py-[18px] overflow-hidden bg-white">
        <div className="marquee gap-12 text-[15px] text-subtle whitespace-nowrap">
          {[0, 1].map((copy) => (
            <span key={copy} className="flex gap-12" aria-hidden={copy === 1 || undefined}>
              {DOC_TYPES.map((d) => (
                <span key={d} className="flex gap-12">
                  <span>{d}</span>
                  <span aria-hidden className="text-accent">●</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 pb-8 scroll-mt-20">
        <Reveal>
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-2.5 mb-10 text-3xl sm:text-[38px] font-bold tracking-[-0.02em] leading-tight max-w-2xl">
            Three steps. Nothing new to learn.
          </h2>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              n: "01",
              title: "Send the package",
              body: "Forward the PDFs the seller's side delivered — reserve fund study, bylaws, minutes, information statements. No account to create.",
              icon: <path d="M11 15V4M6.5 8.5L11 4l4.5 4.5M4 15v3h14v-3" />,
            },
            {
              n: "02",
              title: "We read and verify every page",
              body: "Assessments, reserves, litigation, insurance, restrictions. Every claim is machine-checked against the exact page it cites.",
              icon: (
                <>
                  <circle cx="10" cy="10" r="6" />
                  <path d="M14.5 14.5L19 19" />
                </>
              ),
            },
            {
              n: "03",
              title: "Get a client-ready report",
              body: "Each flag with its quote and page, the dollar exposure, and the audit trail. Explore it online or download the PDF with your name on it.",
              icon: (
                <>
                  <path d="M6 3h7l4 4v12H6z" />
                  <path d="M9 12l2 2 3.5-3.5" />
                </>
              ),
            },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 110}>
              <div className="card-lift h-full rounded-[14px] border border-line bg-white p-7">
                <div className="card-icon w-11 h-11 rounded-[10px] bg-surface flex items-center justify-center mb-5">
                  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden fill="none" stroke="#15181c" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    {s.icon}
                  </svg>
                </div>
                <div className="data-label text-subtle text-[13px]">{s.n}</div>
                <h3 className="mt-1 mb-2 text-xl font-bold tracking-[-0.01em]">{s.title}</h3>
                <p className="text-muted text-[15px] leading-relaxed">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* What we look for */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-8">
        <Reveal>
          <Eyebrow>What we look for</Eyebrow>
          <h2 className="mt-2.5 mb-10 text-3xl sm:text-[38px] font-bold tracking-[-0.02em] leading-tight max-w-3xl">
            The things that cost buyers money after they move in.
          </h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 border-t border-line">
          {LOOK_FOR.map(([title, body], i) => (
            <Reveal key={title} delay={(i % 3) * 90}>
              <div className="py-6 pr-6 border-b border-line transition-[padding,background-color] duration-300 hover:pl-3 hover:bg-surface2">
                <div className="font-semibold text-[17px]">{title}</div>
                <div className="text-muted text-[15px] mt-1">{body}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-8">
        <Reveal>
          <Eyebrow>Who it&apos;s for</Eyebrow>
          <h2 className="mt-2.5 mb-10 text-3xl sm:text-[38px] font-bold tracking-[-0.02em] leading-tight max-w-3xl">
            A service, not another tool for the stack.
          </h2>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              tag: "Today",
              title: "Realtors & brokerages",
              body: "Forward the package, get a verified report back with your name on it. Show clients diligence they can see, and catch the deal-killers while there's still time to renegotiate or walk.",
            },
            {
              tag: "Also",
              title: "Condo buyers",
              body: "Buying without an agent, or want a second set of eyes on the package? Send it in yourself and get the same verified report, in plain language.",
            },
            {
              tag: "Next",
              title: "Condo managers",
              body: "Portfolio-wide monitoring: every building's documents, remembered over time, with change alerts when new minutes land.",
            },
          ].map((c, i) => (
            <Reveal key={c.title} delay={i * 110}>
              <div className="card-lift h-full rounded-[14px] border border-line bg-white p-7">
                <span className="inline-block rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-muted">{c.tag}</span>
                <h3 className="mt-3 mb-2 text-xl font-bold tracking-[-0.01em]">{c.title}</h3>
                <p className="text-muted text-[15px] leading-relaxed">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Cost comparison */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[20px] bg-ink text-white p-8 sm:p-14 grid gap-8">
            <BackdropRings inverse className="w-[520px] h-[520px] -right-[140px] -bottom-[200px] opacity-[0.12]" />
            <div className="relative flex flex-wrap justify-between items-end gap-6">
              <div className="max-w-xl">
                <div className="micro-label text-[#a9b4c4]">Why it costs less</div>
                <h2 className="mt-2.5 text-3xl sm:text-4xl font-bold tracking-[-0.02em] leading-tight">
                  A professional document review takes days. This takes minutes.
                </h2>
              </div>
              <Link href="/demo" className="btn-lift inline-flex items-center gap-2.5 rounded-[10px] bg-white text-ink font-semibold px-5 min-h-12">
                Open the sample report <Arrow />
              </Link>
            </div>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[480px] text-base">
                <thead>
                  <tr className="text-left micro-label text-[#a9b4c4]">
                    <th className="py-3 font-semibold">Method</th>
                    <th className="py-3 font-semibold">Cost</th>
                    <th className="py-3 font-semibold">Time</th>
                    <th className="py-3 font-semibold">Every claim sourced</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[#343a42]">
                    <td className="py-4">Professional review</td>
                    <td className="py-4 tabular-nums">$400–800</td>
                    <td className="py-4">Days</td>
                    <td className="py-4 text-[#a9b4c4]">Varies</td>
                  </tr>
                  <tr className="border-t border-[#343a42] font-bold">
                    <td className="py-4">ClearCondo</td>
                    <td className="py-4">Free in beta</td>
                    <td className="py-4">Minutes</td>
                    <td className="py-4">Yes — quote and page</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Memory + privacy */}
      <section id="privacy" className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-24">
        <div className="grid md:grid-cols-2 gap-6">
          <Reveal>
            <div className="card-lift h-full rounded-[14px] border border-line bg-white p-8">
              <h3 className="mb-2.5 text-[22px] font-bold tracking-[-0.01em]">
                Buildings have memories. Now your reports do too.
              </h3>
              <p className="text-muted leading-relaxed">
                Every analysis is tied to its building. Upload new minutes six
                months later and ClearCondo shows what&apos;s new, what&apos;s
                resolved, and where the trend is going.
              </p>
            </div>
          </Reveal>
          <Reveal delay={110}>
            <div className="card-lift h-full rounded-[14px] border border-line bg-white p-8">
              <h3 className="mb-2.5 text-[22px] font-bold tracking-[-0.01em]">Your documents, your control.</h3>
              <p className="text-muted leading-relaxed">
                PDFs are read in memory and never stored as files. Extracted
                text is deleted after 30 days. Delete any report — and
                everything behind it — in one click.
              </p>
              <Link href="/privacy" className="inline-block mt-3.5 font-semibold text-[15px] text-ink hover:text-accent">
                Read the privacy note →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Closing */}
      <section className="border-t border-line bg-surface">
        <Reveal className="mx-auto max-w-6xl px-4 sm:px-6 py-16 flex flex-wrap items-center justify-between gap-6">
          <h2 className="text-3xl sm:text-[34px] font-bold tracking-[-0.02em] leading-tight max-w-2xl">
            Got the document package? Find out what&apos;s in it.
          </h2>
          <Link href="/order" className={primaryBtn}>
            Send a document package <Arrow />
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
