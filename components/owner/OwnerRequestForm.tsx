"use client";

import { useState } from "react";

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

/**
 * "Get my savings estimate": the owner's contact details plus the facts
 * open data can't see (size, condition, parking…), posted to
 * /api/owner-requests. We reply with a savings number by email.
 */
export default function OwnerRequestForm({
  plan,
  address,
  unit,
  defaultName = "",
  defaultEmail = "",
  alreadyRequested = false,
}: {
  plan: string;
  address: string | null;
  unit: string | null;
  defaultName?: string;
  defaultEmail?: string;
  alreadyRequested?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

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
          unit_size_sqft: get("unit_size_sqft"),
          bedrooms: get("bedrooms"),
          bathrooms: get("bathrooms"),
          parking: get("parking"),
          storage: get("storage"),
          renovations: get("renovations"),
          condition_issues: get("condition_issues"),
          past_complaint: get("past_complaint"),
          notes: get("notes"),
          consent: f.get("consent") === "on",
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Couldn't send your request. Please try again.");
      setStatus("sent");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-xl bg-accent-soft p-5" role="status">
        <p className="font-semibold text-accent-dark">Request sent.</p>
        <p className="text-sm text-stone-700 mt-1 leading-relaxed">
          We&apos;ll look at your unit against comparable sales and reply by email with your potential saving.
          Nothing is filed with the City without your go-ahead.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" aria-label="Get my savings estimate">
      {alreadyRequested && (
        <p className="rounded-lg bg-info-soft text-info-dark text-sm px-4 py-3">
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
        <Field id="or-phone" label="Phone" optional>
          <input id="or-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" className={input} />
        </Field>
        <Field id="or-unit" label="Unit number">
          <input id="or-unit" name="unit" required maxLength={20} defaultValue={unit ?? ""} placeholder="e.g. 1203" className={input} />
        </Field>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">
          About your unit <span className={hint}>(optional, but it&apos;s what makes the estimate possible)</span>
        </legend>
        <p className="text-[13px] text-subtle mt-1 mb-3">
          The City&apos;s open data has no size, layout or condition. These are what an assessment is argued on.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field id="or-size" label="Size (sq ft)">
            <input id="or-size" name="unit_size_sqft" type="number" min={0} max={20000} inputMode="numeric" placeholder="e.g. 720" className={input} />
          </Field>
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
        </div>
      </fieldset>

      <Field id="or-cond" label="Condition issues" optional>
        <textarea id="or-cond" name="condition_issues" maxLength={1000} placeholder="Leaks, original finishes, noise, a poor view, building problems…" className={area} />
      </Field>
      <Field id="or-reno" label="Renovations" optional>
        <textarea id="or-reno" name="renovations" maxLength={1000} placeholder="What's been updated, and roughly when" className={area} />
      </Field>
      <Field id="or-notes" label="Anything else" optional>
        <textarea id="or-notes" name="notes" maxLength={2000} placeholder="What you paid and when, a recent appraisal or listing, special assessments…" className={area} />
      </Field>

      <label className="flex items-start gap-3 cursor-pointer text-sm text-muted leading-relaxed">
        <input type="checkbox" name="consent" required className="mt-0.5 w-5 h-5 flex-none accent-[#1d4ed8]" />
        <span>
          Contact me by email (or phone, if given) about a savings estimate for this unit. Nothing is filed with the
          City without my go-ahead.
        </span>
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
        <span className="text-[13px] text-subtle">Free during beta. You only pay if you save.</span>
      </div>
    </form>
  );
}
