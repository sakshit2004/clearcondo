import Reveal from "./Reveal";
import SeverityBadge from "./SeverityBadge";

/**
 * The landing page's one picture: a page from the sample AGM minutes, the
 * sentence that matters highlighted, and the flag it becomes in the
 * report. Text is verbatim from demo-docs (North Hill Terrace, sample
 * data). The highlight and the flag animate in when scrolled into view.
 */
export default function EvidenceDemo() {
  return (
    <Reveal className="evidence-demo">
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.15fr)_56px_minmax(0,0.85fr)] items-center gap-6 lg:gap-0">
        {/* The source page */}
        <figure className="m-0 rounded-xl bg-white border border-line shadow-[0_1px_2px_rgba(21,24,28,0.04),0_10px_30px_rgba(21,24,28,0.06)] px-7 sm:px-9 py-8">
          <div className="flex justify-between items-baseline gap-4 data-label text-subtle mb-6">
            <span>AGM minutes · April 22, 2026</span>
            <span>p. 1</span>
          </div>
          <div className="space-y-4 text-[15px] leading-relaxed text-muted">
            <p className="font-semibold text-ink">2. Financial Statements</p>
            <p>
              The audited financial statements were presented and adopted. The
              reserve fund balance at year-end was $745,000 against a
              study-recommended balance of $1,221,000.
            </p>
            <p className="font-semibold text-ink">3. Special Resolution — Special Assessment</p>
            <p>
              WHEREAS the parkade membrane has reached the end of its service
              life and the 2025 reserve fund study identifies its replacement
              at a cost of $714,000,{" "}
              <mark className="evidence-sweep text-ink bg-transparent">
                BE IT RESOLVED that a special assessment of $8,500 per unit
                ($714,000 in total) be levied, payable in four quarterly
                installments of $2,125 commencing July 1, 2026.
              </mark>
            </p>
            <p>Result: 71% in favour. The resolution was declared passed.</p>
          </div>
        </figure>

        {/* Connector */}
        <div aria-hidden className="evidence-late flex lg:justify-center justify-start pl-8 lg:pl-0">
          <svg width="40" height="40" viewBox="0 0 40 40" className="rotate-90 lg:rotate-0">
            <path d="M6 20h26M24 12l8 8-8 8" stroke="#1d4ed8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* The flag it becomes */}
        <div className="evidence-late rounded-xl bg-white border border-line2 px-6 py-6 shadow-[0_10px_30px_rgba(21,24,28,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <SeverityBadge severity="critical" />
            <span className="text-[13px] text-subtle">In the report</span>
          </div>
          <h3 className="mt-3 text-lg font-semibold leading-snug tracking-[-0.01em]">
            $8,500 per unit special assessment, already levied
          </h3>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-[34px] font-bold tracking-[-0.02em] text-signal-dark tabular-nums">$8,500</span>
            <span className="text-sm text-subtle">per unit</span>
          </div>
          <div className="mt-4 pt-4 border-t border-[#eceee9] flex items-center gap-2 text-[13px]">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M3 7.3l2.4 2.4L11 4.2" stroke="#1e3a8a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            </svg>
            <span className="font-semibold text-accent-dark">Verified</span>
            <span className="data-label text-muted">AGM minutes, p. 1</span>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
