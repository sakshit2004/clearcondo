"use client";

import { useState } from "react";
import { estimateSaving, MAX_COMPARABLES, type OwnerEstimate } from "@/lib/owner-estimate";
import EstimateCard from "./EstimateCard";
import { cad } from "@/lib/format";

type Scenario = { pct: number; lowerBy: number; saving: number; fee: number };

/** What a lower assessment would be worth, when the owner's numbers don't give a tailored estimate. */
function ScenarioCard({ scenarios, reason }: { scenarios: Scenario[]; reason: string | null }) {
  return (
    <section className="rounded-xl border border-ink bg-white p-5" aria-labelledby="scenario-heading">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="scenario-heading" className="font-bold text-ink">Your estimated saving</h3>
        <span className="rounded bg-info-soft text-info-dark px-1.5 py-px text-[11px] font-semibold">Calculation</span>
      </div>
      <p className="text-sm text-stone-600 mt-1">
        {reason ?? "What a lower assessment would save you each year:"}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {scenarios.map((sc) => (
          <div key={sc.pct} className={`rounded-lg p-3 ${sc.pct === 5 ? "bg-ink text-white" : "border border-line"}`}>
            <div className="text-xl font-bold tracking-tight tabular-nums">~{cad(sc.saving)}/yr</div>
            <div className={`text-[12px] mt-0.5 ${sc.pct === 5 ? "text-white/75" : "text-ink2"}`}>if {sc.pct}% lower</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-stone-500 leading-relaxed">
        At the 2026 Calgary residential rate. We check your unit against recent sales and confirm the real number by
        email.
      </p>
    </section>
  );
}

const input =
  "w-full rounded-lg border border-line2 bg-white px-3.5 min-h-[46px] text-[15px] text-ink placeholder:text-subtle focus:outline-2 focus:outline-accent focus:outline-offset-1 focus:border-accent";
const area = `${input} py-2.5 min-h-[84px]`;
const labelCls = "block text-sm font-semibold mb-1.5";
const hint = "font-normal text-subtle";

function Field({ id, label, optional, children }: { id: string; label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelCls}>
        {label} {optional && <span className={hint}>(optional)</span>}
      </label>
      {children}
    </div>
  );
}

const COMP_ROWS = 3;
type Comp = { price: string; sqft: string; date: string };
const emptyComps = (): Comp[] => Array.from({ length: COMP_ROWS }, () => ({ price: "", sqft: "", date: "" }));

/** "720" -> 720; blank or junk -> undefined. */
const num = (v: string) => {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return v.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * "Get my savings estimate": the owner's contact details, the facts open
 * data can't see (size, condition, parking…) and any evidence they have
 * (a purchase, an appraisal, similar sales), posted to /api/owner-requests.
 * The evidence drives a live instant estimate (lib/owner-estimate.ts); we
 * confirm a real number by email.
 */
export default function OwnerRequestForm({
  plan,
  address,
  unit,
  defaultName = "",
  defaultEmail = "",
  alreadyRequested = false,
  assessedValue = null,
}: {
  plan: string;
  address: string | null;
  unit: string | null;
  defaultName?: string;
  defaultEmail?: string;
  alreadyRequested?: boolean;
  /** The unit's City value; without it there's nothing to estimate against. */
  assessedValue?: number | null;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState("");
  const [purchase, setPurchase] = useState({ price: "", date: "" });
  const [appraisal, setAppraisal] = useState({ value: "", date: "" });
  const [comps, setComps] = useState<Comp[]>(emptyComps);
  const [sentEstimate, setSentEstimate] = useState<OwnerEstimate | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);

  const comparables = comps
    .map((c) => ({ price: num(c.price), sqft: num(c.sqft), date: c.date || undefined }))
    .filter((c) => c.price || c.sqft)
    .slice(0, MAX_COMPARABLES);
  const evidence = {
    unit_size_sqft: num(size),
    purchase_price: num(purchase.price),
    purchase_date: purchase.date || undefined,
    appraisal_value: num(appraisal.value),
    appraisal_date: appraisal.date || undefined,
    comparables,
  };
  const estimate = assessedValue ? estimateSaving({ assessed_value: assessedValue, ...evidence }) : null;
  const setComp = (i: number, k: keyof Comp, v: string) =>
    setComps((cs) => cs.map((c, j) => (j === i ? { ...c, [k]: v } : c)));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/owner-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          address: address ?? undefined,
          unit: get("unit") || undefined,
          name: get("name"),
          email: get("email"),
          phone: get("phone"),
          ...evidence,
          assessed_value: assessedValue ?? undefined,
          bedrooms: get("bedrooms"),
          bathrooms: get("bathrooms"),
          parking: get("parking"),
          storage: get("storage"),
          past_complaint: get("past_complaint"),
          notes: get("notes"),
          consent: f.get("consent") === "on",
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Couldn't send your request. Please try again.");
      setSentEstimate(body?.estimate ?? estimate);
      setScenarios(body?.scenarios ?? null);
      setStatus("sent");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }

  if (status === "sent") {
    const tailored = sentEstimate && sentEstimate.status === "saving" ? sentEstimate : null;
    const reason =
      sentEstimate?.status === "no_saving"
        ? "Your numbers don't point below the City's value on their own. Here's what a lower assessment would save:"
        : null;
    return (
      <div className="space-y-4">
        {tailored ? (
          <EstimateCard estimate={tailored} />
        ) : scenarios ? (
          <ScenarioCard scenarios={scenarios} reason={reason} />
        ) : (
          <p className="rounded-xl border border-line p-5 text-sm text-stone-600">
            We couldn&apos;t reach the City&apos;s records just now, so we&apos;ll send your estimate by email.
          </p>
        )}
        <div className="rounded-xl bg-accent-soft p-4" role="status">
          <p className="text-sm text-stone-700 leading-relaxed">
            <strong className="text-accent-dark">Request sent.</strong> We&apos;ll check your unit against recent
            comparable sales and confirm by email. Nothing is filed with the City without your go-ahead.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" aria-label="Get my savings estimate">
      <p className="rounded-lg bg-info-soft text-info-dark text-sm px-4 py-3 leading-relaxed">
        <span className="rounded bg-info-dark text-white px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide mr-2">
          Beta
        </span>
        Estimates are free while we test this. Treat the number as a starting point: we check it by hand.
      </p>
      {alreadyRequested && (
        <p className="rounded-lg bg-stone-100 text-stone-700 text-sm px-4 py-3">
          You&apos;ve already asked about this unit. Send again to add or correct details.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field id="or-name" label="Your name">
          <input id="or-name" name="name" required minLength={2} maxLength={120} defaultValue={defaultName} autoComplete="name" className={input} />
        </Field>
        <Field id="or-email" label="Email">
          <input id="or-email" name="email" type="email" required maxLength={200} defaultValue={defaultEmail} autoComplete="email" className={input} />
        </Field>
      </div>
      {unit ? (
        <input type="hidden" name="unit" value={unit} />
      ) : (
        <Field id="or-unit" label="Unit number">
          <input id="or-unit" name="unit" required maxLength={20} placeholder="e.g. 1203" className={`${input} sm:max-w-[200px]`} />
        </Field>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field id="or-size" label="Unit size (sq ft)">
          <input id="or-size" name="unit_size_sqft" type="number" min={0} max={20000} inputMode="numeric" placeholder="e.g. 720" value={size} onChange={(e) => setSize(e.target.value)} className={input} />
        </Field>
        <Field id="or-pp" label="What you paid">
          <input id="or-pp" inputMode="numeric" placeholder="e.g. 385000" value={purchase.price} onChange={(e) => setPurchase((p) => ({ ...p, price: e.target.value }))} className={input} />
        </Field>
        <div className="col-span-2 sm:col-span-1">
          <Field id="or-pd" label="Month you bought">
            <input id="or-pd" type="month" placeholder="2025-03" value={purchase.date} onChange={(e) => setPurchase((p) => ({ ...p, date: e.target.value }))} className={input} />
          </Field>
        </div>
      </div>

      {estimate ? (
        <EstimateCard estimate={estimate} />
      ) : (
        <p className="text-[13px] text-subtle">Your estimate appears when you send this.</p>
      )}

      <details className="group rounded-xl border border-line">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-ink">
          <span>
            Add more for a better estimate <span className={hint}>(optional)</span>
          </span>
          <span aria-hidden className="text-subtle transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="px-4 pb-5 pt-1 space-y-5 border-t border-line">
          <div className="grid sm:grid-cols-2 gap-4 pt-4">
            <Field id="or-av" label="Appraised value">
              <input id="or-av" inputMode="numeric" placeholder="e.g. 390000" value={appraisal.value} onChange={(e) => setAppraisal((a) => ({ ...a, value: e.target.value }))} className={input} />
            </Field>
            <Field id="or-ad" label="Month of appraisal">
              <input id="or-ad" type="month" placeholder="2025-05" value={appraisal.date} onChange={(e) => setAppraisal((a) => ({ ...a, date: e.target.value }))} className={input} />
            </Field>
          </div>

          <div>
            <p className="text-sm font-semibold">Sales of similar units</p>
            <p className="text-[13px] text-subtle mt-0.5 mb-2">
              In your building or nearby, from a listing site or your realtor. Uses your unit size.
            </p>
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-3 gap-3 text-[12px] font-semibold text-stone-500">
                <span>Sale price</span>
                <span>Size (sq ft)</span>
                <span>Month sold (optional)</span>
              </div>
              {comps.map((c, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 sm:gap-3">
                  <input aria-label={`Sale ${i + 1} price`} inputMode="numeric" placeholder="Price" value={c.price} onChange={(e) => setComp(i, "price", e.target.value)} className={`${input} min-w-0 !px-2.5 sm:!px-3.5`} />
                  <input aria-label={`Sale ${i + 1} size in square feet`} inputMode="numeric" placeholder="Sq ft" value={c.sqft} onChange={(e) => setComp(i, "sqft", e.target.value)} className={`${input} min-w-0 !px-2.5 sm:!px-3.5`} />
                  <input aria-label={`Sale ${i + 1} month`} type="month" value={c.date} onChange={(e) => setComp(i, "date", e.target.value)} className={`${input} min-w-0 !px-2.5 sm:!px-3.5`} />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field id="or-beds" label="Bedrooms">
              <input id="or-beds" name="bedrooms" type="number" min={0} max={20} inputMode="numeric" className={input} />
            </Field>
            <Field id="or-baths" label="Bathrooms">
              <input id="or-baths" name="bathrooms" type="number" min={0} max={20} step={0.5} inputMode="decimal" className={input} />
            </Field>
            <Field id="or-parking" label="Parking">
              <select id="or-parking" name="parking" defaultValue="" className={input}>
                <option value="">Not sure</option>
                <option>None</option>
                <option>Assigned stall</option>
                <option>Titled stall</option>
                <option>Two or more stalls</option>
              </select>
            </Field>
            <Field id="or-storage" label="Storage">
              <select id="or-storage" name="storage" defaultValue="" className={input}>
                <option value="">Not sure</option>
                <option>None</option>
                <option>In-suite</option>
                <option>Storage locker</option>
              </select>
            </Field>
            <Field id="or-past" label="Complained before?">
              <select id="or-past" name="past_complaint" defaultValue="" className={input}>
                <option value="">Not sure</option>
                <option>Never</option>
                <option>Yes, it was lowered</option>
                <option>Yes, no change</option>
              </select>
            </Field>
            <Field id="or-phone" label="Phone">
              <input id="or-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" className={input} />
            </Field>
          </div>

          <Field id="or-notes" label="Condition, renovations, anything else">
            <textarea id="or-notes" name="notes" maxLength={2000} placeholder="Leaks, original finishes, a poor view, recent updates, special assessments…" className={area} />
          </Field>
        </div>
      </details>

      <label className="flex items-start gap-3 cursor-pointer text-sm text-muted leading-relaxed">
        <input type="checkbox" name="consent" required className="mt-0.5 w-5 h-5 flex-none accent-[#1d4ed8]" />
        <span>Contact me about a savings estimate for this unit. Nothing is filed with the City without my go-ahead.</span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-warn-dark">
          {error}
        </p>
      )}

      <div className="pt-5 border-t border-[#eceee9] flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === "sending"}
          className="btn-lift rounded-lg bg-ink hover:bg-accent text-white font-semibold text-[15px] px-6 min-h-12 disabled:opacity-60"
        >
          {status === "sending" ? "Sending…" : "Get my savings estimate"}
        </button>
        <span className="text-[13px] text-subtle">Beta: free for now. You only pay if you save.</span>
      </div>
    </form>
  );
}
