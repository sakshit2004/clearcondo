import { OWNER_PRICING } from "@/lib/owner";
import { cad } from "@/lib/format";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * The owner-side pricing (30% only if you save, $20 per filing), with the beta
 * waiver shown first. Given an estimated saving, works the fee through.
 */
export default function OwnerPricing({ saving }: { saving?: number | null }) {
  const { feeShare, filingFee, freeDuringBeta } = OWNER_PRICING;
  return (
    <section className="report-paper rounded-2xl p-6" aria-labelledby="owner-pricing">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="owner-pricing" className="text-lg font-bold">Pricing</h2>
        {freeDuringBeta && (
          <span className="rounded-md bg-accent-soft text-accent-dark px-2 py-0.5 text-xs font-semibold">
            Free during beta
          </span>
        )}
      </div>
      <p className="text-sm text-subtle mt-1 mb-4">The {pct(feeShare)} only if you save.</p>
      <ul className="space-y-3">
        <li className="flex gap-3">
          <span className="font-bold text-ink tabular-nums w-14 flex-none">{pct(feeShare)}</span>
          <span className="text-sm text-stone-600 leading-relaxed">
            of the tax you save, once your assessment comes down. If it doesn&apos;t, there&apos;s no {pct(feeShare)} fee.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-bold text-ink tabular-nums w-14 flex-none">${filingFee}</span>
          <span className="text-sm text-stone-600 leading-relaxed">
            per filing: our fee to file your complaint, charged when we file. Nothing is filed without your go-ahead.
          </span>
        </li>
      </ul>
      {saving != null && saving > 0 && (
        <p className="text-[13px] text-stone-600 mt-4 pt-4 border-t border-[#eceee9] leading-relaxed tabular-nums">
          On a saving of about {cad(saving)} a year, the fee would be {cad(saving * feeShare)} and you&apos;d keep{" "}
          {cad(saving * (1 - feeShare))}.
          {freeDuringBeta && " During beta you keep all of it."}
        </p>
      )}
      {freeDuringBeta && (
        <p className="text-[13px] text-subtle mt-3">
          No fees while ClearCondo is in beta.
        </p>
      )}
    </section>
  );
}
