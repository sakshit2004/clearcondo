/**
 * Sample-only data for the public sample reports (/demo, /demo/own), so they
 * show every section a real report has: the City of Calgary public-record
 * check, the shared building record, and the missing-documents list.
 *
 * Everything here is fictional and labelled as sample data on the page. The
 * sections are built with the same code real reports use (assessReport,
 * extractSharedFacts, checkAgainstRecord, findMissingDocs).
 */
import { assessReport, type CityRecords, type PublicRecordCheck } from "./calgary/check";
import { CALGARY_DATASETS, datasetPageUrl } from "./calgary/socrata";
import { findMissingDocs } from "./doc-checklist";
import {
  checkAgainstRecord,
  extractSharedFacts,
  type CheckItem,
  type SharedFact,
  type SharedFactRow,
  type SourceDoc,
} from "./shared-record";
import type { VerifiedAnalysis, VerifiedFactEvidence } from "./report-schema";

/** The sample package's document type, read from its demo filename. */
function docTypeOf(filename: string): string {
  if (/board-minutes/.test(filename)) return "minutes_board";
  if (/agm-minutes/.test(filename)) return "minutes_agm";
  if (/reserve-fund/.test(filename)) return "reserve_study";
  if (/information-statement/.test(filename)) return "info_statement";
  return "other";
}

/**
 * Stand-in page text for a sample package: every quote the report cites, on
 * its page, plus a summary page in the reserve fund plan carrying the
 * package's headline figures (the real PDFs aren't shipped with the app).
 */
function sampleDocs(r: VerifiedAnalysis, summary: string): (SourceDoc & { filename: string })[] {
  const f = r.structured_facts;
  const evidence: VerifiedFactEvidence[] = [
    ...r.flags.flatMap((x) => x.evidence as VerifiedFactEvidence[]),
    ...f.special_assessments.map((x) => x.evidence),
    ...f.litigation.map((x) => x.evidence),
    ...(f.rental_rules_evidence ? [f.rental_rules_evidence] : []),
  ];
  const docs = new Map<string, SourceDoc & { filename: string }>();
  for (const e of evidence) {
    const d = docs.get(e.file_id) ?? { fileId: e.file_id, filename: e.document_name, docType: docTypeOf(e.document_name), pages: [] };
    d.pages.push({ page: e.matched_page ?? e.page, text: e.quote });
    docs.set(e.file_id, d);
  }
  const plan = [...docs.values()].find((d) => d.docType === "reserve_study");
  if (plan) plan.pages.push({ page: 1, text: summary });
  return [...docs.values()];
}

const asRows = (facts: SharedFact[]): SharedFactRow[] => facts.map((f) => ({ ...f, seen_count: 1, first_seen: "" }));

/** A fact from a third, fictional earlier package that the latest one doesn't mention. */
const ELEVATOR: SharedFact = {
  fact_key: "special_assessment:elevator-modernization",
  kind: "money",
  label: "Special assessment: Elevator modernization (per unit)",
  value_num: 2100,
  value_text: "proposed",
  as_of: "2025-06",
  doc_type: "info_statement",
  page: 2,
  source: "document",
};

/** The latest sample package checked against the record the earlier ones built. */
export function sampleSharedRecord(older: VerifiedAnalysis, newer: VerifiedAnalysis): { items: CheckItem[]; rows: SharedFactRow[] } {
  const o = older.structured_facts;
  const n = newer.structured_facts;
  const before = [
    ...asRows(
      extractSharedFacts(
        older,
        sampleDocs(older, `Reserve fund balance $${o.reserve_balance_cad?.toLocaleString("en-CA")}. Recommended $${o.reserve_recommended_cad?.toLocaleString("en-CA")}. Deductible $${o.insurance_deductible_cad?.toLocaleString("en-CA")}. Contributions rise ${o.fee_change_pct}%.`)
      )
    ),
    ...asRows([ELEVATOR]),
  ];
  const latest = extractSharedFacts(
    newer,
    sampleDocs(newer, `Average contribution $${n.contribution_monthly_cad} per month, up ${n.fee_change_pct}%.`)
  );
  return { items: checkAgainstRecord(latest, before), rows: [...before, ...asRows(latest)] };
}

/** What a complete Alberta resale package has that the sample package doesn't. */
export function sampleMissingDocs(newer: VerifiedAnalysis) {
  const names = JSON.stringify(newer).match(/demo-[\w.-]+\.pdf/g) ?? [];
  return findMissingDocs([...new Set(names.map(docTypeOf))]).map(({ id, label, askFor }) => ({ id, label, askFor }));
}

/** A fictional City of Calgary record for the sample building, run through the real check. */
export function samplePublicRecordCheck(newer: VerifiedAnalysis): PublicRecordCheck {
  const permitsUrl = datasetPageUrl(CALGARY_DATASETS.permits);
  const records: CityRecords = {
    identity_key: "sample",
    fetched_at: "2026-10-20T00:00:00Z",
    status: "matched",
    plan: "0614321",
    method: "plan_number",
    roll_query_url: datasetPageUrl(CALGARY_DATASETS.currentRoll),
    roll_year: 2026,
    unit_count: 96,
    residential_unit_count: 84,
    building_addresses: ["1234 NORTH HILL TC NW"],
    comm_name: "SAMPLE COMMUNITY",
    year_of_construction: 2004,
    current_total: 28_140_000,
    current_median: 329_000,
    values: {
      status: "ok",
      history_url: datasetPageUrl(CALGARY_DATASETS.historicalRolls),
      basis: { comm_code: "SMP", comm_name: "SAMPLE COMMUNITY", use_field: "sub_property_use", use_code: "R402" },
      comparables: [
        { plan: "0512345", units: 72, median_current: 341_000, source_url: datasetPageUrl(CALGARY_DATASETS.currentRoll) },
        { plan: "0712345", units: 110, median_current: 318_500, source_url: datasetPageUrl(CALGARY_DATASETS.currentRoll) },
      ],
      trend: [
        [2022, 296_000, null, null],
        [2023, 301_500, 1.9, 2.4],
        [2024, 312_000, 5.4, 6.1],
        [2025, 322_000, 8.8, 9.9],
        [2026, 329_000, 11.1, 13.2],
      ].map(([year, med, b, c]) => ({
        year: year as number,
        building_median: med as number,
        building_total: (med as number) * 84,
        building_units: 84,
        building_change_pct: b as number | null,
        comparables_change_pct: c as number | null,
        comparables_count: 2,
      })),
    },
    permits: {
      status: "ok",
      since: "2021-10-20",
      query_url: permitsUrl,
      items: [
        {
          permit_number: "BP2026-0000",
          address: "1234 NORTH HILL TC NW",
          issued_date: "2026-05-14",
          applied_date: "2026-04-30",
          status: "Issued",
          description: "Parkade membrane replacement (sample)",
          work_class: "Improvement",
          declared_value_cad: 690_000,
          categories: ["parkade"],
          source_url: permitsUrl,
        },
        {
          permit_number: "BP2023-0000",
          address: "1234 NORTH HILL TC NW",
          issued_date: "2023-08-02",
          applied_date: "2023-07-11",
          status: "Completed",
          description: "Re-roof, main building (sample)",
          work_class: "Improvement",
          declared_value_cad: 410_000,
          categories: ["roof"],
          source_url: permitsUrl,
        },
      ],
    },
    appeals: {
      status: "ok",
      history: [
        { year: 2024, filed: 3, settled_or_decreased: 2, other: 1 },
        { year: 2025, filed: 1, settled_or_decreased: 0, other: 1 },
      ],
      filed_total: 4,
      settled_or_decreased_total: 2,
      source_url: datasetPageUrl(CALGARY_DATASETS.reviewBoard),
    },
  };
  const docs = sampleDocs(newer, "Parkade membrane replacement scheduled for 2026, funded by special assessment.").map((d) => ({ filename: d.filename, docType: d.docType, pages: d.pages }));
  return assessReport(records, {
    docPlans: newer.building.corp_number ? [newer.building.corp_number] : [],
    docAddress: newer.building.address,
    docUnits: newer.building.units,
    docs,
  });
}
