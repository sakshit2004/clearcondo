import type { VerifiedEvidence, VerifiedFlag } from "@/lib/report-schema";
import { FLAG_TYPE_LABELS } from "@/lib/report-schema";
import { cad } from "@/lib/format";
import SeverityBadge from "./SeverityBadge";

function EvidenceBadge({ e }: { e: VerifiedEvidence }) {
  if (e.verified && !e.ocr) {
    return (
      <span className="micro-label font-bold text-[#067647]">
        ✓ Verified — {e.document_name}
        {e.matched_page != null ? `, p.${e.matched_page}` : ""}
      </span>
    );
  }
  if (e.verified && e.ocr) {
    return (
      <span className="micro-label font-bold text-amber-700">
        ✓ Verified against OCR — {e.document_name}
        {e.matched_page != null ? `, p.${e.matched_page}` : ""} (lower confidence)
      </span>
    );
  }
  return (
    <span className="micro-label font-bold text-amber-700">
      ⚠ Unverified — check this manually
    </span>
  );
}

export default function FlagCard({ flag }: { flag: VerifiedFlag }) {
  const money = flag.money_exposure;
  return (
    <article className="report-paper rounded-lg p-5 sm:p-6 h-full">
      <div className="flex flex-wrap items-center gap-2.5 mb-3.5">
        <SeverityBadge severity={flag.severity} />
        <span className="micro-label text-stone-500">
          {FLAG_TYPE_LABELS[flag.flag_type]}
        </span>
        {flag.downgraded && (
          <span
            className="font-serif italic text-sm text-stone-500"
            title="A cited quote could not be verified against the source documents, so this flag was downgraded and its dollar figures removed."
          >
            downgraded — unverified evidence
          </span>
        )}
      </div>
      <h3 className="text-xl font-bold text-ink mb-2 leading-snug">
        {flag.title}
      </h3>
      <p className="text-stone-700 leading-relaxed mb-5">{flag.explanation}</p>

      {money && (money.per_unit_cad != null || money.amount_cad != null) && (
        <div className="mb-5 rounded-md bg-ink text-paper px-5 py-4">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {money.per_unit_cad != null && (
              <div>
                <div className="micro-label text-white/45 mb-1">Per unit</div>
                <div className="font-display text-3xl text-signal tracking-wide">
                  {cad(money.per_unit_cad)}
                </div>
              </div>
            )}
            {money.amount_cad != null && (
              <div>
                <div className="micro-label text-white/45 mb-1">Building total</div>
                <div className="font-display text-3xl tracking-wide">
                  {cad(money.amount_cad)}
                </div>
              </div>
            )}
          </div>
          <div className="text-xs text-white/45 mt-3">{money.basis}</div>
        </div>
      )}

      <div className="space-y-2.5">
        <div className="micro-label text-stone-500">Evidence</div>
        {flag.evidence.map((e, i) => (
          <blockquote key={i} className="border-l-[3px] border-signal pl-4 py-0.5">
            <p className="font-serif italic text-[17px] leading-relaxed text-stone-800">
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
