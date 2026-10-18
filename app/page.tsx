import Link from "next/link";
import { readFileSync } from "fs";
import { join } from "path";
import { VerifiedAnalysisSchema } from "@/lib/report-schema";
import { cad } from "@/lib/format";
import FlagCard from "@/components/FlagCard";

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

export default function LandingPage() {
  const preview = getSamplePreview();

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 sm:pt-24 pb-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-800 mb-4">
            For Canadian condo buyers
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-900 leading-tight mb-6">
            Know what you&apos;re buying before you buy it.
          </h1>
          <p className="text-lg text-stone-600 leading-relaxed mb-8">
            Sellers hand you a stack of condo documents — reserve fund studies,
            bylaws, meeting minutes — and expect you to spot the $8,500 special
            assessment buried on page 47. Professional document reviews
            typically cost $400–800 and take days. ClearCondo gives you a
            verified red-flag report in about a minute.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/app/new"
              className="bg-teal-800 hover:bg-teal-900 text-white px-6 py-3 rounded-lg font-semibold"
            >
              Analyze your documents
            </Link>
            <Link
              href="/demo"
              className="border border-stone-300 hover:border-stone-400 bg-white text-stone-800 px-6 py-3 rounded-lg font-semibold"
            >
              See a sample report
            </Link>
          </div>
          <p className="text-sm text-stone-500 mt-4">
            Beta: reports are free while we&apos;re in testing.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
          <h2 className="text-2xl font-bold text-stone-900 mb-8">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                n: "1",
                title: "Upload the document stack",
                body: "Reserve fund study, bylaws, board and AGM minutes, information statements — whatever the seller gave you, as PDFs.",
              },
              {
                n: "2",
                title: "We read every page",
                body: "ClearCondo extracts the text and analyzes it for the things that cost buyers money: assessments, reserves, litigation, insurance, restrictions, and what's coming next.",
              },
              {
                n: "3",
                title: "Get the red-flag report",
                body: "Each flag comes with the exact quote and document it came from, a dollar exposure where one exists, and questions to take to your realtor or lawyer.",
              },
            ].map((s) => (
              <div key={s.n} className="rounded-xl border border-stone-200 p-6">
                <div className="w-9 h-9 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center mb-4">
                  {s.n}
                </div>
                <h3 className="font-semibold text-stone-900 mb-2">{s.title}</h3>
                <p className="text-stone-600 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample preview */}
      {preview && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-2xl font-bold text-stone-900">
              From a sample report
            </h2>
            <Link
              href="/demo"
              className="text-sm font-semibold text-teal-800 hover:text-teal-900"
            >
              Full report →
            </Link>
          </div>
          <p className="text-stone-600 mb-6 max-w-3xl">{preview.summary}</p>
          <div className="grid lg:grid-cols-2 gap-5 mb-6">
            {preview.flags.map((f, i) => (
              <FlagCard key={i} flag={f} />
            ))}
          </div>
          {preview.total != null && (
            <p className="text-stone-700">
              Estimated buyer exposure in this sample:{" "}
              <span className="font-bold text-stone-900">{cad(preview.total)}</span>
            </p>
          )}
        </section>
      )}

      {/* Who it's for */}
      <section className="border-t border-stone-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
          <h2 className="text-2xl font-bold text-stone-900 mb-8">Who it&apos;s for</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <div className="text-xs font-semibold uppercase tracking-widest text-teal-800 mb-3">
                Today
              </div>
              <h3 className="font-semibold text-stone-900 mb-2">Condo buyers</h3>
              <p className="text-stone-600 text-sm leading-relaxed">
                Upload the resale package before you remove conditions. Know
                the assessments, the reserve health, and the litigation risk —
                with every claim traced to the page it came from.
              </p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <div className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-3">
                Next
              </div>
              <h3 className="font-semibold text-stone-900 mb-2">
                Realtors &amp; brokerages
              </h3>
              <p className="text-stone-600 text-sm leading-relaxed">
                White-labeled reports for every listing — show buyers you did
                the homework, and catch deal-killers before they kill the deal.
              </p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <div className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-3">
                Next
              </div>
              <h3 className="font-semibold text-stone-900 mb-2">Condo managers</h3>
              <p className="text-stone-600 text-sm leading-relaxed">
                Portfolio-wide monitoring: every building&apos;s documents,
                remembered over time, with change alerts when new minutes land.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Building memory */}
      <section className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-stone-900 mb-4">
              Buildings have memories. Now your reports do too.
            </h2>
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
        </div>
      </section>

      {/* Privacy */}
      <section className="border-t border-stone-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-stone-900 mb-4">
              Your documents, your control.
            </h2>
            <p className="text-stone-600 leading-relaxed mb-4">
              Your PDFs are read in memory and never stored as files. We keep
              the extracted text and document details for 30 days, then delete
              them automatically. Your report stays until you delete it — and
              “Delete this report” on any report page removes it, its
              documents, and the extracted text, permanently.
            </p>
            <Link
              href="/privacy"
              className="text-sm font-semibold text-teal-800 hover:text-teal-900"
            >
              Read the privacy note →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 text-center">
        <h2 className="text-3xl font-bold text-stone-900 mb-4">
          Got the document stack? Get the truth in it.
        </h2>
        <Link
          href="/app/new"
          className="inline-block bg-teal-800 hover:bg-teal-900 text-white px-8 py-3.5 rounded-lg font-semibold text-lg"
        >
          Analyze your documents
        </Link>
      </section>
    </div>
  );
}
