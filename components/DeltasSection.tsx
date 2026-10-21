"use client";

import type { Delta, DeltaEvidence } from "@/lib/deltas";

const KIND_STYLES: Record<Delta["kind"], string> = {
  new: "bg-signal text-white",
  changed: "bg-ink text-white",
  resolved: "bg-white text-stone-500 border border-stone-300",
};

const KIND_LABELS: Record<Delta["kind"], string> = {
  new: "New",
  changed: "Changed",
  resolved: "Resolved",
};

function DeltaEvidenceQuote({ e, label }: { e: DeltaEvidence; label: string }) {
  return (
    <blockquote className="border-l-2 border-ink pl-4 mt-2.5">
      <p className="text-[15px] leading-relaxed text-stone-700">“{e.quote}”</p>
      <cite className="data-label text-stone-400 not-italic block mt-1.5">
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
    <section className="report-paper p-6 sm:p-8">
      <div className="micro-label text-stone-400 mb-2">Building memory</div>
      <h2 className="font-bold text-2xl tracking-tight text-ink mb-1.5">
        What changed since the last review
      </h2>
      <p className="text-sm text-stone-500 mb-6">
        Computed from this building&apos;s previous report — each change links
        to the verified evidence on both sides.
      </p>
      <div className="space-y-5">
        {deltas.map((d, i) => (
          <div key={i} className="border-b border-stone-200 pb-5 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
              <span
                className={`micro-label px-2 py-1 ${KIND_STYLES[d.kind]}`}
              >
                {KIND_LABELS[d.kind]}
              </span>
              <span className="font-bold text-ink">{d.label}</span>
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
