import Link from "next/link";
import { withDb, getSharedCheck, getSharedRecord } from "@/lib/db";
import {
  buildTimelines,
  formatAsOf,
  formatValue,
  sharedBuildingKey,
  type CheckItem,
  type FactTimeline,
  type SharedFactRow,
} from "@/lib/shared-record";

/**
 * The shared building record on screen: this package checked against what
 * earlier packages (any user's) established, and the building's dated
 * history. Server components; render nothing when there's nothing to show.
 */

const DOC_LABELS: Record<string, string> = {
  reserve_study: "Reserve fund study",
  bylaws: "Bylaws",
  minutes_board: "Board minutes",
  minutes_agm: "AGM minutes",
  info_statement: "Information statement",
  financials: "Financial statements",
  budget: "Budget",
  insurance: "Insurance certificate",
  other: "Condo document",
};

const STATUS: Record<CheckItem["status"], { label: string; cls: string }> = {
  conflict: { label: "Doesn't match", cls: "bg-signal-soft text-signal-dark" },
  not_mentioned: { label: "Not in this package", cls: "bg-warn-soft text-warn-dark" },
  older: { label: "Older than the record", cls: "bg-warn-soft text-warn-dark" },
  changed: { label: "Changed", cls: "bg-warn-soft text-warn-dark" },
  corroborated: { label: "Matches", cls: "bg-accent-soft text-accent-dark" },
  unchanged: { label: "Unchanged", cls: "bg-accent-soft text-accent-dark" },
  new: { label: "First on record", cls: "bg-info-soft text-info-dark" },
};
const STATUS_ORDER: CheckItem["status"][] = ["conflict", "not_mentioned", "older", "changed", "corroborated", "unchanged", "new"];

function uploads(n: number) {
  return n === 1 ? "1 earlier upload" : `${n} earlier uploads`;
}

function checkDetail(c: CheckItem): string {
  const r = c.record;
  const v = formatValue(c);
  if (!r) return `${v}. Nobody had added this to the building's record before.`;
  const rv = formatValue({ kind: c.kind, value_num: r.value_num, value_text: r.value_text });
  switch (c.status) {
    case "corroborated":
      return `${v}, the same figure for the same date in ${uploads(r.seen_count)}.`;
    case "unchanged":
      return `${v}, the same as the record had for ${formatAsOf(r.as_of)}.`;
    case "changed":
      return `${v} now; the record had ${rv} as of ${formatAsOf(r.as_of)}.`;
    case "older":
      return `${v} here, but the record has a newer figure: ${rv} as of ${formatAsOf(r.as_of)}. Ask for the current documents.`;
    case "conflict":
      return `${v} here, but ${uploads(r.seen_count)} dated ${formatAsOf(r.as_of)} said ${rv}. Check both documents.`;
    case "not_mentioned":
      return `A package dated ${formatAsOf(r.as_of)} reported it${rv ? ` (${rv})` : ""}. These documents don't mention it: ask whether it's resolved.`;
    default:
      return v;
  }
}

function source(r: SharedFactRow): string {
  if (r.source === "public_record") return "City of Calgary open data";
  const doc = r.doc_type ? (DOC_LABELS[r.doc_type] ?? "Condo document") : "Condo document";
  return r.page ? `${doc}, p. ${r.page}` : doc;
}

function Timeline({ timelines }: { timelines: FactTimeline[] }) {
  return (
    <ul className="divide-y divide-stone-200">
      {timelines.map((t) => (
        <li key={t.fact_key} className="py-3.5 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="font-semibold text-ink">{t.label}</span>
            <span className="tabular-nums text-ink">
              {t.current.map((r) => formatValue(r)).join(" / ")}
              <span className="text-subtle text-sm"> · {formatAsOf(t.current[0].as_of)}</span>
            </span>
          </div>
          <p className="data-label text-stone-400 mt-1">
            {source(t.current[0])} ✓ verified
            {t.current[0].source === "document" && t.current[0].seen_count > 1 ? ` · seen in ${t.current[0].seen_count} uploads` : ""}
            {t.current.length > 1 ? " · uploads disagree for this date" : ""}
          </p>
          {t.history.length > 0 && (
            <p className="text-sm text-muted mt-1.5">
              Earlier:{" "}
              {t.history
                .slice(0, 4)
                .map((r) => `${formatValue(r)} (${formatAsOf(r.as_of)})`)
                .join(" · ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

const ABOUT =
  "Verified facts from document packages ClearCondo users uploaded for this building, each with its document date and page. Documents, quotes and who uploaded them are never shared.";

/** On a report: this package against the shared record, then the record itself. */
export function SharedRecordSection({ items, rows }: { items: CheckItem[] | null; rows: SharedFactRow[] }) {
  const checked = (items ?? []).filter((c) => c.status !== "new").sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  const timelines = buildTimelines(rows);
  if (checked.length === 0 && timelines.length === 0) return null;
  const firstOnRecord = (items ?? []).length > 0 && checked.length === 0;
  return (
    <section className="report-paper p-6 sm:p-8">
      <div className="micro-label text-stone-400 mb-2">Shared building record</div>
      <h2 className="font-bold text-2xl tracking-tight text-ink mb-1.5">
        {checked.length > 0 ? "Checked against earlier packages" : "What this building's record holds"}
      </h2>
      <p className="text-sm text-stone-500 mb-6 max-w-2xl">
        {firstOnRecord ? "This package is the first for this building, so there was nothing earlier to check it against. " : ""}
        {ABOUT}
      </p>
      {checked.length > 0 && (
        <div className="space-y-4 mb-8">
          {checked.map((c) => (
            <div key={`${c.status}-${c.fact_key}`} className="border-b border-stone-200 pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span>
                <span className="font-bold text-ink">{c.label}</span>
              </div>
              <p className="text-stone-700 text-[15px] leading-relaxed">{checkDetail(c)}</p>
            </div>
          ))}
        </div>
      )}
      {timelines.length > 0 && (
        <>
          <h3 className="micro-label text-stone-500 mb-3">The record now</h3>
          <Timeline timelines={timelines} />
        </>
      )}
    </section>
  );
}

/** Report page loader: the stored check plus the live record. Never throws. */
export async function ReportSharedRecord({ userId, reportId }: { userId: string; reportId: string }) {
  const data = await withDb(async (db) => {
    const check = await getSharedCheck(db, userId, reportId);
    if (!check) return null;
    const key = sharedBuildingKey(check.building);
    const record = key ? await getSharedRecord(db, key) : null;
    return { items: check.items, rows: record?.facts ?? [] };
  }).catch(() => null);
  if (!data) return null;
  return <SharedRecordSection items={data.items} rows={data.rows} />;
}

/** On the owner unit page: the building's dated money history, and a way to add to it. */
export function OwnerBuildingRecord({ rows }: { rows: SharedFactRow[] }) {
  const timelines = buildTimelines(rows);
  const fromDocs = timelines.filter((t) => t.current[0].source === "document");
  return (
    <section className="report-paper rounded-2xl p-6 sm:p-8" aria-labelledby="building-record">
      <div className="micro-label text-stone-400 mb-2">Shared building record</div>
      <h2 id="building-record" className="text-lg font-bold">Your building&apos;s money, over time</h2>
      <p className="text-sm text-subtle mt-1 mb-5 max-w-2xl">
        {fromDocs.length > 0
          ? ABOUT
          : "Nobody has added this building's documents yet. Reserve fund, fees, special assessments and lawsuits appear here, dated, as packages are checked."}
      </p>
      {timelines.length > 0 && <Timeline timelines={timelines} />}
      <div className="mt-5 pt-5 border-t border-line flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app/new" className="btn-lift inline-flex items-center rounded-lg bg-ink hover:bg-accent text-white font-semibold text-[15px] px-5 min-h-[44px]">
          Check this year&apos;s documents
        </Link>
        <span className="text-sm text-subtle">AGM package, budget or reserve study: each one adds to the record.</span>
      </div>
    </section>
  );
}
