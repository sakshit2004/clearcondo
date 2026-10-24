"use client";

import { useEffect, useState } from "react";
import type { Severity, VerifiedFlag } from "@/lib/report-schema";
import { flagAnchor } from "@/lib/anchors";
import FlagCard from "./FlagCard";

type Filter = "all" | Severity;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "warning", label: "Warning" },
  { id: "info", label: "Info" },
];

/**
 * The interactive flag list: severity filter, expand/collapse per flag
 * and for all. Links to `#flag-N` elsewhere on the page (the exposure
 * breakdown) open and reveal that flag.
 */
export default function FlagList({ flags }: { flags: VerifiedFlag[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });

  useEffect(() => {
    function openFromHash() {
      const m = /^#flag-(\d+)$/.exec(window.location.hash);
      if (!m) return;
      const i = Number(m[1]) - 1;
      setFilter("all");
      setOpen((o) => ({ ...o, [i]: true }));
      requestAnimationFrame(() =>
        document.getElementById(flagAnchor(i))?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  const visible = flags
    .map((flag, i) => ({ flag, i }))
    .filter(({ flag }) => filter === "all" || flag.severity === filter);
  const allOpen = visible.length > 0 && visible.every(({ i }) => open[i]);

  function toggleAll() {
    setOpen((o) => {
      const next = { ...o };
      for (const { i } of visible) next[i] = !allOpen;
      return next;
    });
  }

  if (flags.length === 0) {
    return (
      <div className="report-paper px-6 py-8 text-muted">
        No red flags found in these documents.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl font-bold tracking-[-0.015em]">Red flags</h2>
          <button
            type="button"
            onClick={toggleAll}
            className="text-sm font-semibold text-accent hover:text-accent-dark min-h-11 px-1"
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
        <div
          role="group"
          aria-label="Filter by severity"
          className="flex flex-wrap gap-1 rounded-[10px] border border-line bg-white p-1"
        >
          {FILTERS.map((f) => {
            const count = f.id === "all" ? flags.length : flags.filter((x) => x.severity === f.id).length;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.id)}
                disabled={count === 0}
                className={`inline-flex items-center gap-1.5 rounded-[7px] px-3 min-h-9 text-sm font-semibold transition-colors disabled:opacity-40 ${
                  active ? "bg-ink text-white" : "text-ink2 hover:bg-surface"
                }`}
              >
                {f.label} <span className="opacity-70 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.map(({ flag, i }, n) => (
        <FlagCard
          key={`${filter}-${i}`}
          flag={flag}
          anchor={flagAnchor(i)}
          open={!!open[i]}
          onToggle={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
          delayMs={n * 70}
        />
      ))}
    </div>
  );
}
