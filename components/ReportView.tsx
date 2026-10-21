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
    <div className="space-y-10">
      {/* Summary header — document cover sheet */}
      <section className="border border-stone-300 border-t-2 border-t-ink bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <span className="micro-label text-ink">Red-flag report</span>
          {report.createdAt && (
            <span className="data-label text-stone-400">
              {formatDate(report.createdAt)}
            </span>
          )}
        </div>
        <h1 className="font-bold text-4xl tracking-[-0.02em] text-ink leading-[1.05] mb-2">
          {report.buildingName}
        </h1>
        {report.buildingMeta && (
          <p className="data-label text-stone-500 mb-5">{report.buildingMeta}</p>
        )}
        <p className="text-stone-600 leading-relaxed max-w-3xl">
          {analysis.summary}
        </p>

        <div className="mt-5 text-sm text-stone-600">
          <span className="font-bold text-signal tabular-nums">
            {analysis.verification.verified_claims} of{" "}
            {analysis.verification.total_claims}
          </span>{" "}
          claims verified against source documents.
        </div>

        <div className="mt-7 pt-6 border-t border-stone-200 flex flex-wrap items-end gap-x-8 gap-y-5">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {counts.critical > 0 && (
              <span className="inline-flex items-center gap-2 text-sm text-stone-600">
                <SeverityBadge severity="critical" />
                <span className="tabular-nums">× {counts.critical}</span>
              </span>
            )}
            {counts.warning > 0 && (
              <span className="inline-flex items-center gap-2 text-sm text-stone-600">
                <SeverityBadge severity="warning" />
                <span className="tabular-nums">× {counts.warning}</span>
              </span>
            )}
            {counts.info > 0 && (
              <span className="inline-flex items-center gap-2 text-sm text-stone-600">
                <SeverityBadge severity="info" />
                <span className="tabular-nums">× {counts.info}</span>
              </span>
            )}
            {flags.length === 0 && (
              <span className="text-sm text-stone-600">
                No red flags found in these documents.
              </span>
            )}
          </div>
          {analysis.money_exposure_total_cad != null && (
            <div className="ml-auto border-l-2 border-signal pl-5">
              <div className="micro-label text-stone-400 mb-1.5">
                Estimated buyer exposure
              </div>
              <div className="text-[40px] leading-none font-bold text-ink tabular-nums tracking-[-0.02em]">
                {cad(analysis.money_exposure_total_cad)}
              </div>
              <div className="text-xs text-stone-400 max-w-64 mt-2 leading-relaxed">
                {analysis.money_exposure_basis}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* What changed since the last review */}
      {report.deltas && report.deltas.length > 0 && (
        <DeltasSection deltas={report.deltas} />
      )}

      {/* Flags */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink pb-3">
          <h2 className="font-bold text-2xl tracking-tight text-ink">Red flags</h2>
          <span className="micro-label text-stone-400">
            {flags.length} found — severity order
          </span>
        </div>
        {flags.map((flag, i) => (
          <FlagCard key={i} flag={flag} />
        ))}
      </section>

      {/* Questions */}
      {analysis.questions_for_realtor_lawyer.length > 0 && (
        <section className="report-paper p-6 sm:p-8">
          <div className="micro-label text-stone-400 mb-2">Next steps</div>
          <h2 className="font-bold text-2xl tracking-tight text-ink mb-6">
            Ask your realtor or lawyer
          </h2>
          <ul className="space-y-4">
            {analysis.questions_for_realtor_lawyer.map((q, i) => (
              <li key={i} className="flex gap-4 text-stone-600 leading-relaxed">
                <span className="flex-none font-bold text-ink tabular-nums">
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
        <section className="report-paper p-6 sm:p-8">
          <div className="micro-label text-stone-400 mb-2">Completeness check</div>
          <h2 className="font-bold text-2xl tracking-tight text-ink mb-2">
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
      <section className="border border-stone-300 px-5 py-4 text-sm text-stone-500 leading-relaxed">
        <span className="micro-label text-ink">Disclaimer — </span>
        ClearCondo summarizes what your condominium documents say. It is not
        legal, financial, or real-estate advice, and it may miss or
        misinterpret details. Always have a qualified lawyer review the actual
        documents before you buy.
      </section>
    </div>
  );
}
