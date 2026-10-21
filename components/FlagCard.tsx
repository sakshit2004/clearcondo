import type { VerifiedEvidence, VerifiedFlag } from "@/lib/report-schema";
import { FLAG_TYPE_LABELS } from "@/lib/report-schema";
import { cad } from "@/lib/format";
import SeverityBadge from "./SeverityBadge";

function EvidenceBadge({ e }: { e: VerifiedEvidence }) {
  if (e.verified && !e.ocr) {
    return (
      <span className="micro-label text-ink">
        ✓ Verified — {e.document_name}
        {e.matched_page != null ? `, p.${e.matched_page}` : ""}
      </span>
    );
  }
  if (e.verified && e.ocr) {
    return (
      <span className="micro-label text-stone-500">
        ✓ Verified against OCR — {e.document_name}
        {e.matched_page != null ? `, p.${e.matched_page}` : ""} (lower confidence)
      </span>
    );
  }
  return (
    <span className="micro-label text-signal">
      ⚠ Unverified — check this manually
    </span>
  );
}

export default function FlagCard({ flag }: { flag: VerifiedFlag }) {
  const money = flag.money_exposure;
  return (
    <article className="report-paper p-5 sm:p-6 h-full">
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
        <SeverityBadge severity={flag.severity} />
        <span className="micro-label text-stone-400">
          {FLAG_TYPE_LABELS[flag.flag_type]}
        </span>
        {flag.downgraded && (
          <span
            className="text-[13px] text-stone-500 italic"
            title="A cited quote could not be verified against the source documents, so this flag was downgraded and its dollar figures removed."
          >
            downgraded — unverified evidence
          </span>
        )}
      </div>
      <h3 className="text-[19px] font-bold text-ink mb-2 leading-snug tracking-[-0.01em]">
        {flag.title}
      </h3>
      <p className="text-stone-600 leading-relaxed mb-5">{flag.explanation}</p>

      {money && (money.per_unit_cad != null || money.amount_cad != null) && (
        <div className="mb-5 border-t-2 border-ink pt-3.5">
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            {money.per_unit_cad != null && (
              <div>
                <div className="micro-label text-stone-400 mb-1">Per unit</div>
                <div className="text-[26px] leading-none font-bold text-signal tabular-nums">
                  {cad(money.per_unit_cad)}
                </div>
              </div>
            )}
            {money.amount_cad != null && (
              <div>
                <div className="micro-label text-stone-400 mb-1">Building total</div>
                <div className="text-[26px] leading-none font-bold text-ink tabular-nums">
                  {cad(money.amount_cad)}
                </div>
              </div>
            )}
          </div>
          <div className="text-xs text-stone-400 mt-3">{money.basis}</div>
        </div>
      )}

      <div className="space-y-3">
        <div className="micro-label text-stone-400">Evidence</div>
        {flag.evidence.map((e, i) => (
          <blockquote key={i} className="border-l-2 border-ink pl-4">
            <p className="text-[15px] leading-relaxed text-stone-700">
              “{e.quote_display ?? e.quote}”
            </p>
            <cite className="not-italic block mt-1.5">
              <EvidenceBadge e={e} />
            </cite>
          </blockquote>
        ))}
      </div>
    </article>
  );
}
