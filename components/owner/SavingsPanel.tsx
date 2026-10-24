import type { UnitRecord } from "@/lib/calgary/unit";
import { cad } from "@/lib/format";

/** "Could you be paying less?": an approximate saving when one is configured, otherwise the ask for details. */
export default function SavingsPanel({
  unit,
  saving,
  ctaHref = "#estimate",
  ctaLabel = "Get my savings estimate",
}: {
  unit: Pick<UnitRecord, "unit"> | null;
  saving: number | null;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <section className="rounded-2xl bg-ink text-white p-6 sm:p-8" aria-labelledby="savings-heading">
      <h2 id="savings-heading" className="text-xl font-bold">Could you be paying less?</h2>
      {saving != null ? (
        <>
          <p className="mt-3">
            <span className="text-4xl font-bold tracking-tight tabular-nums">~{cad(saving)}</span>
            <span className="text-[#c3cad4]"> a year</span>
          </p>
          <p className="mt-1">
            <span className="rounded bg-white/15 px-1.5 py-px text-[11px] font-semibold">Estimate</span>{" "}
            <span className="text-[13px] text-[#c3cad4]">
              if unit {unit?.unit}&apos;s assessment came down by a typical successful-complaint amount
            </span>
          </p>
          <p className="text-sm text-[#c3cad4] mt-4 max-w-2xl leading-relaxed">
            Approximate, not a verdict. Whether yours is over-assessed depends on its size, condition and recent
            comparable sales, which the City doesn&apos;t publish. Tell us about the unit and we&apos;ll come back
            with your real number.
          </p>
        </>
      ) : (
        <p className="text-sm text-[#c3cad4] mt-2 max-w-2xl leading-relaxed">
          Open data can&apos;t say whether {unit ? `unit ${unit.unit}` : "your unit"} is over-assessed: it has no
          unit size, condition or sales. Tell us about the unit and we&apos;ll check it against comparable sales and
          come back with your potential saving.
        </p>
      )}
      <a
        href={ctaHref}
        className="btn-lift mt-5 inline-flex items-center justify-center rounded-lg bg-white text-ink font-semibold text-[15px] px-5 min-h-11"
      >
        {ctaLabel}
      </a>
    </section>
  );
}

