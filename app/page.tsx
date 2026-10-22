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

/** Numbered section with the Swiss left rail: index + label, content right. */
function Section({
  index,
  label,
  children,
}: {
  index: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-ink">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16 grid md:grid-cols-12 gap-6 md:gap-8">
        <div className="md:col-span-3">
          <div className="micro-label text-stone-500">
            <span className="text-ink font-bold">{index}</span>
            <span className="mx-2 text-stone-300">/</span>
            {label}
          </div>
        </div>
        <div className="md:col-span-9">{children}</div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const preview = getSamplePreview();

  return (
    <div>
      {/* Hero — flush-left grotesque, one data table, no decoration */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-14 pb-14">
        <div className="flex flex-wrap gap-x-8 gap-y-1 micro-label text-stone-500 mb-10 rise-in">
          <span>For realtors &amp; their buyers</span>
          <span>Verified red-flag reports</span>
          <span>Calgary, Alberta</span>
        </div>

        <h1
          className="rise-in font-bold tracking-[-0.02em] leading-[1.02] text-[42px] sm:text-6xl lg:text-[68px] text-ink max-w-4xl"
          style={{ animationDelay: "60ms" }}
        >
          Send the package. Get the verdict.
        </h1>

        <div
          className="rise-in grid md:grid-cols-12 gap-8 mt-10"
          style={{ animationDelay: "120ms" }}
        >
          <div className="md:col-span-7">
            <p className="text-stone-600 leading-relaxed max-w-xl">
              Your client is about to buy into a building nobody has audited
              for them. The document stack — reserve fund study, bylaws,
              meeting minutes — holds the $8,500 special assessment buried on
              page 47. Send us the package and a verified red-flag report
              comes back: each flag traced to the exact quote and page it came
              from, with your name on it, ready to walk your client through
              before conditions come off. No account. No new software to
              learn.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
              <Link
                href="/order"
                className="bg-ink hover:bg-signal text-white font-semibold px-6 py-3 text-[15px] transition-colors"
              >
                Send a document package
              </Link>
              <Link
                href="/demo"
                className="font-semibold text-ink underline underline-offset-4 decoration-stone-300 hover:decoration-signal"
              >
                See a sample report
              </Link>
            </div>
            <p className="micro-label text-stone-400 mt-6">
              Beta — the service is free while we&apos;re in testing
            </p>
          </div>

          <div className="md:col-span-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t-2 border-ink text-left">
                  <th className="micro-label py-2.5 pr-4 font-semibold">Method</th>
                  <th className="micro-label py-2.5 pr-4 font-semibold">Cost</th>
                  <th className="micro-label py-2.5 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="text-stone-600">
                <tr className="border-t border-stone-200">
                  <td className="py-2.5 pr-4">Professional review</td>
                  <td className="py-2.5 pr-4 tabular-nums">$400–800</td>
                  <td className="py-2.5">Days</td>
                </tr>
                <tr className="border-t border-b border-stone-200">
                  <td className="py-2.5 pr-4 font-semibold text-ink">ClearCondo</td>
                  <td className="py-2.5 pr-4 tabular-nums">Free in beta</td>
                  <td className="py-2.5">Minutes</td>
                </tr>
              </tbody>
            </table>
            <p className="text-[13px] text-stone-500 leading-relaxed mt-4">
              Every claim in the report is checked against the page it cites.
              A claim that cannot be verified is downgraded automatically —
              it can never appear as critical or carry a dollar figure.
            </p>
          </div>
        </div>
      </section>

      {/* 01 — How the service works */}
      <Section index="01" label="How the service works">
        <Reveal>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                n: "1",
                title: "Send the document package",
                body: "Reserve fund study, bylaws, board and AGM minutes, information statements — forward the PDFs the seller's side delivered, straight from the order page. No account to create.",
              },
              {
                n: "2",
                title: "We read and verify every page",
                body: "We analyze the stack for the things that cost buyers money — assessments, reserves, litigation, insurance, restrictions — and machine-check every claim against the exact page it cites.",
              },
              {
                n: "3",
                title: "The report comes back to you",
                body: "Client-ready, with your name on it: each flag with its quote and page, the dollar exposure, and the audit trail behind every claim. Print it or forward it as-is.",
              },
            ].map((s) => (
              <div key={s.n} className="border-t border-stone-300 pt-4">
                <div className="font-bold text-ink mb-2">{s.n}</div>
                <h3 className="font-bold text-ink mb-1.5">{s.title}</h3>
                <p className="text-stone-600 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* 02 — Sample report */}
      {preview && (
        <Section index="02" label="Sample report">
          <Reveal>
            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
              <h2 className="font-bold text-2xl tracking-tight text-ink">
                From a sample report
              </h2>
              <Link
                href="/demo"
                className="micro-label text-ink underline underline-offset-4 decoration-stone-300 hover:decoration-signal"
              >
                Full report →
              </Link>
            </div>
            <p className="text-stone-600 mb-8 max-w-3xl leading-relaxed">{preview.summary}</p>
            <div className="grid lg:grid-cols-2 gap-5 mb-8">
              {preview.flags.map((f, i) => (
                <FlagCard key={i} flag={f} />
              ))}
            </div>
            {preview.total != null && (
              <p className="text-stone-600 text-sm">
                Estimated buyer exposure in this sample:{" "}
                <span className="font-bold text-ink tabular-nums text-base">
                  {cad(preview.total)}
                </span>
              </p>
            )}
          </Reveal>
        </Section>
      )}

      {/* 03 — Who it's for */}
      <Section index="03" label="Who it's for">
        <Reveal>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                tag: "Today",
                title: "Realtors & brokerages",
                body: "Not another tool for the stack — a service. Forward the package, get a verified report back with your name on it. Show clients diligence they can see, and catch the deal-killers while there's still time to renegotiate or walk.",
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
            ].map((c) => (
              <div key={c.title} className="border-t border-stone-300 pt-4">
                <div className="micro-label text-stone-400 mb-2.5">{c.tag}</div>
                <h3 className="font-bold text-ink mb-1.5">{c.title}</h3>
                <p className="text-stone-600 text-sm leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* 04 — Building memory */}
      <Section index="04" label="Building memory">
        <Reveal>
          <div className="max-w-3xl">
            <h2 className="font-bold text-2xl tracking-tight text-ink mb-4">
              Buildings have memories. Now your reports do too.
            </h2>
            <p className="text-stone-600 leading-relaxed mb-4">
              Every analysis is tied to its building. Upload a fresh set of
              minutes six months later and ClearCondo remembers what it flagged
              last time — what&apos;s new, what&apos;s resolved, and what the
              trend looks like.
            </p>
            <p className="text-stone-600 leading-relaxed">
              We keep the building&apos;s file. The next time the same
              building lands on your desk, its record is already here — and
              one report costs less than fifteen minutes of a lawyer&apos;s
              time.
            </p>
          </div>
        </Reveal>
      </Section>

      {/* 05 — Privacy */}
      <Section index="05" label="Privacy">
        <Reveal>
          <div className="max-w-3xl">
            <h2 className="font-bold text-2xl tracking-tight text-ink mb-4">
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
              className="micro-label text-ink underline underline-offset-4 decoration-stone-300 hover:decoration-signal"
            >
              Read the privacy note →
            </Link>
          </div>
        </Reveal>
      </Section>

      {/* Closing */}
      <section className="border-t border-ink">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14 grid md:grid-cols-12 gap-6 items-center">
          <h2 className="md:col-span-8 font-bold text-3xl sm:text-4xl tracking-tight text-ink">
            Got the document stack? Get the truth in it.
          </h2>
          <div className="md:col-span-4 md:text-right">
            <Link
              href="/order"
              className="inline-block bg-ink hover:bg-signal text-white font-semibold px-7 py-3.5 transition-colors"
            >
              Send a document package
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
