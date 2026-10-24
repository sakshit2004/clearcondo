"use client";

import { useEffect, useRef, useState } from "react";
import type { Severity } from "@/lib/report-schema";
import { FLAG_TYPE_LABELS, type FlagType } from "@/lib/report-schema";
import { cad } from "@/lib/format";
import SeverityBadge from "./SeverityBadge";
import { useCountUp } from "./useCountUp";

export interface HeroFlag {
  severity: Severity;
  flagType: FlagType;
  title: string;
  quote: string;
  source: string;
}

const ROTATE_MS = 4500;

/**
 * The landing-page product preview: a live miniature of a real (sample)
 * report. The exposure counts up, the severity bars grow, and the card
 * cycles through the top flags with their evidence quote highlighted.
 */
export default function HeroReportCard({
  buildingName,
  buildingMeta,
  exposure,
  counts,
  verified,
  total,
  totalFlags,
  flags,
}: {
  buildingName: string;
  buildingMeta: string;
  exposure: number | null;
  counts: Record<Severity, number>;
  verified: number;
  total: number;
  totalFlags: number;
  flags: HeroFlag[];
}) {
  const [idx, setIdx] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const amount = useCountUp(exposure ?? 0, 1600, 600);
  const maxCount = Math.max(1, counts.critical, counts.warning, counts.info);

  function start() {
    if (timer.current) clearInterval(timer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer.current = setInterval(() => setIdx((i) => (i + 1) % flags.length), ROTATE_MS);
  }

  useEffect(() => {
    start();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flags.length]);

  const flag = flags[idx];
  const rows: { sev: Severity; label: string; color: string; delay: string }[] = [
    { sev: "critical", label: "Critical", color: "bg-signal", delay: "0.7s" },
    { sev: "warning", label: "Warning", color: "bg-warn", delay: "0.85s" },
    { sev: "info", label: "Info", color: "bg-info", delay: "1s" },
  ];

  return (
    <div className="float rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(21,24,28,0.04),0_18px_44px_rgba(21,24,28,0.10)] overflow-hidden">
      <div className="relative px-6 py-5 border-b border-[#eceee9] flex justify-between items-start gap-4 overflow-hidden">
        <div
          aria-hidden
          className="scanline pointer-events-none absolute inset-x-0 top-0 h-[30%] bg-gradient-to-b from-transparent via-accent/[0.07] to-transparent"
        />
        <div className="min-w-0">
          <div className="micro-label text-subtle">Red-flag report · Sample</div>
          <div className="text-[22px] font-bold tracking-[-0.01em] mt-1">{buildingName}</div>
          {buildingMeta && <div className="data-label text-subtle mt-0.5">{buildingMeta}</div>}
        </div>
        <div className="pop-in inline-flex items-center gap-1.5 bg-accent-soft text-accent-dark text-[13px] font-semibold px-2.5 py-1.5 rounded-full whitespace-nowrap">
          <Check />
          {verified} of {total} verified
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-[#eceee9]">
        <div className="px-6 py-5 border-r border-[#eceee9]">
          <div className="text-[13px] text-subtle">Estimated exposure per unit</div>
          <div
            className="text-[38px] font-bold tracking-[-0.02em] leading-tight mt-1 tabular-nums"
            aria-label={cad(exposure)}
          >
            {exposure != null ? cad(amount) : "—"}
          </div>
        </div>
        <div className="px-6 py-5 flex flex-col justify-center gap-2.5">
          {rows.map((r) => (
            <div key={r.sev} className="grid grid-cols-[64px_minmax(0,1fr)_16px] items-center gap-2.5 text-sm">
              <span>{r.label}</span>
              <span className="h-2 rounded-full bg-[#f1f2ef] overflow-hidden">
                <span
                  className={`grow-x block h-full rounded-full ${r.color}`}
                  style={{ width: `${(counts[r.sev] / maxCount) * 100}%`, animationDelay: r.delay }}
                />
              </span>
              <strong className="tabular-nums text-right">{counts[r.sev]}</strong>
            </div>
          ))}
        </div>
      </div>

      {flag && (
        <div className="px-6 pt-5 pb-3 min-h-[200px]">
          <div key={idx} className="swap-in">
            <div className="flex items-center gap-2 mb-2">
              <SeverityBadge severity={flag.severity} />
              <span className="text-[13px] text-subtle">{FLAG_TYPE_LABELS[flag.flagType]}</span>
            </div>
            <div className="font-semibold">{flag.title}</div>
            <div className="mt-3 rounded-xl bg-surface px-3.5 py-3 text-sm text-ink2 leading-normal">
              “<span className="highlight-sweep">{flag.quote}</span>”
              <div className="data-label text-subtle mt-2">{flag.source}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pl-6 pr-3 pb-1">
        <span className="text-[13px] text-subtle">
          Flag {idx + 1} of {totalFlags}
        </span>
        <div role="group" aria-label="Show flag" className="flex">
          {flags.map((f, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show flag ${i + 1}: ${f.title}`}
              aria-pressed={i === idx}
              onClick={() => {
                setIdx(i);
                start();
              }}
              className="w-11 h-11 inline-flex items-center justify-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  i === idx ? "w-[22px] bg-accent" : "w-1.5 bg-line2"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="h-[3px] bg-[#f1f2ef]">
        <div key={idx} className="timer-bar h-full bg-accent" />
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path d="M3 7.3l2.4 2.4L11 4.2" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}
