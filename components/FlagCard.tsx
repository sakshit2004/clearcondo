"use client";

import type { VerifiedEvidence, VerifiedFlag } from "@/lib/report-schema";
import { FLAG_TYPE_LABELS } from "@/lib/report-schema";
import { cad } from "@/lib/format";
import SeverityBadge from "./SeverityBadge";

function EvidenceBadge({ e }: { e: VerifiedEvidence }) {
  const where = `${e.document_name}${e.matched_page != null ? ` · p.${e.matched_page}` : ""}`;
  if (e.verified && !e.ocr) {
    return (
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-dark">
          <Check /> Verified on the page
        </span>
        <span className="data-label text-muted">{where}</span>
      </span>
    );
  }
  if (e.verified && e.ocr) {
    return (
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted">
          <Check /> Verified against OCR (lower confidence)
        </span>
        <span className="data-label text-muted">{where}</span>
      </span>
    );
  }
  return (
    <span className="text-[13px] font-semibold text-signal-dark">
      ⚠ Unverified — check this manually
    </span>
  );
}

/**
 * One red flag as an expandable row: severity, title and per-unit figure
 * when closed; explanation, money basis and verified evidence when open.
 */
export default function FlagCard({
  flag,
  anchor,
  open,
  onToggle,
  delayMs = 0,
}: {
  flag: VerifiedFlag;
  anchor: string;
  open: boolean;
  onToggle: () => void;
  delayMs?: number;
}) {
  const money = flag.money_exposure;
  const hasMoney = money && (money.per_unit_cad != null || money.amount_cad != null);
  const panelId = `${anchor}-panel`;

  return (
    <article
      id={anchor}
      className={`rise-in scroll-mt-24 rounded-[14px] border bg-white transition-[border-color,box-shadow] duration-200 hover:shadow-[0_6px_18px_rgba(21,24,28,0.06)] ${
        open ? "border-line2" : "border-line hover:border-line2"
      }`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full text-left px-5 sm:px-6 py-5 grid grid-cols-[minmax(0,1fr)_auto_24px] items-center gap-4 sm:gap-5 cursor-pointer"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <SeverityBadge severity={flag.severity} />
            <span className="text-[13px] text-subtle">{FLAG_TYPE_LABELS[flag.flag_type]}</span>
            {flag.downgraded && (
              <span className="text-[13px] text-subtle italic">downgraded — unverified evidence</span>
            )}
          </div>
          <h3 className="text-[17px] sm:text-lg font-semibold tracking-[-0.01em] leading-snug">{flag.title}</h3>
        </div>
        <div className="text-right">
          {money?.per_unit_cad != null && (
            <>
              <div
                className={`text-xl sm:text-[22px] font-bold tracking-[-0.02em] tabular-nums ${
                  flag.severity === "critical" ? "text-signal-dark" : "text-ink"
                }`}
              >
                {cad(money.per_unit_cad)}
              </div>
              <div className="text-xs text-subtle">per unit</div>
            </>
          )}
        </div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          aria-hidden
          className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          <path d="M5 7.5l5 5 5-5" stroke="#4a5058" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div id={panelId} className="open-in px-5 sm:px-6 pb-6">
          <div className="border-t border-[#eceee9] pt-4 grid grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_220px] gap-6">
            <div>
              <p className="text-muted text-[15px] leading-relaxed">{flag.explanation}</p>
              <div className="mt-4 space-y-3">
                {flag.evidence.map((e, i) => (
                  <blockquote key={i} className="rounded-[10px] bg-surface px-4 py-3.5">
                    <p className="text-[15px] leading-relaxed text-ink2">
                      “<span className={e.verified ? "highlight-sweep" : ""}>{e.quote_display ?? e.quote}</span>”
                    </p>
                    <cite className="not-italic block mt-2.5">
                      <EvidenceBadge e={e} />
                    </cite>
                  </blockquote>
                ))}
              </div>
            </div>
            <div>
              {hasMoney ? (
                <div className="rounded-[10px] border border-[#eceee9] bg-surface2 px-4 py-3.5">
                  {money.amount_cad != null && (
                    <>
                      <div className="text-[13px] text-subtle">Building total</div>
                      <div className="text-xl font-bold tabular-nums">{cad(money.amount_cad)}</div>
                    </>
                  )}
                  {money.basis && (
                    <div className="text-xs text-subtle mt-2 leading-relaxed">{money.basis}</div>
                  )}
                </div>
              ) : (
                <div className="rounded-[10px] border border-[#eceee9] bg-surface2 px-4 py-3.5 text-sm text-subtle">
                  No dollar figure in the documents for this flag.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path d="M3 7.3l2.4 2.4L11 4.2" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}
