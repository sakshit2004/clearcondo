/**
 * Matched City permits as building-memory facts.
 *
 * These are a separate source type from document evidence: they come from a
 * public registry, not from the uploaded condo documents, and are never
 * mixed into flags, facts_snapshot or the verification audit. Each fact is
 * keyed by permit number so repeat fetches are idempotent.
 */
import { DATASET_TITLES, CALGARY_DATASETS } from "./socrata.ts";
import { PERMIT_CATEGORY_LABELS, type MajorPermit } from "./permits.ts";

export const PUBLIC_RECORD_SOURCE_TYPE = "public_record" as const;

export interface PublicRecordFact {
  source_type: typeof PUBLIC_RECORD_SOURCE_TYPE;
  /** Dataset id the fact came from. */
  dataset: string;
  source_name: string;
  source_url: string;
  /** Idempotency key within a building, e.g. "permit:BP2024-01234". */
  fact_key: string;
  categories: string[];
  /** Date the fact refers to (permit issued/applied), YYYY-MM-DD. */
  observed_on: string | null;
  declared_value_cad: number | null;
  /** One factual sentence; what Agent Memory is told. */
  text: string;
}

function cad(n: number): string {
  return n.toLocaleString("en-CA", { maximumFractionDigits: 0 });
}

export function permitToFact(permit: MajorPermit, plan: string): PublicRecordFact {
  const date = permit.issued_date ?? permit.applied_date;
  const cats = permit.categories.map((c) => PERMIT_CATEGORY_LABELS[c].toLowerCase()).join(", ");
  const parts = [
    `City of Calgary building permit ${permit.permit_number}`,
    date ? `${permit.issued_date ? "issued" : "applied for"} ${date}` : null,
    permit.address ? `at ${permit.address}` : null,
    `(condominium plan ${plan})`,
  ].filter(Boolean);
  const value = permit.declared_value_cad != null ? ` Declared project value: $${cad(permit.declared_value_cad)} CAD.` : "";
  return {
    source_type: PUBLIC_RECORD_SOURCE_TYPE,
    dataset: CALGARY_DATASETS.permits,
    source_name: `City of Calgary Open Data — ${DATASET_TITLES[CALGARY_DATASETS.permits]}`,
    source_url: permit.source_url,
    fact_key: `permit:${permit.permit_number}`,
    categories: permit.categories,
    observed_on: date,
    declared_value_cad: permit.declared_value_cad,
    text: `${parts.join(" ")}: ${permit.description.trim()}. Work category: ${cats}.${value}`,
  };
}
