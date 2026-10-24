import Link from "next/link";
import type { ReactNode } from "react";
import type { VerifiedAnalysis } from "@/lib/report-schema";
import { FLAG_TYPE_LABELS, SEVERITY_LABELS } from "@/lib/report-schema";
import type { Delta } from "@/lib/deltas";
import type { MissingDoc } from "@/lib/db";
import { buildAuditRows, auditSummary, MATCH_LABELS } from "@/lib/audit";
import { sortPoints, type TimelinePoint } from "@/lib/timeline";
import { cad, formatDate } from "@/lib/format";
import { LogoMark } from "./Logo";
import PrintButton from "./PrintButton";
import { sortFlags } from "./ReportView";

const SEV_INK = { critical: "text-signal-dark", warning: "text-warn-dark", info: "text-info-dark" } as const;

/**
 * The print-ready PDF of a report, to keep or share with a lawyer. One column
 * of running content on Letter, ink on white, every flag numbered with
 * its quote and page, and the audit trail at the back. No separate cover
 * page — the first page carries the building and the headline numbers,
 * so it works on its own.
 */
export default function ReportPrint({
  analysis,
  buildingName,
  buildingMeta,
  createdAt,
  timeline,
  deltas,
  missing,
  isSample = false,
  backHref,
  backLabel,
  autoPrint = false,
  publicRecords,
}: {
  analysis: VerifiedAnalysis;
  buildingName: string;
  buildingMeta?: string;
  createdAt?: string;
  timeline?: TimelinePoint[];
  deltas?: Delta[];
  missing?: MissingDoc[];
  isSample?: boolean;
  backHref: string;
  backLabel: string;
  autoPrint?: boolean;
  /** The public record check (City of Calgary), rendered server-side. */
  publicRecords?: ReactNode;
}) {
  const flags = sortFlags(analysis);
  const counts = { critical: 0, warning: 0, info: 0 };
  for (const f of flags) counts[f.severity]++;
  const auditRows = buildAuditRows(analysis);
  const audit = auditSummary(auditRows);
  const points = timeline && timeline.length >= 2 ? sortPoints(timeline) : null;

  return (
    <div className="mx-auto max-w-[816px] px-4 sm:px-6 py-10 print:p-0 print:max-w-none">
      {/* Screen-only toolbar */}
      <div className="print:hidden mb-8 rounded-[14px] border border-line bg-surface px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href={backHref} className="text-sm text-muted hover:text-ink">
            ← {backLabel}
          </Link>
          <p className="text-sm text-muted mt-1 max-w-md">
            This is the PDF version of the report. Choose <strong>Save as PDF</strong> in the print
            dialog to download it.
          </p>
        </div>
        <PrintButton autoPrint={autoPrint} />
      </div>

      <article className="bg-white text-ink text-[15px] leading-relaxed print:text-[11pt]">
        <div className="flex justify-between items-center pb-4 border-b-2 border-ink">
          <span className="inline-flex items-center gap-2.5">
            <LogoMark size={30} />
            <span className="text-lg font-semibold tracking-[-0.03em]">ClearCondo</span>
          </span>
          <span className="text-right text-xs text-muted leading-normal">
            Verified red-flag report{isSample ? " · sample data" : ""}
            {createdAt && (
              <>
                <br />
                {formatDate(createdAt)}
              </>
            )}
          </span>
        </div>

        <div className="mt-9">
          <h1 className="mt-2.5 mb-1 text-[38px] font-bold tracking-[-0.025em] leading-[1.1]" style={{ textWrap: "balance" }}>
            {buildingName}
          </h1>
          {buildingMeta && <div className="data-label text-muted">{buildingMeta}</div>}
          <p className="mt-5 text-base text-ink2" style={{ textWrap: "pretty" }}>
            {analysis.summary}
          </p>
        </div>

        <div className="mt-7 grid grid-cols-3 rounded-[10px] border border-info">
          <div className="px-4 py-3.5 border-r border-info">
            <div className="text-xs text-muted">Estimated exposure per unit</div>
            <div className="text-[28px] font-bold tracking-[-0.02em] tabular-nums">
              {cad(analysis.money_exposure_total_cad)}
            </div>
          </div>
          <div className="px-4 py-3.5 border-r border-info">
            <div className="text-xs text-muted">Flags found</div>
            <div className="mt-1.5">
              <strong>{counts.critical}</strong> critical · <strong>{counts.warning}</strong> warning ·{" "}
              <strong>{counts.info}</strong> info
            </div>
          </div>
          <div className="px-4 py-3.5">
            <div className="text-xs text-muted">Verification</div>
            <div className="mt-1.5">
              <strong>
                {analysis.verification.verified_claims} of {analysis.verification.total_claims}
              </strong>{" "}
              claims checked against the source page
            </div>
          </div>
        </div>
        {analysis.money_exposure_basis && (
          <p className="mt-3 text-[13px] text-muted">
            <strong className="text-ink">How the exposure adds up:</strong> {analysis.money_exposure_basis}
          </p>
        )}

        {points && (
          <>
            <h2 className="break-after-avoid mt-10 mb-2.5 text-xl font-bold tracking-[-0.01em]">Risk over time</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-[1.5px] border-ink text-left">
                  <th className="py-2 font-semibold">Review</th>
                  <th className="py-2 font-semibold text-right">Reserve funded</th>
                  <th className="py-2 font-semibold text-right">Exposure</th>
                  <th className="py-2 font-semibold text-right">Deductible</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.label} className="border-b border-info">
                    <td className="py-2">{p.label}</td>
                    <td className="py-2 text-right tabular-nums">{p.fundedPct != null ? `${Math.round(p.fundedPct)}%` : "—"}</td>
                    <td className="py-2 text-right tabular-nums">{cad(p.exposureCad)}</td>
                    <td className="py-2 text-right tabular-nums">{cad(p.deductibleCad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {deltas && deltas.length > 0 && (
              <ul className="mt-3 text-sm text-ink2 space-y-1.5">
                {deltas.slice(0, 5).map((d, i) => (
                  <li key={i}>
                    <strong className="text-ink">{d.label}:</strong> {d.detail}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <h2 className="break-after-avoid mt-10 mb-1 text-xl font-bold tracking-[-0.01em]">Red flags, in order of severity</h2>
        <p className="text-[13px] text-muted mb-2">Each flag quotes the document it came from, with the page number.</p>
        {flags.length === 0 && <p className="text-ink2">No red flags found in these documents.</p>}
        {flags.map((f, i) => {
          const e = f.evidence[0];
          return (
            <section key={i} className="py-5 border-t border-info break-inside-avoid">
              <div className="flex justify-between items-baseline gap-4">
                <div className={`micro-label ${SEV_INK[f.severity]}`}>
                  {String(i + 1).padStart(2, "0")} · {SEVERITY_LABELS[f.severity]} ·{" "}
                  <span className="text-muted">{FLAG_TYPE_LABELS[f.flag_type]}</span>
                  {f.downgraded && <span className="text-muted"> · downgraded, unverified</span>}
                </div>
                {f.money_exposure?.per_unit_cad != null && (
                  <div className="font-bold tabular-nums whitespace-nowrap">
                    {cad(f.money_exposure.per_unit_cad)} <span className="text-xs font-medium text-muted">per unit</span>
                  </div>
                )}
              </div>
              <h3 className="mt-1.5 mb-1.5 text-[17px] font-bold tracking-[-0.01em] leading-snug">{f.title}</h3>
              <p className="text-ink2">{f.explanation}</p>
              {e && (
                <div className="mt-2.5 rounded-md bg-[#f3f4f1] px-3.5 py-2.5">
                  <p className="text-sm text-ink2 italic">“{e.quote_display ?? e.quote}”</p>
                  <div className="data-label text-muted mt-1.5">
                    {e.verified ? "✓ Verified" : "⚠ Not verified"} · {e.document_name}, p.{e.matched_page ?? e.page}
                  </div>
                </div>
              )}
            </section>
          );
        })}

        {analysis.questions_for_realtor_lawyer.length > 0 && (
          <>
            <h2 className="break-after-avoid mt-9 mb-2.5 text-xl font-bold tracking-[-0.01em]">Questions to ask before conditions come off</h2>
            <ol className="list-decimal pl-5 text-ink2 space-y-2">
              {analysis.questions_for_realtor_lawyer.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </>
        )}

        {missing && missing.length > 0 && (
          <>
            <h2 className="break-after-avoid mt-9 mb-2.5 text-xl font-bold tracking-[-0.01em]">Not in the package — ask for these</h2>
            <ul className="list-disc pl-5 text-ink2 space-y-1.5">
              {missing.map((m) => (
                <li key={m.id}>
                  <strong className="text-ink">{m.label}</strong> — {m.askFor}
                </li>
              ))}
            </ul>
          </>
        )}

        {publicRecords && <div className="mt-9">{publicRecords}</div>}

        {auditRows.length > 0 && (
          <>
            <h2 className="break-after-avoid mt-9 mb-1.5 text-xl font-bold tracking-[-0.01em]">Verification audit trail</h2>
            <p className="text-sm text-muted mb-2.5">
              {audit.verified} of {audit.total} claims verified against the documents.
            </p>
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="border-b-[1.5px] border-ink text-left">
                  <th className="py-2 pr-3 font-semibold">Claim</th>
                  <th className="py-2 pr-3 font-semibold">Source</th>
                  <th className="py-2 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((r, i) => (
                  <tr key={i} className="border-b border-info align-top">
                    <td className="py-2 pr-3">{r.flagTitle}</td>
                    <td className="py-2 pr-3">
                      {r.documentName}, p.{r.claimedPage}
                    </td>
                    <td className="py-2">
                      {r.verified ? `✓ Verified — ${MATCH_LABELS[r.matchType]}` : "⚠ Not verified — downgraded"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="mt-10 pt-4 border-t-2 border-ink text-xs text-muted leading-relaxed">
          <strong className="text-ink">Disclaimer.</strong> ClearCondo summarizes what your condominium
          documents say. It is not legal, financial, or real-estate advice, and it may miss or
          misinterpret details. Always have a qualified lawyer review the actual documents before you
          buy.
          {isSample && " Sample report — the building, documents, and figures are fictional demonstration data."}
        </div>
      </article>
    </div>
  );
}
