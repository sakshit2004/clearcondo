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
      {/* Summary header */}
      <section className="report-paper rounded-xl p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
            {report.buildingName}
          </h1>
          {report.createdAt && (
            <span className="text-sm text-stone-500">
              {formatDate(report.createdAt)}
            </span>
          )}
        </div>
        {report.buildingMeta && (
          <p className="text-sm text-stone-500 mb-4">{report.buildingMeta}</p>
        )}
        <p className="text-stone-700 leading-relaxed text-[17px]">
          {analysis.summary}
        </p>

        <div className="mt-4 text-sm text-stone-600">
          <span className="font-semibold text-stone-800">
            {analysis.verification.verified_claims} of{" "}
            {analysis.verification.total_claims}
          </span>{" "}
          claims verified against source documents.
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {counts.critical > 0 && (
              <span className="text-sm text-stone-600">
                <SeverityBadge severity="critical" /> × {counts.critical}
              </span>
            )}
            {counts.warning > 0 && (
              <span className="text-sm text-stone-600">
                <SeverityBadge severity="warning" /> × {counts.warning}
              </span>
            )}
            {counts.info > 0 && (
              <span className="text-sm text-stone-600">
                <SeverityBadge severity="info" /> × {counts.info}
              </span>
            )}
            {flags.length === 0 && (
              <span className="text-sm text-stone-600">
                No red flags found in these documents.
              </span>
            )}
          </div>
          {analysis.money_exposure_total_cad != null && (
            <div className="ml-auto rounded-lg bg-stone-900 text-white px-5 py-3">
              <div className="text-xs uppercase tracking-wide text-stone-400">
                Estimated buyer exposure
              </div>
              <div className="text-2xl font-bold">
                {cad(analysis.money_exposure_total_cad)}
              </div>
              <div className="text-xs text-stone-400 max-w-64">
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
        <h2 className="text-xl font-bold text-stone-900">Red flags</h2>
        {flags.map((flag, i) => (
          <FlagCard key={i} flag={flag} />
        ))}
      </section>

      {/* Questions */}
      {analysis.questions_for_realtor_lawyer.length > 0 && (
        <section className="report-paper rounded-xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-stone-900 mb-4">
            Ask your realtor or lawyer
          </h2>
          <ul className="space-y-3">
            {analysis.questions_for_realtor_lawyer.map((q, i) => (
              <li key={i} className="flex gap-3 text-stone-700">
                <span className="flex-none w-6 h-6 rounded-full bg-teal-800 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Missing documents */}
      {report.missing && report.missing.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold text-stone-900 mb-1">
            Not in your package — ask for it
          </h2>
          <p className="text-sm text-stone-500 mb-4">
            A complete Alberta resale package usually includes these. This
            report covers what you uploaded.
          </p>
          <ul className="space-y-2">
            {report.missing.map((m) => (
              <li key={m.id} className="text-sm">
                <span className="font-medium text-stone-800">{m.label}</span>
                <span className="text-stone-500"> — {m.askFor}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Disclaimer */}
      <section className="rounded-xl border border-stone-200 bg-stone-100 px-5 py-4 text-sm text-stone-600">
        <span className="font-semibold text-stone-800">Disclaimer: </span>
        ClearCondo summarizes what your condominium documents say. It is not
        legal, financial, or real-estate advice, and it may miss or
        misinterpret details. Always have a qualified lawyer review the actual
        documents before you buy.
      </section>
    </div>
  );
}
