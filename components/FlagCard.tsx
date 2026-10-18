import type { VerifiedEvidence, VerifiedFlag } from "@/lib/report-schema";
import { FLAG_TYPE_LABELS } from "@/lib/report-schema";
import { cad } from "@/lib/format";
import SeverityBadge from "./SeverityBadge";

function EvidenceBadge({ e }: { e: VerifiedEvidence }) {
  if (e.verified && !e.ocr) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-800">
        <span aria-hidden>✓</span> Verified — {e.document_name}
        {e.matched_page != null ? `, p.${e.matched_page}` : ""}
      </span>
    );
  }
  if (e.verified && e.ocr) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800">
        <span aria-hidden>✓</span> Verified against OCR transcription —{" "}
        {e.document_name}
        {e.matched_page != null ? `, p.${e.matched_page}` : ""} (lower confidence)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800">
      <span aria-hidden>⚠</span> Unverified — check this manually
    </span>
  );
}

export default function FlagCard({ flag }: { flag: VerifiedFlag }) {
  const money = flag.money_exposure;
  return (
    <article className="report-paper rounded-xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SeverityBadge severity={flag.severity} />
        <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
          {FLAG_TYPE_LABELS[flag.flag_type]}
        </span>
        {flag.downgraded && (
          <span
            className="text-xs text-stone-500 italic"
            title="A cited quote could not be verified against the source documents, so this flag was downgraded and its dollar figures removed."
          >
            downgraded — unverified evidence
          </span>
        )}
      </div>
      <h3 className="text-lg font-semibold text-stone-900 mb-2">
        {flag.title}
      </h3>
      <p className="text-stone-700 leading-relaxed mb-4">{flag.explanation}</p>

      {money && (money.per_unit_cad != null || money.amount_cad != null) && (
        <div className="flex flex-wrap gap-4 mb-4 rounded-lg bg-stone-50 border border-stone-200 px-4 py-3">
          {money.per_unit_cad != null && (
            <div>
              <div className="text-xs uppercase tracking-wide text-stone-500">
                Per unit
              </div>
              <div className="text-xl font-bold text-stone-900">
                {cad(money.per_unit_cad)}
              </div>
            </div>
          )}
          {money.amount_cad != null && (
            <div>
              <div className="text-xs uppercase tracking-wide text-stone-500">
                Building total
              </div>
              <div className="text-xl font-bold text-stone-900">
                {cad(money.amount_cad)}
              </div>
            </div>
          )}
          <div className="basis-full text-xs text-stone-500">{money.basis}</div>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Evidence
        </div>
        {flag.evidence.map((e, i) => (
          <blockquote
            key={i}
            className="border-l-2 border-teal-700/40 pl-3 py-1"
          >
            <p className="text-sm text-stone-700 italic">“{e.quote_display ?? e.quote}”</p>
            <cite className="text-xs text-stone-500 not-italic block mt-1">
              <EvidenceBadge e={e} />
            </cite>
          </blockquote>
        ))}
      </div>
    </article>
  );
}
