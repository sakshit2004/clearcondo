"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

const CHANGE = "clearcondo:asked-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? "[]";
  } catch {
    return "[]";
  }
}

/**
 * "Ask your realtor or lawyer" as a working checklist. Ticks are a
 * per-viewer convenience kept in this browser (keyed by report), not
 * report data — a client and their realtor each track their own.
 */
export default function QuestionsChecklist({
  questions,
  storageKey,
}: {
  questions: string[];
  storageKey: string;
}) {
  const key = `clearcondo:asked:${storageKey}`;
  const raw = useSyncExternalStore(subscribe, () => read(key), () => "[]");
  const asked = useMemo(() => {
    let saved: unknown = [];
    try {
      saved = JSON.parse(raw);
    } catch {
      /* malformed — start unticked */
    }
    return questions.map((_, i) => Array.isArray(saved) && saved[i] === true);
  }, [raw, questions]);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    []
  );

  function toggle(i: number) {
    const next = asked.map((v, j) => (j === i ? !v : v));
    try {
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGE));
    } catch {
      /* per-viewer convenience only */
    }
  }

  async function copy() {
    const text = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — leave the label as is */
    }
  }

  const count = asked.filter(Boolean).length;

  return (
    <section className="report-paper p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">Ask your realtor or lawyer</h2>
        <span className="text-[13px] text-subtle whitespace-nowrap tabular-nums">
          {count} of {questions.length} asked
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#eceee9] overflow-hidden mt-3 mb-3.5">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${(count / Math.max(1, questions.length)) * 100}%` }}
        />
      </div>
      <ul className="flex flex-col">
        {questions.map((q, i) => (
          <li key={i}>
            <label className="flex gap-3 items-start py-2.5 px-2 -mx-2 rounded-lg cursor-pointer hover:bg-surface2 transition-colors text-[15px]">
              <input
                type="checkbox"
                checked={asked[i] ?? false}
                onChange={() => toggle(i)}
                className="mt-0.5 w-5 h-5 flex-none accent-[#1d4ed8]"
              />
              <span className={asked[i] ? "text-subtle line-through decoration-info" : "text-ink2"}>{q}</span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={copy}
        className="mt-3.5 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-line2 bg-white hover:border-ink min-h-11 text-sm font-semibold transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <path d="M3 10.5V3.5A1 1 0 0 1 4 2.5h6.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
        <span aria-live="polite">{copied ? "Copied to clipboard" : "Copy questions"}</span>
      </button>
    </section>
  );
}
