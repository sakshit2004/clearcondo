import type { ReactNode } from "react";
import type { UnitRecord } from "@/lib/calgary/unit";
import { CALGARY_RES_TAX_RATE_2026, REVIEW_BOARD_SINCE, annualTax } from "@/lib/calgary/appeals";
import { cad } from "@/lib/format";

type Label = "Fact" | "Calculation" | "Estimate";

const LABEL_STYLES: Record<Label, string> = {
  Fact: "bg-accent-soft text-accent-dark",
  Calculation: "bg-info-soft text-info-dark",
  Estimate: "bg-warn-soft text-warn-dark",
};

/** Every number says what kind of number it is. */
export function NumberLabel({ kind, children }: { kind: Label; children?: ReactNode }) {
  return (
    <span className="text-[12px] text-stone-500">
      <span className={`rounded px-1.5 py-px text-[11px] font-semibold ${LABEL_STYLES[kind]}`}>{kind}</span>
      {children && <> {children}</>}
    </span>
  );
}

function Stat({ value, label, note }: { value: string; label: string; note: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 min-w-0">
      <div className="text-2xl font-bold tracking-tight text-ink tabular-nums">{value}</div>
      <div className="text-[13px] text-ink2 mt-0.5">{label}</div>
      <div className="mt-2">{note}</div>
    </div>
  );
}

const ratePct = (n: number) => `${Number((n * 100).toFixed(5))}%`;
const signedPct = (n: number) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;

/**
 * One unit's assessment, the tax it means, and how it sits against the
 * building. City facts and plain calculations only.
 */
export default function UnitTaxCard({
  unit,
  buildingMedian,
  sourceUrl,
}: {
  unit: UnitRecord;
  buildingMedian: number | null;
  /** Omitted on the sample report. */
  sourceUrl?: string;
}) {
  const year = unit.roll_year ?? 2026;
  const filed = unit.complaints?.reduce((n, y) => n + y.filed, 0) ?? null;
  const vsMedian =
    unit.assessed_value != null && buildingMedian ? unit.assessed_value / buildingMedian - 1 : null;

  return (
    <section className="report-paper rounded-2xl p-6 sm:p-8" aria-labelledby="unit-heading">
      <div className="micro-label text-stone-400 mb-2">Your unit</div>
      <h2 id="unit-heading" className="font-bold text-2xl tracking-tight text-ink">
        {year} assessment
      </h2>
      <p className="text-sm text-stone-500 mt-1 mb-6 max-w-2xl">
        What the City says unit {unit.unit} is worth, and the property tax that comes with it.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Stat
          value={cad(unit.assessed_value)}
          label={`Assessed value, ${year}`}
          note={
            <NumberLabel kind="Fact">
              {sourceUrl ? (
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  City assessment roll
                </a>
              ) : (
                "sample data"
              )}
            </NumberLabel>
          }
        />
        <Stat
          value={unit.assessed_value != null ? `${cad(annualTax(unit.assessed_value))}/yr` : "—"}
          label="Est. property tax"
          note={
            <NumberLabel kind="Calculation">
              {unit.assessed_value != null
                ? `${cad(unit.assessed_value)} × ${ratePct(CALGARY_RES_TAX_RATE_2026)} (${year} residential rate)`
                : "no current value"}
            </NumberLabel>
          }
        />
        <Stat
          value={unit.change != null ? signedPct(unit.change) : "—"}
          label={unit.prev_year ? `Change since ${unit.prev_year}` : "Change from last year"}
          note={
            <NumberLabel kind="Fact">
              {unit.prev_value != null ? `${cad(unit.prev_value)} in ${unit.prev_year}` : "no earlier value on record"}
            </NumberLabel>
          }
        />
        <Stat
          value={vsMedian != null ? signedPct(vsMedian) : "—"}
          label="Against the building's median unit"
          note={
            <NumberLabel kind="Calculation">
              {buildingMedian != null ? `median unit ${cad(buildingMedian)}` : "no building median"}
            </NumberLabel>
          }
        />
      </div>

      <p className="text-[15px] text-stone-700 mt-5 leading-relaxed max-w-3xl">
        {filed == null ? (
          <>Review Board data is unavailable right now, so past complaints for this unit couldn&apos;t be checked.</>
        ) : filed === 0 ? (
          <>
            <strong className="text-ink">No complaint has been filed for this unit since {REVIEW_BOARD_SINCE}.</strong>{" "}
            Many owners never check.
          </>
        ) : (
          <>
            <strong className="text-ink">
              {filed} complaint{filed === 1 ? "" : "s"} filed for this unit since {REVIEW_BOARD_SINCE}
            </strong>{" "}
            ({unit.complaints!.map((y) => y.year).join(", ")}).
          </>
        )}
      </p>
      <p className="text-[12px] text-stone-500 mt-3 max-w-3xl leading-relaxed">
        A bigger or better-placed unit is worth more than the median, so a gap on its own isn&apos;t a sign of
        over-assessment. The tax is an estimate from the residential rate; your notice is the final word.
      </p>
    </section>
  );
}
