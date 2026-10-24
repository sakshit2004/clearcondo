import Link from "next/link";
import type { Severity, VerifiedAnalysis } from "@/lib/report-schema";
import type { Delta } from "@/lib/deltas";
import type { MissingDoc } from "@/lib/db";
import { cad, formatDate } from "@/lib/format";
import { SEVERITY_SWATCH } from "./SeverityBadge";
import DeltasSection from "./DeltasSection";
import VerificationAudit from "./VerificationAudit";
import BuildingTimeline from "./BuildingTimeline";
import ExposureFigure from "./ExposureFigure";
import FlagList from "./FlagList";
import { flagAnchor } from "@/lib/anchors";
import QuestionsChecklist from "./QuestionsChecklist";
import type { TimelinePoint } from "@/lib/timeline";

/** View-model accepted by ReportView: DB rows, sample JSON, or ephemeral results all map into this. */
export interface ReportVM {
  buildingName: string;
  buildingMeta?: string;
  createdAt?: string;
  isSample?: boolean;
  analysis: VerifiedAnalysis;
  deltas?: Delta[];
  missing?: MissingDoc[];
  timeline?: TimelinePoint[];
}

export const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

const SEVERITIES: Severity[] = ["critical", "warning", "info"];

/** Flags in the order every report surface shows them: critical first. */
export function sortFlags(analysis: VerifiedAnalysis) {
  return [...analysis.flags].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M8 2v8M5 7l3 3 3-3M3 12v2h10v-2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The interactive report: cover with the exposure figure and where it
 * comes from, the filterable/expandable flag list, and a sidebar of next
 * steps. `pdfHref` points at the print-ready version of the same report;
 * `storageKey` scopes the per-viewer questions checklist.
 */
export default function ReportView({
  report,
  pdfHref,
  storageKey = "report",
}: {
  report: ReportVM;
  pdfHref?: string;
  storageKey?: string;
}) {
  const { analysis } = report;
  const flags = sortFlags(analysis);
  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0 };
  for (const f of flags) counts[f.severity]++;

  const moneyFlags = flags
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.money_exposure?.per_unit_cad != null)
    .sort((a, b) => (b.f.money_exposure!.per_unit_cad ?? 0) - (a.f.money_exposure!.per_unit_cad ?? 0));

  const documents = [...new Set(flags.flatMap((f) => f.evidence.map((e) => e.document_name)))];
  const { verified_claims: verified, total_claims: total } = analysis.verification;

  return (
    <div className="space-y-8">
      {/* Cover */}
      <section className="rise-in report-paper overflow-hidden rounded-2xl">
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2.5 mb-3">
              <span className="micro-label text-subtle">Red-flag report</span>
              {report.createdAt && (
                <span className="data-label text-subtle">{formatDate(report.createdAt)}</span>
              )}
              {report.isSample && (
                <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-muted">Sample data</span>
              )}
            </div>
            <h1 className="text-3xl sm:text-[40px] font-bold tracking-[-0.025em] leading-[1.1]">
              {report.buildingName}
            </h1>
            {report.buildingMeta && (
              <p className="data-label text-subtle mt-1.5 text-[13px] break-words">{report.buildingMeta}</p>
            )}
            <p className="mt-5 text-ink2 text-[17px] leading-relaxed max-w-2xl">{analysis.summary}</p>
            {total > 0 && (
              <div className="pop-in inline-flex items-center gap-2 mt-5 rounded-lg bg-accent-soft text-accent-dark text-sm font-semibold px-3 py-2">
                <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden>
                  <path d="M3 7.3l2.4 2.4L11 4.2" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                </svg>
                {verified} of {total} claims verified against the source pages
              </div>
            )}
            {flags.length > 0 && (
              <div className="mt-6 pt-5 border-t border-[#eceee9]">
                <div
                  className="flex h-2.5 max-w-lg rounded-full overflow-hidden gap-[3px]"
                  role="img"
                  aria-label={SEVERITIES.map((s) => `${counts[s]} ${s}`).join(", ")}
                >
                  {SEVERITIES.filter((s) => counts[s] > 0).map((s, i) => (
                    <span
                      key={s}
                      className={`grow-x ${SEVERITY_SWATCH[s]}`}
                      style={{ flex: counts[s], animationDelay: `${500 + i * 150}ms` }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-[18px] mt-2.5 text-sm text-ink2">
                  {SEVERITIES.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-[3px] ${SEVERITY_SWATCH[s]}`} />
                      <strong>{counts[s]}</strong> {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 bg-surface2 border-t lg:border-t-0 lg:border-l border-[#eceee9] flex flex-col gap-5">
            <div>
              <div className="text-sm text-subtle">Estimated buyer exposure per unit</div>
              <div className="text-[44px] sm:text-[52px] font-bold tracking-[-0.03em] leading-[1.05] mt-1">
                {analysis.money_exposure_total_cad != null ? (
                  <ExposureFigure amount={analysis.money_exposure_total_cad} />
                ) : (
                  "—"
                )}
              </div>
              {analysis.money_exposure_basis && (
                <p className="text-[13px] text-subtle mt-2 leading-relaxed">{analysis.money_exposure_basis}</p>
              )}
            </div>
            {moneyFlags.length > 0 && (
              <div>
                <div className="text-[13px] text-subtle mb-1">Where the money is — select to open the flag</div>
                <div className="flex flex-col">
                  {moneyFlags.map(({ f, i }) => (
                    <a
                      key={i}
                      href={`#${flagAnchor(i)}`}
                      className="flex items-center justify-between gap-3 rounded-lg px-2.5 -mx-2.5 min-h-11 hover:bg-surface transition-colors text-[15px] text-ink no-underline"
                    >
                      <span className="inline-flex items-center gap-2.5 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-[3px] flex-none ${SEVERITY_SWATCH[f.severity]}`} />
                        <span className="truncate">{f.title}</span>
                      </span>
                      <strong className="tabular-nums whitespace-nowrap">{cad(f.money_exposure!.per_unit_cad)}</strong>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-8 items-start">
        <div className="flex-[999_1_560px] min-w-0 space-y-8">
          <FlagList flags={flags} />
          {report.timeline && report.timeline.length >= 2 && <BuildingTimeline points={report.timeline} />}
          {report.deltas && report.deltas.length > 0 && <DeltasSection deltas={report.deltas} />}
          <VerificationAudit analysis={analysis} />
          <section className="report-paper px-5 py-4 text-sm text-muted leading-relaxed">
            <strong className="text-ink">Disclaimer.</strong> ClearCondo summarizes what your
            condominium documents say. It is not legal, financial, or real-estate advice, and it may
            miss or misinterpret details. Always have a qualified lawyer review the actual documents
            before you buy.
          </section>
        </div>

        <aside className="flex-[1_1_300px] space-y-4" aria-label="Next steps">
          {analysis.questions_for_realtor_lawyer.length > 0 && (
            <QuestionsChecklist questions={analysis.questions_for_realtor_lawyer} storageKey={storageKey} />
          )}

          {report.missing && report.missing.length > 0 && (
            <section className="report-paper p-6">
              <h2 className="text-lg font-bold">Missing from the package</h2>
              <p className="text-sm text-subtle mt-1 mb-4">
                A complete Alberta resale package usually includes these. This report covers what was
                uploaded.
              </p>
              <ul className="flex flex-col gap-3 text-[15px]">
                {report.missing.map((m) => (
                  <li key={m.id} className="flex gap-2.5 items-start">
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="flex-none mt-0.5">
                      <circle cx="9" cy="9" r="7.5" stroke="#9a3412" strokeWidth="1.5" fill="none" />
                      <path d="M9 5.5v4M9 12.2v.3" stroke="#9a3412" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    <span>
                      <strong className="font-semibold">{m.label}</strong>
                      <span className="block text-[13px] text-subtle">{m.askFor}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {pdfHref && (
            <section className="rounded-[14px] bg-ink text-white p-6">
              <h2 className="text-lg font-bold">Take it offline</h2>
              <p className="text-sm text-[#c3cad4] mt-1.5 mb-4">
                A print-ready PDF with every flag, quote and page reference, ready to send to a client.
              </p>
              <Link
                href={pdfHref}
                className="btn-lift flex items-center justify-center gap-2 rounded-lg bg-white text-ink font-semibold text-[15px] min-h-11"
              >
                <DownloadIcon /> Download PDF
              </Link>
            </section>
          )}

          {documents.length > 0 && (
            <section className="report-paper p-6">
              <h2 className="text-lg font-bold mb-3">Documents cited</h2>
              <ul className="flex flex-col gap-2.5 data-label text-muted break-all">
                {documents.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Toolbar row above a report: back link and the PDF download. */
export function ReportToolbar({ backHref, backLabel, pdfHref }: { backHref: string; backLabel: string; pdfHref: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <Link href={backHref} className="text-[15px] text-muted hover:text-ink">
        ← {backLabel}
      </Link>
      <Link
        href={pdfHref}
        className="btn-lift inline-flex items-center gap-2 rounded-lg bg-ink hover:bg-accent text-white font-semibold text-sm px-4 min-h-11"
      >
        <DownloadIcon /> Download PDF
      </Link>
    </div>
  );
}
