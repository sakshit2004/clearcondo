import type { VerifiedAnalysis } from "@/lib/report-schema";
import { buildAuditRows, auditSummary, MATCH_LABELS } from "@/lib/audit";

/**
 * The verification audit trail — every claim in the report, listed with
 * the page it cited and how the check resolved. The guarantee, shown
 * rather than asserted.
 */
export default function VerificationAudit({
  analysis,
}: {
  analysis: VerifiedAnalysis;
}) {
  const rows = buildAuditRows(analysis);
  if (rows.length === 0) return null;
  const s = auditSummary(rows);

  return (
    <section className="report-paper p-6 sm:p-8">
      <div className="micro-label text-stone-400 mb-2">Verification audit</div>
      <h2 className="font-bold text-2xl tracking-tight text-ink mb-2">
        Every claim, checked
      </h2>
      <p className="text-sm text-stone-500 mb-6 max-w-3xl">
        <span className="font-bold text-ink tabular-nums">{s.verified}</span> of{" "}
        <span className="tabular-nums">{s.total}</span> claims verified
        {" — "}
        <span className="tabular-nums">{s.exactPage}</span> on the exact page,{" "}
        <span className="tabular-nums">{s.exactFile}</span> elsewhere in the same
        file, <span className="tabular-nums">{s.fuzzy}</span> fuzzy
        {s.ocr > 0 && (
          <>
            , <span className="tabular-nums">{s.ocr}</span> against OCR
          </>
        )}
        {s.unverified > 0 && (
          <>
            ,{" "}
            <span className="font-bold text-signal tabular-nums">
              {s.unverified} not verified
            </span>{" "}
            — those flags were downgraded and stripped of dollar figures
            automatically
          </>
        )}
        .
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-t-2 border-ink text-left">
              <th className="micro-label py-2.5 pr-4 font-semibold">Claim</th>
              <th className="micro-label py-2.5 pr-4 font-semibold">Source</th>
              <th className="micro-label py-2.5 pr-4 font-semibold">Match</th>
              <th className="micro-label py-2.5 font-semibold">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-stone-200 align-top">
                <td className="py-3 pr-4 max-w-72">
                  <div className="font-semibold text-ink leading-snug">
                    {r.flagTitle}
                  </div>
                  <div className="text-stone-500 text-[13px] leading-snug mt-1 line-clamp-2">
                    “{r.quote}”
                  </div>
                </td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <div className="data-label text-stone-600 normal-case tracking-normal text-[12px]">
                    {r.documentName}
                  </div>
                  <div className="data-label text-stone-400 mt-1">
                    cited p.{r.claimedPage}
                    {r.matchedPage != null && r.matchedPage !== r.claimedPage
                      ? ` → found p.${r.matchedPage}`
                      : ""}
                  </div>
                </td>
                <td className="py-3 pr-4 whitespace-nowrap text-stone-600">
                  {MATCH_LABELS[r.matchType]}
                  {r.ocr ? " · OCR" : ""}
                </td>
                <td className="py-3 whitespace-nowrap">
                  {r.verified ? (
                    <span className="micro-label text-ink">✓ Verified</span>
                  ) : (
                    <span className="micro-label text-signal">
                      ⚠ Not verified
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
