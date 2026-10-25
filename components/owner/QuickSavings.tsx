"use client";

import { useState } from "react";
import { estimateSaving, savingIfLowered } from "@/lib/owner-estimate";
import { CALGARY_RES_TAX_RATE_2026 } from "@/lib/calgary/appeals";
import { cad } from "@/lib/format";

const field =
  "w-full min-w-0 rounded-lg border border-white/20 bg-white/[0.06] px-3 min-h-11 text-[15px] text-white placeholder:text-white/40 focus:outline-2 focus:outline-white focus:outline-offset-1 [color-scheme:dark]";

const num = (v: string) => {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return v.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * The quick, low-input estimate on a unit page: what each percent off the
 * City's value is worth (no input), a slider for any reduction, and an
 * optional "what you paid" for a tailored number. Plain calculations from
 * the City value and the residential tax rate, labelled as such.
 */
export default function QuickSavings({ assessedValue }: { assessedValue: number }) {
  const [pct, setPct] = useState(5);
  const [paid, setPaid] = useState("");
  const [month, setMonth] = useState("");
  const perPercent = savingIfLowered(assessedValue, 1).saving;
  const at = savingIfLowered(assessedValue, pct);
  const price = num(paid);
  const tailored = price
    ? estimateSaving({ assessed_value: assessedValue, purchase_price: price, purchase_date: month || undefined })
    : null;

  return (
    <div className="mt-4 space-y-5">
      <p className="text-[15px] text-white/85 leading-relaxed">
        Each 1% off your {cad(assessedValue)} assessment saves about{" "}
        <strong className="text-white tabular-nums">{cad(perPercent)} a year</strong>.
      </p>

      <div className="rounded-xl bg-white/[0.06] border border-white/15 p-4">
        <label htmlFor="qs-pct" className="flex items-baseline justify-between gap-3 text-sm text-white/80">
          <span>If it came down by</span>
          <span className="text-lg font-bold text-white tabular-nums">{pct}%</span>
        </label>
        <input
          id="qs-pct"
          type="range"
          min={1}
          max={15}
          step={1}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          className="mt-2 w-full accent-white"
        />
        <p className="mt-2 tabular-nums">
          <span className="text-3xl font-bold tracking-tight">~{cad(at.saving)}</span>
          <span className="text-white/70"> a year saved</span>
        </p>
        <p className="mt-1 text-[12px] text-white/60 tabular-nums">
          <span className="rounded bg-white/15 px-1.5 py-px text-[11px] font-semibold text-white mr-1.5">Calculation</span>
          {cad(at.lowerBy)} lower × {Number((CALGARY_RES_TAX_RATE_2026 * 100).toFixed(5))}% residential rate. Fee{" "}
          {cad(at.fee)} (30%), free during beta.
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-white">Know what you paid? Get a closer number.</p>
        <div className="mt-2 grid grid-cols-2 gap-2 max-w-md">
          <input aria-label="What you paid" inputMode="numeric" placeholder="What you paid" value={paid} onChange={(e) => setPaid(e.target.value)} className={field} />
          <input aria-label="Month you bought" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={field} />
        </div>
        {tailored && (
          <p className="mt-2 text-sm text-white/85 leading-relaxed" aria-live="polite">
            {tailored.status === "saving" ? (
              <>
                Your purchase points to {cad(tailored.indicated_value)}, {cad(tailored.difference)} under the City&apos;s
                value: about <strong className="text-white">{cad(tailored.annual_saving)} a year</strong>.
              </>
            ) : tailored.status === "no_saving" ? (
              <>Your purchase price isn&apos;t below the City&apos;s value, so on its own it doesn&apos;t point to a saving.</>
            ) : (
              <span className="text-[#f5c48a]">{tailored.skipped[0]?.reason ? `Can't use it yet: ${tailored.skipped[0].reason}.` : ""}</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
