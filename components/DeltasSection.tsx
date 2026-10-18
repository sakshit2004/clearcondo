"use client";

import type { Delta, DeltaEvidence } from "@/lib/deltas";

const KIND_STYLES: Record<Delta["kind"], string> = {
  new: "bg-red-100 text-red-900",
  changed: "bg-amber-100 text-amber-900",
  resolved: "bg-teal-50 text-teal-800",
};

const KIND_LABELS: Record<Delta["kind"], string> = {
  new: "New",
  changed: "Changed",
  resolved: "Resolved",
};

function DeltaEvidenceQuote({ e, label }: { e: DeltaEvidence; label: string }) {
  return (
    <blockquote className="border-l-2 border-teal-700/40 pl-3 py-1 mt-2">
      <p className="text-sm text-stone-700 italic">“{e.quote}”</p>
      <cite className="text-xs text-stone-500 not-italic block mt-1">
        <span className="font-medium">{label}:</span> {e.document_name}
        {e.page != null ? `, p.${e.page}` : ""}
        {e.ocr ? " (verified against OCR transcription)" : " ✓ verified"}
      </cite>
    </blockquote>
  );
}

export default function DeltasSection({ deltas }: { deltas: Delta[] }) {
  if (deltas.length === 0) return null;
  return (
    <section className="report-paper rounded-xl p-6 sm:p-8">
      <h2 className="text-xl font-bold text-stone-900 mb-1">
        What changed since the last review
      </h2>
      <p className="text-sm text-stone-500 mb-5">
        Computed from this building&apos;s previous report — each change links
        to the verified evidence on both sides.
      </p>
      <div className="space-y-5">
        {deltas.map((d, i) => (
          <div key={i} className="border-b border-stone-100 pb-5 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span
                className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${KIND_STYLES[d.kind]}`}
              >
                {KIND_LABELS[d.kind]}
              </span>
              <span className="font-semibold text-stone-900">{d.label}</span>
            </div>
            <p className="text-stone-700 text-[15px] leading-relaxed">{d.detail}</p>
            {d.prev && <DeltaEvidenceQuote e={d.prev} label="Earlier review" />}
            {d.curr && <DeltaEvidenceQuote e={d.curr} label="This review" />}
          </div>
        ))}
      </div>
    </section>
  );
}
