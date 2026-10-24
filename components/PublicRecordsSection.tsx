import type { ReactNode } from "react";
import type { CheckStatus, PublicRecordCheck, PermitWithMention } from "@/lib/calgary/check";
import { PERMIT_CATEGORY_LABELS } from "@/lib/calgary/permits";
import { CALGARY_DATASETS, DATASET_TITLES, datasetPageUrl } from "@/lib/calgary/socrata";
import { cad, formatDate } from "@/lib/format";
import AssessmentCheck from "./AssessmentCheck";

export const PUBLIC_RECORDS_LABEL = "Public records (City of Calgary).";
export const PUBLIC_RECORDS_SUBLABEL = "Context, not a verdict.";

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent-dark underline decoration-line2 underline-offset-2 hover:decoration-accent-dark break-words"
    >
      {children}
    </a>
  );
}

const STATUS_STYLES: Record<CheckStatus, string> = {
  match: "bg-accent-soft text-accent-dark",
  mismatch: "bg-warn-soft text-warn-dark",
  unknown: "bg-info-soft text-info-dark",
};
const STATUS_LABELS: Record<CheckStatus, string> = {
  match: "✓ Match",
  mismatch: "⚠ Mismatch",
  unknown: "Not stated in documents",
};

function StatusPill({ status }: { status: CheckStatus }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

const pctLabel = (n: number | null) =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

function Shell({ children, fetchedAt, lookup }: { children: ReactNode; fetchedAt?: string; lookup?: boolean }) {
  return (
    <section className="report-paper p-6 sm:p-8 break-inside-avoid-page" aria-labelledby="public-records-heading">
      <div className="micro-label text-stone-400 mb-2">Public record check</div>
      <h2 id="public-records-heading" className="font-bold text-2xl tracking-tight text-ink mb-1.5">
        {PUBLIC_RECORDS_LABEL}{" "}
        <span className="text-subtle font-semibold">{PUBLIC_RECORDS_SUBLABEL}</span>
      </h2>
      <p className="text-sm text-stone-500 mb-6 max-w-3xl">
        {lookup
          ? "What the City's open data says about this building, before any documents. "
          : "What the City's open data says about this building, set beside the uploaded documents. "}
        Every item links to the City record it came from.
        {fetchedAt && <> Retrieved {formatDate(fetchedAt)}; refreshed at most once a day.</>}
      </p>
      {children}
    </section>
  );
}

function MentionNote({ item, minutesLabel }: { item: PermitWithMention; minutesLabel: string }) {
  const m = item.mention;
  if (m.status === "mentioned") {
    const h = m.hits[0];
    return (
      <p className="text-[13px] text-stone-600 mt-1.5">
        ✓ The documents mention this kind of work — “{h.term}” in {h.filename}, p.{h.page}
        {m.hits.length > 1 && ` (+${m.hits.length - 1} more term${m.hits.length > 2 ? "s" : ""})`}.
      </p>
    );
  }
  if (m.status === "not_run") {
    return <p className="text-[13px] text-stone-500 mt-1.5">Documents not searched: {m.reason}</p>;
  }
  return (
    <div className="mt-2 rounded-[10px] bg-warn-soft px-3.5 py-2.5">
      <p className="text-[13px] font-semibold text-warn-dark">
        ⚠ {m.minutesSearched ? minutesLabel : "Not mentioned in uploaded documents (no minutes were uploaded)"}
      </p>
      <p className="text-[13px] text-stone-700 mt-1 leading-relaxed">
        Searched all {m.searchedDocs.length} uploaded document{m.searchedDocs.length === 1 ? "" : "s"} (
        {m.searchedDocs.join(", ")}) for: {m.searchedTerms.map((t) => `“${t}”`).join(", ")}. No match. The
        work may still have been discussed in minutes that weren&apos;t uploaded or in different words — worth
        asking about.
      </p>
    </div>
  );
}

/**
 * The public record check for a report. Pure presentation: the data comes
 * from lib/public-records-loader.ts. Assessment and permit data are shown
 * as context — wording says what something "may reflect", never what it
 * "means".
 */
export interface LookupMode {
  /** Where "add your documents" goes (upload flow, building pre-filled). */
  addDocsHref: string;
}

export default function PublicRecordsSection({
  check,
  lookup,
}: {
  check: PublicRecordCheck;
  /** Set on the public building page: no documents yet. */
  lookup?: LookupMode;
}) {
  const { records } = check;
  const isLookup = Boolean(lookup);

  if (records.status === "unavailable") {
    return (
      <Shell lookup={isLookup}>
        <p className="font-semibold text-ink">City data unavailable</p>
        <p className="text-sm text-stone-600 mt-1">
          The City of Calgary open-data service didn&apos;t answer in time, so this check was skipped. It
          will be retried the next time this {isLookup ? "page" : "report"} is opened.
          {!isLookup && " Nothing else in the report depends on it."}
        </p>
      </Shell>
    );
  }

  if (records.status === "no_match") {
    return (
      <Shell fetchedAt={records.fetched_at} lookup={isLookup}>
        <p className="font-semibold text-ink">Couldn&apos;t match this building to City records</p>
        <p className="text-sm text-stone-600 mt-1">
          {records.reason} We only show City records when the match is unambiguous, so nothing is shown
          rather than a guess.
        </p>
        {records.tried.length > 0 && (
          <p className="text-[13px] text-stone-500 mt-2">
            Looked up: {records.tried.join("; ")} in the{" "}
            <SourceLink href={datasetPageUrl(CALGARY_DATASETS.currentRoll)}>
              {DATASET_TITLES[CALGARY_DATASETS.currentRoll]}
            </SourceLink>{" "}
            dataset.
          </p>
        )}
      </Shell>
    );
  }

  const id = check.identity!;
  const { values, permits } = records;
  const minutesLabel = "Not mentioned in uploaded minutes";

  return (
    <Shell fetchedAt={records.fetched_at} lookup={isLookup}>
      {lookup ? (
        /* a. Building facts — no documents to compare against yet */
        <div className="mb-8">
          <h3 className="font-bold text-lg text-ink mb-3">Building facts</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            {[
              ["Condo plan", records.plan],
              ["Units on the roll", `${records.unit_count}${records.residential_unit_count !== records.unit_count ? ` (${records.residential_unit_count} residential)` : ""}`],
              ["Address", records.building_addresses.join("; ") || "—"],
              ["Community", records.comm_name ?? "—"],
              ["Year built", records.year_of_construction ? String(records.year_of_construction) : "—"],
              ["Assessment roll", records.roll_year ? String(records.roll_year) : "Current"],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="micro-label text-stone-400">{k}</dt>
                <dd className="text-ink font-semibold mt-0.5 break-words">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[13px] text-stone-500 mt-3">
            Source:{" "}
            <SourceLink href={records.roll_query_url}>
              {records.unit_count} assessment-roll unit{records.unit_count === 1 ? "" : "s"} on condo plan {records.plan}
            </SourceLink>
            .
          </p>
        </div>
      ) : (
      <>
      {/* a. Identity check */}
      <h3 className="font-bold text-lg text-ink mb-1">Identity check</h3>
      <p className="text-[13px] text-stone-500 mb-3">
        Matched by {records.method === "plan_number" ? "condo plan number" : "street address"} to{" "}
        <SourceLink href={records.roll_query_url}>
          {records.unit_count} assessment-roll unit{records.unit_count === 1 ? "" : "s"} on condo plan {records.plan}
        </SourceLink>
        {records.comm_name ? ` in ${records.comm_name}` : ""}
        {records.roll_year ? ` (${records.roll_year} roll)` : ""}.
      </p>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="border-t-2 border-ink text-left">
              <th className="micro-label py-2.5 pr-4 font-semibold">Item</th>
              <th className="micro-label py-2.5 pr-4 font-semibold">Documents</th>
              <th className="micro-label py-2.5 pr-4 font-semibold">City roll</th>
              <th className="micro-label py-2.5 font-semibold">Result</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-stone-200 align-top">
              <td className="py-3 pr-4 font-semibold text-ink">Condo plan</td>
              <td className="py-3 pr-4 text-stone-700">{id.plan.docs.join(", ") || "—"}</td>
              <td className="py-3 pr-4 text-stone-700">{id.plan.roll}</td>
              <td className="py-3"><StatusPill status={id.plan.status} /></td>
            </tr>
            <tr className="border-t border-stone-200 align-top">
              <td className="py-3 pr-4 font-semibold text-ink">Units</td>
              <td className="py-3 pr-4 text-stone-700 tabular-nums">{id.units.docs ?? "—"}</td>
              <td className="py-3 pr-4 text-stone-700 tabular-nums">
                {id.units.roll}
                {id.units.roll_residential !== id.units.roll && (
                  <span className="block text-[12px] text-stone-500">{id.units.roll_residential} residential</span>
                )}
              </td>
              <td className="py-3"><StatusPill status={id.units.status} /></td>
            </tr>
            <tr className="border-t border-stone-200 align-top">
              <td className="py-3 pr-4 font-semibold text-ink">Address</td>
              <td className="py-3 pr-4 text-stone-700">{id.address.docs ?? "—"}</td>
              <td className="py-3 pr-4 text-stone-700">{id.address.roll.join("; ") || "—"}</td>
              <td className="py-3"><StatusPill status={id.address.status} /></td>
            </tr>
          </tbody>
        </table>
        {id.units.status === "mismatch" && (
          <p className="text-[13px] text-stone-500 mt-2">
            A unit-count difference may reflect titled parking stalls or storage units the City assesses
            separately, or units merged or split since the documents were written.
          </p>
        )}
      </div>
      </>
      )}

      <AssessmentCheck
        appeals={records.appeals}
        currentMedian={records.current_median ?? null}
        units={records.unit_count}
        rollYear={records.roll_year}
      />

      {/* b. Value trend */}
      <h3 className="font-bold text-lg text-ink mb-1">Assessed value over time</h3>
      {values.status === "unavailable" ? (
        <p className="text-sm text-stone-600 mb-8">City data unavailable for assessment history right now.</p>
      ) : values.trend.length === 0 ? (
        <p className="text-sm text-stone-600 mb-8">No assessment history was found for these units.</p>
      ) : (
        <div className="mb-8">
          <p className="text-[13px] text-stone-500 mb-3">
            Building total and median unit assessment by roll year, from the{" "}
            <SourceLink href={values.history_url}>{DATASET_TITLES[CALGARY_DATASETS.historicalRolls]}</SourceLink>
            {" "}and current roll.
            {values.basis && (
              <>
                {" "}Similar buildings: condo plans with the same property-use code ({values.basis.use_code}) in{" "}
                {values.basis.comm_name ?? values.basis.comm_code}, closest unit count first.
              </>
            )}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-t-2 border-ink text-left">
                  <th className="micro-label py-2.5 pr-4 font-semibold">Year</th>
                  <th className="micro-label py-2.5 pr-4 font-semibold text-right">Units</th>
                  <th className="micro-label py-2.5 pr-4 font-semibold text-right">Total</th>
                  <th className="micro-label py-2.5 pr-4 font-semibold text-right">Median unit</th>
                  <th className="micro-label py-2.5 pr-4 font-semibold text-right">This building since {values.trend[0].year}</th>
                  <th className="micro-label py-2.5 font-semibold text-right">Similar buildings</th>
                </tr>
              </thead>
              <tbody>
                {values.trend.map((t) => (
                  <tr key={t.year} className="border-t border-stone-200 tabular-nums">
                    <td className="py-2.5 pr-4 font-semibold text-ink">{t.year}</td>
                    <td className="py-2.5 pr-4 text-right text-stone-700">{t.building_units}</td>
                    <td className="py-2.5 pr-4 text-right text-stone-700">{cad(t.building_total)}</td>
                    <td className="py-2.5 pr-4 text-right text-stone-700">{cad(t.building_median)}</td>
                    <td className="py-2.5 pr-4 text-right text-ink">{pctLabel(t.building_change_pct)}</td>
                    <td className="py-2.5 text-right text-stone-700">
                      {pctLabel(t.comparables_change_pct)}
                      {t.comparables_count > 0 && (
                        <span className="text-[11px] text-stone-400"> ({t.comparables_count})</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {values.comparables.length > 0 && (
            <p className="text-[13px] text-stone-500 mt-2">
              Compared with:{" "}
              {values.comparables.map((c, i) => (
                <span key={c.plan}>
                  {i > 0 && ", "}
                  <SourceLink href={c.source_url}>plan {c.plan}</SourceLink> ({c.units} units)
                </span>
              ))}
              .
            </p>
          )}
          {values.comparables_error && (
            <p className="text-[13px] text-stone-500 mt-2">Similar-building data was unavailable; showing this building only.</p>
          )}
          <p className="text-[13px] text-stone-600 mt-3 leading-relaxed">
            Context only. A gap between this building and similar ones may reflect differences in age,
            condition, renovations, sales in the building, or assessment appeals — the City&apos;s assessed
            value is not a sale price, and these numbers are not a judgement on the building.
          </p>
        </div>
      )}

      {/* c. Permits */}
      <h3 className="font-bold text-lg text-ink mb-1">Major building permits, last 5 years</h3>
      {permits.status === "unavailable" ? (
        <p className="text-sm text-stone-600">City data unavailable for building permits right now.</p>
      ) : (
        <>
          <p className="text-[13px] text-stone-500 mb-3">
            Roof, envelope, parkade, balcony and structural permits at{" "}
            {records.building_addresses.join("; ") || "the building"} since {permits.since}, from{" "}
            <SourceLink href={permits.query_url}>{DATASET_TITLES[CALGARY_DATASETS.permits]}</SourceLink>.
          </p>
          {check.permits.length === 0 ? (
            <p className="text-sm text-stone-600">No major permits found in that window.</p>
          ) : (
            <ul className="space-y-4">
              {check.permits.map((item) => {
                const p = item.permit;
                return (
                  <li key={p.permit_number} className="border-t border-stone-200 pt-4 first:border-0 first:pt-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="data-label text-stone-500">{p.issued_date ?? p.applied_date ?? "date not stated"}</span>
                      <SourceLink href={p.source_url}>{p.permit_number}</SourceLink>
                      {p.categories.map((c) => (
                        <span key={c} className="rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-muted">
                          {PERMIT_CATEGORY_LABELS[c]}
                        </span>
                      ))}
                      {p.declared_value_cad != null && (
                        <span className="text-sm font-semibold text-ink tabular-nums">
                          {cad(p.declared_value_cad)} declared
                        </span>
                      )}
                    </div>
                    <p className="text-[15px] text-stone-700 mt-1 leading-relaxed">{p.description}</p>
                    {!p.issued_date && <p className="text-[12px] text-stone-500">Applied for; not shown as issued.</p>}
                    {!isLookup && <MentionNote item={item} minutesLabel={minutesLabel} />}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      {lookup && (
        <div className="mt-8 rounded-[14px] bg-ink text-white p-6">
          <h3 className="text-lg font-bold">Have this building&apos;s documents?</h3>
          <p className="text-sm text-[#c3cad4] mt-1.5 mb-4 max-w-2xl">
            Add the minutes, reserve fund study and bylaws for the full red-flag report: special
            assessments, reserve health and litigation, every claim checked against its page, and a
            check of whether each permit above was disclosed in the minutes. Condo documents aren&apos;t
            public, so they come from the seller or property manager.
          </p>
          <a
            href={lookup.addDocsHref}
            className="btn-lift inline-flex items-center justify-center rounded-lg bg-white text-ink font-semibold text-[15px] px-5 min-h-11"
          >
            Add documents for the full report
          </a>
        </div>
      )}
    </Shell>
  );
}
