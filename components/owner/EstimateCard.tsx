import type { EvidenceSource, OwnerEstimate } from "@/lib/owner-estimate";
import { CALGARY_RES_TAX_RATE_2026 } from "@/lib/calgary/appeals";
import { OWNER_PRICING } from "@/lib/owner";
import { cad } from "@/lib/format";

const SOURCE_LABEL: Record<EvidenceSource, string> = {
  purchase: "Your purchase",
  appraisal: "Your appraisal",
  comparables: "Similar sales",
};

const ratePct = `${Number((CALGARY_RES_TAX_RATE_2026 * 100).toFixed(5))}%`;

/**
 * The instant estimate, worked through: each piece of evidence, the value
 * it points to, and the saving at the residential tax rate. Labelled as a
 * calculation from the owner's own numbers, never as a verdict.
 */
export default function EstimateCard({ estimate }: { estimate: OwnerEstimate }) {
  const e = estimate;
  return (
    <section className="rounded-xl border border-ink bg-white p-5" aria-live="polite" aria-labelledby="instant-estimate">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="instant-estimate" className="font-bold text-ink">Instant estimate</h3>
        <span className="rounded bg-info-soft text-info-dark px-1.5 py-px text-[11px] font-semibold">Calculation</span>
        <span className="text-[12px] text-stone-500">from the numbers you entered</span>
      </div>

      {e.status === "not_enough" ? (
        <p className="text-sm text-stone-600 mt-2 leading-relaxed">
          Add a purchase, an appraisal or a similar sale above to see an estimate.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-line p-3">
              <div className="text-xl font-bold tracking-tight text-ink tabular-nums">{cad(e.assessed_value)}</div>
              <div className="text-[12px] text-ink2 mt-0.5">City&apos;s value</div>
            </div>
            <div className="rounded-lg border border-line p-3">
              <div className="text-xl font-bold tracking-tight text-ink tabular-nums">{cad(e.indicated_value)}</div>
              <div className="text-[12px] text-ink2 mt-0.5">What your evidence points to</div>
            </div>
            <div className={`rounded-lg p-3 ${e.status === "saving" ? "bg-ink text-white" : "border border-line"}`}>
              <div className="text-xl font-bold tracking-tight tabular-nums">
                {e.status === "saving" ? `~${cad(e.annual_saving)}/yr` : "$0"}
              </div>
              <div className={`text-[12px] mt-0.5 ${e.status === "saving" ? "text-white/75" : "text-ink2"}`}>
                Potential tax saving
              </div>
            </div>
          </div>

          <ul className="mt-4 space-y-1 text-[13px] text-stone-600">
            {e.indicators.map((i) => (
              <li key={i.source}>
                <strong className="text-ink font-semibold">{SOURCE_LABEL[i.source]}:</strong> {i.detail} →{" "}
                {cad(i.value)}
              </li>
            ))}
            {e.indicators.length > 1 && (
              <li>
                {e.indicators.length === 2 ? "Average" : "Middle value"} of the {e.indicators.length}:{" "}
                {cad(e.indicated_value)}
              </li>
            )}
            {e.status === "saving" ? (
              <li>
                {cad(e.difference)} lower than the City&apos;s value × {ratePct} residential rate = {cad(e.annual_saving)} a
                year. Our fee would be {cad(e.fee)} ({Math.round(OWNER_PRICING.feeShare * 100)}%), free during beta.
              </li>
            ) : (
              <li>Your evidence doesn&apos;t point below the City&apos;s value, so it doesn&apos;t support a lower assessment on its own.</li>
            )}
          </ul>
        </>
      )}

      {e.skipped.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-[12px] text-warn-dark">
          {e.skipped.map((s, k) => (
            <li key={k}>
              {SOURCE_LABEL[s.source]}
              {s.partial ? ": " : " not used: "}
              {s.reason}.
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[12px] text-stone-500 leading-relaxed">
        2026 values reflect the market on July 1, 2025. Evidence isn&apos;t adjusted for time or condition, so this is a
        starting point: we check it against recent sales before anything is filed.
      </p>
    </section>
  );
}
