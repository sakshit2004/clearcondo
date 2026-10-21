import type { VerifiedAnalysis } from "@/lib/report-schema";
import type { Delta } from "@/lib/deltas";
import type { MissingDoc } from "@/lib/db";
import { cad, formatDate } from "@/lib/format";
import FlagCard from "./FlagCard";
import SeverityBadge from "./SeverityBadge";
import DeltasSection from "./DeltasSection";

/** View-model accepted by ReportView: DB rows, sample JSON, or ephemeral results all map into this. */
export interface ReportVM {
  buildingName: string;
  buildingMeta?: string;
  createdAt?: string;
  isSample?: boolean;
  analysis: VerifiedAnalysis;
  deltas?: Delta[];
  missing?: MissingDoc[];
}

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

export default function ReportView({ report }: { report: ReportVM }) {
  const { analysis } = report;
  const flags = [...analysis.flags].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
  const counts = {
    critical: flags.filter((f) => f.severity === "critical").length,
    warning: flags.filter((f) => f.severity === "warning").length,
    info: flags.filter((f) => f.severity === "info").length,
  };

  return (
    <div className="space-y-8">
      {/* Summary header — ink dossier cover */}
      <section className="relative overflow-hidden rounded-lg bg-ink text-paper p-6 sm:p-9">
        <div className="absolute inset-0 dotgrid-light opacity-35" aria-hidden />
        <div className="relative">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
            <span className="micro-label text-signal">Red-flag report</span>
            {report.createdAt && (
              <span className="micro-label text-white/45">
                {formatDate(report.createdAt)}
              </span>
            )}
          </div>
          <h1 className="font-display uppercase text-4xl sm:text-5xl tracking-tight leading-[0.95] mb-2">
            {report.buildingName}
          </h1>
          {report.buildingMeta && (
            <p className="micro-label !normal-case !tracking-normal !text-[13px] font-mono text-white/50 mb-5">
              {report.buildingMeta}
            </p>
          )}
          <p className="text-paper/85 leading-relaxed text-[17px] max-w-3xl">
            {analysis.summary}
          </p>

          <div className="mt-5 micro-label text-white/55">
            <span className="text-signal font-bold">
              {analysis.verification.verified_claims} of{" "}
              {analysis.verification.total_claims} claims verified
            </span>{" "}
            against source documents
          </div>

          <div className="mt-7 pt-6 border-t border-white/12 flex flex-wrap items-end gap-5">
            <div className="flex flex-wrap gap-2">
              {counts.critical > 0 && (
                <span className="inline-flex items-center gap-2 text-sm text-white/70">
                  <SeverityBadge severity="critical" /> × {counts.critical}
                </span>
              )}
              {counts.warning > 0 && (
                <span className="inline-flex items-center gap-2 text-sm text-white/70">
                  <SeverityBadge severity="warning" /> × {counts.warning}
                </span>
              )}
              {counts.info > 0 && (
                <span className="inline-flex items-center gap-2 text-sm text-white/70">
                  <SeverityBadge severity="info" /> × {counts.info}
                </span>
              )}
              {flags.length === 0 && (
                <span className="text-sm text-white/70">
                  No red flags found in these documents.
                </span>
              )}
            </div>
            {analysis.money_exposure_total_cad != null && (
              <div className="ml-auto border-l-[3px] border-signal pl-5">
                <div className="micro-label text-white/45 mb-1">
                  Estimated buyer exposure
                </div>
                <div className="font-display text-5xl text-signal tracking-wide leading-none">
                  {cad(analysis.money_exposure_total_cad)}
                </div>
                <div className="text-xs text-white/45 max-w-64 mt-2">
                  {analysis.money_exposure_basis}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* What changed since the last review */}
      {report.deltas && report.deltas.length > 0 && (
        <DeltasSection deltas={report.deltas} />
      )}

      {/* Flags */}
      <section className="space-y-5">
        <div className="flex items-baseline gap-4">
          <h2 className="font-display uppercase text-3xl sm:text-4xl tracking-tight text-ink">
            Red flags
          </h2>
          <span className="micro-label text-stone-500">
            {flags.length} found — severity order
          </span>
        </div>
        {flags.map((flag, i) => (
          <FlagCard key={i} flag={flag} />
        ))}
      </section>

      {/* Questions */}
      {analysis.questions_for_realtor_lawyer.length > 0 && (
        <section className="report-paper rounded-lg p-6 sm:p-8">
          <span className="micro-label text-signal-dark">Next steps</span>
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight text-ink mt-2 mb-6">
            Ask your realtor or lawyer
          </h2>
          <ul className="space-y-4">
            {analysis.questions_for_realtor_lawyer.map((q, i) => (
              <li key={i} className="flex gap-4 text-stone-700 leading-relaxed">
                <span className="flex-none font-display text-2xl text-signal leading-none pt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Missing documents */}
      {report.missing && report.missing.length > 0 && (
        <section className="report-paper rounded-lg p-6 sm:p-8">
          <span className="micro-label text-signal-dark">Completeness check</span>
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight text-ink mt-2 mb-2">
            Not in your package — ask for it
          </h2>
          <p className="text-sm text-stone-500 mb-5">
            A complete Alberta resale package usually includes these. This
            report covers what you uploaded.
          </p>
          <ul className="space-y-2.5">
            {report.missing.map((m) => (
              <li key={m.id} className="text-sm">
                <span className="font-semibold text-ink">{m.label}</span>
                <span className="text-stone-500"> — {m.askFor}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Disclaimer */}
      <section className="rounded-lg border border-ink/25 bg-ink/[0.04] px-5 py-4 text-sm text-stone-600">
        <span className="micro-label font-bold text-ink">Disclaimer — </span>
        ClearCondo summarizes what your condominium documents say. It is not
        legal, financial, or real-estate advice, and it may miss or
        misinterpret details. Always have a qualified lawyer review the actual
        documents before you buy.
      </section>
    </div>
  );
}
