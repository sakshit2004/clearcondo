import { reportPriceCents } from "@/lib/stripe";
import { cad } from "@/lib/format";

/** Buyer pricing: one report per building's package, free during beta. Mirrors the owner pricing panel. */
export default function BuyerPricing() {
  const price = cad(reportPriceCents() / 100);
  return (
    <section className="report-paper rounded-2xl p-6 sm:p-8" aria-labelledby="buyer-pricing">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="buyer-pricing" className="text-lg font-bold">Pricing</h2>
        <span className="rounded-md bg-accent-soft text-accent-dark px-2 py-0.5 text-xs font-semibold">Free during beta</span>
      </div>
      <p className="text-sm text-subtle mt-1 mb-5">One price per building, before your conditions come off.</p>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="flex gap-4 flex-[1_1_320px]">
          <span className="text-3xl font-bold tracking-tight text-ink tabular-nums flex-none">{price}</span>
          <span className="text-sm text-stone-600 leading-relaxed">
            per report (CAD): a report like this one for one building&apos;s document package, every red flag priced
            per unit and traced to its page, with a PDF for your lawyer.
          </span>
        </div>
        <p className="text-sm text-stone-600 leading-relaxed flex-[1_1_260px]">
          <strong className="text-ink">Free while ClearCondo is in beta.</strong>
        </p>
      </div>
    </section>
  );
}
