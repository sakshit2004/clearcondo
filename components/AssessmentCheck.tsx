import type { ReactNode } from "react";
import type { AppealsSection } from "@/lib/calgary/appeals";
import { CALGARY_RES_TAX_RATE_2026, REVIEW_BOARD_SINCE, annualTax, taxSaving } from "@/lib/calgary/appeals";
import { cad } from "@/lib/format";

type Label = "Fact" | "Calculation" | "Estimate";

const LABEL_STYLES: Record<Label, string> = {
  Fact: "bg-accent-soft text-accent-dark",
  Calculation: "bg-info-soft text-info-dark",
  Estimate: "bg-warn-soft text-warn-dark",
};

/** Every number says what kind of number it is. */
function NumberLabel({ kind, children }: { kind: Label; children?: ReactNode }) {
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

/** The bylaw rate, unrounded: 0.0066499 -> "0.66499%". */
const ratePct = (n: number) => `${Number((n * 100).toFixed(5))}%`;

function Reading({ appeals }: { appeals: AppealsSection }) {
  const v = appeals.reading_year;
  if (appeals.reading === "group_lowered" && v) {
    return (
      <>
        <strong className="text-ink">Owners here have appealed together, and most were lowered.</strong> In {v.year},{" "}
        {v.filed} units complained and {v.lowered} were lowered. That may reflect assessments that ran high then; it
        doesn&apos;t tell you this year&apos;s values are wrong.
      </>
    );
  }
  if (appeals.reading === "group_not_lowered" && v) {
    return (
      <>
        <strong className="text-ink">Owners here have appealed together before, without most being lowered.</strong> In{" "}
        {v.year}, {v.filed} units complained and {v.lowered} were lowered.
      </>
    );
  }
  if (appeals.filed_total === 0) {
    return (
      <>
        <strong className="text-ink">No unit here has appealed its assessment since {REVIEW_BOARD_SINCE}.</strong> That
        doesn&apos;t mean the assessments are right: open data can&apos;t see unit size, condition or sales.
      </>
    );
  }
  return (
    <>
      <strong className="text-ink">
        {appeals.filed_total} unit appeal{appeals.filed_total === 1 ? "" : "s"} since {REVIEW_BOARD_SINCE}, {appeals.lowered_total}{" "}
        lowered.
      </strong>{" "}
      Past results don&apos;t tell you whether this year&apos;s values are high: that depends on unit size, condition and
      sales the City doesn&apos;t publish.
    </>
  );
}

/**
 * Property tax & appeals (preview): what the building's assessments mean
 * in tax, and its Assessment Review Board history. Facts and plain
 * calculations by default; the group-filing reading and the savings
 * estimate appear only when their private parameters are configured.
 */
export default function AssessmentCheck({
  appeals,
  currentMedian,
  units,
  rollYear,
}: {
  appeals: AppealsSection | { status: "unavailable"; message: string } | undefined;
  currentMedian: number | null;
  units: number;
  rollYear: number | null;
}) {
  const year = rollYear ?? 2026;
  const ok = appeals?.status === "ok" ? appeals : null;
  const cut = ok?.typical_cut ?? null;

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <h3 className="font-bold text-lg text-ink">Property tax &amp; appeals</h3>
        <span className="rounded-md bg-ink text-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
          Preview
        </span>
      </div>
      <p className="text-[13px] text-stone-500 mb-4 max-w-3xl">
        Buying is the first bill; property tax is every year after. What this building&apos;s {year} assessments mean in
        tax, and whether owners have challenged them.
      </p>

      <div className={`grid grid-cols-1 gap-3 ${cut != null ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <Stat
          value={currentMedian != null ? `${cad(annualTax(currentMedian))}/yr` : "—"}
          label="Est. property tax, median unit"
          note={
            <NumberLabel kind="Calculation">
              {currentMedian != null
                ? `${cad(currentMedian)} × ${ratePct(CALGARY_RES_TAX_RATE_2026)} (${year} Calgary residential rate)`
                : "no current values"}
            </NumberLabel>
          }
        />
        <Stat
          value={ok ? `${ok.lowered_total} of ${ok.filed_total}` : "—"}
          label={`Unit appeals lowered since ${REVIEW_BOARD_SINCE}`}
          note={<NumberLabel kind="Fact">Assessment Review Board, matched by unit address</NumberLabel>}
        />
        {cut != null && currentMedian != null && (
          <Stat
            value={`${cad(taxSaving(currentMedian, cut))}/yr`}
            label={`If a median unit's assessment came down ${Math.round(cut * 100)}%`}
            note={<NumberLabel kind="Estimate">assumes a {Math.round(cut * 100)}% cut, one tax year, {units} units</NumberLabel>}
          />
        )}
      </div>

      <p className="text-[15px] text-stone-700 mt-4 leading-relaxed max-w-3xl">
        {ok ? <Reading appeals={ok} /> : <>Review Board data is unavailable right now, so past appeals couldn&apos;t be checked.</>}
      </p>

      {ok && ok.history.length > 0 && (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm min-w-[420px] max-w-xl">
            <thead>
              <tr className="border-t-2 border-ink text-left">
                <th className="micro-label py-2 pr-4 font-semibold">Year</th>
                <th className="micro-label py-2 pr-4 font-semibold text-right">Units that appealed</th>
                <th className="micro-label py-2 pr-4 font-semibold text-right">Lowered</th>
                <th className="micro-label py-2 font-semibold text-right">Not lowered</th>
              </tr>
            </thead>
            <tbody>
              {ok.history.slice(0, 6).map((y) => (
                <tr key={y.year} className="border-t border-stone-200 tabular-nums">
                  <td className="py-2 pr-4 font-semibold text-ink">{y.year}</td>
                  <td className="py-2 pr-4 text-right text-stone-700">{y.filed}</td>
                  <td className="py-2 pr-4 text-right text-stone-700">{y.lowered}</td>
                  <td className="py-2 text-right text-stone-700">{y.not_lowered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[12px] text-stone-500 mt-3 max-w-3xl leading-relaxed">
        &ldquo;Lowered&rdquo; means settled with the City or decreased by the Board; &ldquo;not lowered&rdquo; includes
        withdrawn. Parking stalls are excluded. This is not an appraisal: open data has no unit size, finishes, condition
        or sales.
        {ok && (
          <>
            {" "}
            Source:{" "}
            <a href={ok.source_url} target="_blank" rel="noopener noreferrer" className="underline">
              Assessment Review Board complaints
            </a>
            , City of Calgary Open Data.
          </>
        )}
      </p>
    </div>
  );
}
