import type { Delta } from "@/lib/deltas";
import Reveal from "./Reveal";

export interface RecordRow {
  label: string;
  before: string | null;
  after: string;
  isNew: boolean;
}

/**
 * Build the landing's building-record rows from two reviews of the same
 * building: reserve funding first, then the deterministic deltas (the
 * reserve balance row is dropped — the funded % already says it).
 */
export function recordRows(
  funded: [number | null, number | null],
  deltas: Delta[],
  max = 5
): RecordRow[] {
  const rows: RecordRow[] = [];
  if (funded[0] != null && funded[1] != null) {
    rows.push({
      label: "Reserve funded",
      before: `${Math.round(funded[0])}%`,
      after: `${Math.round(funded[1])}%`,
      isNew: false,
    });
  }
  const cap = (t: string) => t.replace(/^\w/, (c) => c.toUpperCase());
  for (const d of deltas) {
    if (d.label === "Reserve fund balance") continue;
    let label = d.label.replace(/^New /, "").replace(/ mention$/, "").replace(/ update$/, "");
    let detail = d.detail.replace(/\.$/, "");
    // "parkade membrane replacement: was discussed (…) → now levied (…)"
    // reads better with the subject as the row label.
    const subject = /^([^:$→]{3,60}): (.+)$/.exec(detail);
    if (subject && detail.includes(" → ")) {
      label = cap(subject[1]);
      detail = subject[2];
    }
    const [before, after] = detail.split(" → ");
    rows.push(
      after != null && d.kind !== "new"
        ? { label: cap(label), before: cap(before.replace(/^was /, "").trim()), after: cap(after.replace(/^now /, "").trim()), isNew: false }
        : { label: cap(label), before: null, after: cap(detail), isNew: true }
    );
  }
  return rows.slice(0, max);
}

/**
 * One building's record across two reviews: what each fact was, what it
 * is now, and when it changed. Superseded facts are struck through and
 * dated (end-dated, not overwritten), which is how the record reads.
 */
export default function MemoryRecord({
  buildingName,
  buildingMeta,
  fromLabel,
  toLabel,
  rows,
}: {
  buildingName: string;
  buildingMeta: string;
  fromLabel: string;
  toLabel: string;
  rows: RecordRow[];
}) {
  return (
    <Reveal className="memory-record">
      <div className="rounded-xl border border-line bg-white overflow-hidden shadow-[0_1px_2px_rgba(21,24,28,0.04),0_10px_30px_rgba(21,24,28,0.06)]">
        <div className="px-6 sm:px-8 py-5 border-b border-[#eceee9] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <div>
            <span className="font-semibold">{buildingName}</span>
            <span className="data-label text-subtle ml-3">{buildingMeta}</span>
          </div>
          <span className="text-[13px] text-subtle">Building record · 2 reviews</span>
        </div>

        <div className="hidden sm:grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] gap-6 px-8 pt-5 pb-2 data-label text-subtle">
          <span />
          <span>{fromLabel} review</span>
          <span>{toLabel} review</span>
        </div>

        <ul>
          {rows.map((r, i) => (
            <li
              key={r.label}
              className="record-row grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-6 gap-y-1 px-6 sm:px-8 py-4 border-t border-[#eceee9] first:border-t-0 sm:first:border-t"
              style={{ transitionDelay: `${300 + i * 140}ms` }}
            >
              <span className="text-[15px] font-medium">{r.label}</span>
              <span className="text-[15px] text-subtle">
                {r.before ? (
                  <>
                    <span className="record-old" style={{ transitionDelay: `${900 + i * 140}ms` }}>
                      {r.before}
                    </span>
                    <span className="block text-xs mt-0.5">until {toLabel}</span>
                  </>
                ) : (
                  <span>Not on record</span>
                )}
              </span>
              <span className="text-[15px] font-semibold">
                <span className="sm:hidden block text-xs font-normal text-subtle">{toLabel}</span>
                {r.after}
                {r.isNew && (
                  <span className="ml-2 align-middle rounded-md bg-signal-soft text-signal-dark text-xs font-semibold px-1.5 py-0.5">
                    New
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}
