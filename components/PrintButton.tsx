"use client";

/** Screen-only print trigger; hidden from the printed sheet itself. */
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-ink hover:bg-signal text-white font-semibold px-6 py-3 text-[15px] transition-colors print:hidden"
    >
      Print or save as PDF
    </button>
  );
}
