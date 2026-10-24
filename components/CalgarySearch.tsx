"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CondoSearchResult } from "@/lib/calgary/search";
import { ownerBuildingHref } from "@/lib/owner-links";

type Status = "idle" | "loading" | "done" | "error";

const MIN = 3;

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="flex-none text-subtle">
      <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="flex-none text-accent animate-spin">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.2" fill="none" />
      <path d="M17 10a7 7 0 00-7-7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Placeholder rows while the first results load. */
function SkeletonRows() {
  return (
    <ul aria-hidden className="py-1.5">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-3">
          <span className="w-[18px] h-[18px] rounded bg-[#eceee9] animate-pulse flex-none" />
          <span className="flex-1 min-w-0 space-y-1.5">
            <span className="block h-3.5 rounded bg-[#eceee9] animate-pulse" style={{ width: `${70 - i * 12}%` }} />
            <span className="block h-3 rounded bg-[#f2f3ef] animate-pulse" style={{ width: `${45 - i * 6}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function BuildingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="flex-none text-accent">
      <path d="M3 16V3.5A1.5 1.5 0 014.5 2h6A1.5 1.5 0 0112 3.5V16M12 7h1.5A1.5 1.5 0 0115 8.5V16M1.5 16h15M6 5h3M6 8h3M6 11h3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Search-as-you-type for an owner's Calgary condo. Suggestions come from
 * /api/calgary/search (debounced, cancellable); Enter on a suggestion
 * opens the building (with the unit, if one was typed), Enter otherwise
 * submits the full results page, so the form still works without JavaScript.
 */
export default function CalgarySearch({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState(defaultValue);
  const [results, setResults] = useState<CondoSearchResult[]>([]);
  const [nearbyStreet, setNearbyStreet] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    // Below MIN the list is hidden (showList), so stale results never show.
    if (term.length < MIN) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/calgary/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        setResults(body.results ?? []);
        setNearbyStreet(body.nearbyStreet ?? null);
        setUnit(body.unit ?? null);
        setActive(-1);
        setStatus("done");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("error");
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // Close the list on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const go = (r: CondoSearchResult) => router.push(ownerBuildingHref(r.plan, unit));
  const term = q.trim();
  const tooShort = term.length > 0 && term.length < MIN;
  const loading = !tooShort && status === "loading";
  const showList = open && (tooShort || (term.length >= MIN && status !== "idle"));

  return (
    <div ref={boxRef} className="relative">
      <form
        action="/app/own"
        method="get"
        role="search"
        onSubmit={(e) => {
          if (showList && active >= 0 && results[active]) {
            e.preventDefault();
            go(results[active]);
          }
        }}
        className="flex items-center gap-2 rounded-2xl bg-white border border-line2 shadow-[0_10px_30px_-12px_rgba(21,24,28,0.25)] pl-4 pr-2 py-2 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15 transition"
      >
        {loading ? <Spinner /> : <SearchIcon />}
        <label htmlFor="calgary-q" className="sr-only">
          Street address or condo plan number
        </label>
        <input
          id="calgary-q"
          name="q"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            // Show the loading state on the keystroke, not after the debounce.
            if (e.target.value.trim().length >= MIN) setStatus("loading");
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!showList || results.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          minLength={MIN}
          maxLength={80}
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="Your address with unit, e.g. 1203-1111 6 Ave SW"
          className="field-input flex-1 min-w-0 bg-transparent text-[17px] min-h-12 focus:outline-none placeholder:text-subtle/80"
        />
        <button
          type="submit"
          className="btn-lift rounded-xl bg-ink hover:bg-accent text-white font-semibold text-[15px] px-5 min-h-11 flex-none"
        >
          Search
        </button>
      </form>

      {showList && (
        <div
          className="absolute z-30 left-0 right-0 mt-2 rounded-2xl bg-white border border-line shadow-[0_18px_40px_-16px_rgba(21,24,28,0.3)] overflow-hidden"
          aria-busy={loading}
        >
          {loading && <div className="loadbar !rounded-none !h-[3px]" aria-hidden />}
          <p role="status" className="sr-only">
            {loading ? "Searching the City roll" : status === "done" ? `${results.length} matching buildings` : ""}
          </p>
          {tooShort && (
            <p className="px-5 py-4 text-sm text-subtle">
              Keep typing: add the street, e.g. &ldquo;1203-1111 6 Ave SW&rdquo;, or a condo plan number.
            </p>
          )}
          {loading && results.length === 0 && (
            <>
              <p className="px-5 pt-3.5 text-[13px] text-subtle">Searching the City roll…</p>
              <SkeletonRows />
            </>
          )}
          {!tooShort && status === "error" && (
            <p className="px-5 py-4 text-sm text-stone-600">City data unavailable. Press Search to try again.</p>
          )}
          {!tooShort && status === "done" && results.length === 0 && (
            <p className="px-5 py-4 text-sm text-stone-600">
              No condo buildings match. Try the street address as it appears on a tax notice, or the plan number.
            </p>
          )}
          {!tooShort && results.length > 0 && (
            <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
              {nearbyStreet && (
                <p className="px-5 pt-3.5 pb-1 text-[13px] text-subtle">
                  No condos at that number. Nearby on <strong className="text-ink">{nearbyStreet}</strong>:
                </p>
              )}
              <ul id={listId} role="listbox" aria-label="Matching condo buildings" className="py-1.5 max-h-[60vh] overflow-y-auto">
                {results.map((r, i) => (
                  <li
                    key={r.plan}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      go(r);
                    }}
                    className={`flex items-center gap-3 px-5 py-3 cursor-pointer ${i === active ? "bg-accent-soft" : ""}`}
                  >
                    <BuildingIcon />
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-ink truncate">{r.addresses[0] ?? `Condo plan ${r.plan}`}</span>
                      <span className="block text-[13px] text-subtle truncate">
                        Plan {r.plan}
                        {r.community ? ` · ${r.community}` : ""}
                        {r.year_built ? ` · built ${r.year_built}` : ""}
                      </span>
                    </span>
                    <span className="text-[13px] text-muted tabular-nums whitespace-nowrap">
                      {unit ? `Unit ${unit}` : `${r.units} unit${r.units === 1 ? "" : "s"}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
