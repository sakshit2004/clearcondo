"use client";

import { useEffect } from "react";

/**
 * Screen-only "Download PDF" control for the print view: opens the
 * browser's print dialog, where "Save as PDF" produces the file. With
 * `autoPrint` the dialog opens once on arrival (the report's Download PDF
 * link lands here with ?download=1). Hidden from the printed sheet.
 */
export default function PrintButton({ autoPrint = false }: { autoPrint?: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    // Let fonts settle so the PDF isn't set in the fallback face.
    const t = setTimeout(() => {
      document.fonts.ready.then(() => window.print());
    }, 300);
    return () => clearTimeout(t);
  }, [autoPrint]);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-lift inline-flex items-center gap-2 rounded-lg bg-ink hover:bg-accent text-white font-semibold px-5 min-h-11 text-[15px] print:hidden"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <path d="M8 2v8M5 7l3 3 3-3M3 12v2h10v-2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Download PDF
    </button>
  );
}
