/**
 * The shared building record: one record per condo building, built from
 * every user's verified facts. Each new package is checked against it, and
 * a first-time buyer sees what earlier packages from the same building said.
 *
 * Only verified facts are shared: a fact quoted from a page and matched to
 * that page, or a figure found printed on a page of the uploaded documents.
 * Each carries its document date, document type and page. Never shared:
 * the documents, their text or filenames, quotes, or who uploaded them.
 * Facts stay in the record after the report that added them is deleted
 * (they're about the building, and carry no link to the person).
 *
 * Pure functions only; storage lives in lib/db.ts.
 */
import { normalizePlanNumber } from "./calgary/match.ts";
import { redactText } from "./redact.ts";
import type { PageText } from "./extract";
import type { BuildingFacts, VerifiedStructuredFacts } from "./report-schema";

export type SharedSource = "document" | "public_record";
export type SharedKind = "money" | "percent" | "text";

export interface SharedFact {
  /** Stable key per fact: "reserve_balance", "special_assessment:roof-replacement"… */
  fact_key: string;
  kind: SharedKind;
  label: string;
  value_num: number | null;
  value_text: string | null;
  /** The package's document date, "YYYY-MM" or "YYYY-MM-DD". */
  as_of: string;
  doc_type: string | null;
  page: number | null;
  source: SharedSource;
}

/** A stored fact: how many uploads stated it, and when it was first seen. */
export interface SharedFactRow extends SharedFact {
  seen_count: number;
  first_seen: string;
}

export interface SharedIdentity {
  key: string;
  name: string | null;
  corp_number: string | null;
  address: string | null;
  plan: string | null;
  units: number | null;
  year_built: number | null;
}

/** Documents the facts were extracted from (page text stays server-side). */
export interface SourceDoc {
  fileId: string;
  docType: string;
  pages: PageText[];
}

const ident = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Building identity shared across users. The condo plan / corporation
 * number when the documents state one (in Alberta the corporation number is
 * the plan number, which is how the owner side finds a building too);
 * otherwise name AND address. A building with neither isn't shared: a bare
 * name ("Park Place") would merge different buildings.
 */
export function sharedBuildingKey(building: Pick<BuildingFacts, "corp_number" | "name" | "address">, nameHint?: string | null): string | null {
  const plan = normalizePlanNumber(building.corp_number);
  if (plan) return `plan:${plan}`;
  const name = ident(building.name || nameHint);
  const addr = ident(building.address);
  return name && addr ? `name:${name}::${addr}` : null;
}

export function sharedIdentity(building: BuildingFacts, nameHint?: string | null): SharedIdentity | null {
  const key = sharedBuildingKey(building, nameHint);
  if (!key) return null;
  return {
    key,
    name: building.name || nameHint || null,
    corp_number: building.corp_number,
    address: building.address,
    plan: normalizePlanNumber(building.corp_number),
    units: building.units,
    year_built: building.year_built,
  };
}

/** Plan-keyed identity for the owner side, which knows the plan from the City roll. */
export function planIdentity(plan: string, address: string | null, yearBuilt: number | null): SharedIdentity {
  return { key: `plan:${plan}`, name: null, corp_number: plan, address, plan, units: null, year_built: yearBuilt };
}

/* ------------------------------------------------------------------ */
/* Verifying figures against the page                                  */
/* ------------------------------------------------------------------ */

/** Below this, a figure is too common ("12", "50") to prove anything by appearing on a page. */
const MIN_LOCATABLE_MONEY = 100;

function moneyPattern(value: number): RegExp | null {
  const abs = Math.abs(value);
  if (!Number.isFinite(abs) || abs < MIN_LOCATABLE_MONEY) return null;
  const cents = Math.round(abs * 100) % 100;
  const whole = Math.floor(Math.round(abs * 100) / 100).toString();
  // "412000" -> "412,?000": with or without thousands separators.
  const groups: string[] = [];
  for (let i = whole.length; i > 0; i -= 3) groups.unshift(whole.slice(Math.max(0, i - 3), i));
  const body = groups.join("[,\\s]?");
  const tail = cents ? `\\.${String(cents).padStart(2, "0")}` : "(?:\\.00)?";
  return new RegExp(`(?<![\\d.,])${body}${tail}(?![\\d]|[.,]\\d)`);
}

function percentPattern(value: number): RegExp | null {
  if (!Number.isFinite(value) || value === 0) return null;
  const n = Math.abs(value);
  const s = Number.isInteger(n) ? `${n}(?:\\.0+)?` : String(n).replace(".", "\\.");
  return new RegExp(`(?<![\\d.])${s}\\s?(?:%|per\\s?cent)`, "i");
}

/** The first page a figure is printed on, or null when it appears nowhere. */
export function locateFigure(value: number, kind: "money" | "percent", docs: SourceDoc[]): { docType: string; page: number } | null {
  const re = kind === "money" ? moneyPattern(value) : percentPattern(value);
  if (!re) return null;
  for (const d of docs) {
    for (const p of d.pages) {
      if (re.test(p.text)) return { docType: d.docType, page: p.page };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Facts from one verified analysis                                    */
/* ------------------------------------------------------------------ */

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const SCALARS: { field: keyof VerifiedStructuredFacts; key: string; label: string; kind: "money" | "percent" }[] = [
  { field: "reserve_balance_cad", key: "reserve_balance", label: "Reserve fund balance", kind: "money" },
  { field: "reserve_recommended_cad", key: "reserve_recommended", label: "Reserve fund the study recommends", kind: "money" },
  { field: "contribution_monthly_cad", key: "contribution_monthly", label: "Average monthly condo fee", kind: "money" },
  { field: "insurance_deductible_cad", key: "insurance_deductible", label: "Insurance deductible", kind: "money" },
  { field: "fee_change_pct", key: "fee_change", label: "Change in condo fees", kind: "percent" },
];

/** Display order of fact groups in the record. */
const ORDER = ["reserve_balance", "reserve_recommended", "contribution_monthly", "fee_change", "insurance_deductible", "special_assessment", "litigation", "rental_rules", "city_"];
const orderOf = (key: string) => {
  const i = ORDER.findIndex((p) => key === p || key.startsWith(p.endsWith("_") ? p : `${p}:`));
  return i === -1 ? ORDER.length : i;
};

/**
 * The shareable facts in one verified analysis. Undated packages give
 * nothing: without a date a fact can't be placed in the building's history.
 * Free text is redacted again (names of private individuals) and the
 * building's own identity is kept.
 */
export function extractSharedFacts(
  analysis: { building: BuildingFacts; structured_facts: VerifiedStructuredFacts },
  docs: SourceDoc[]
): SharedFact[] {
  const facts = analysis.structured_facts;
  const asOf = facts.doc_date;
  if (!asOf) return [];
  const keep = [analysis.building.name, analysis.building.address, analysis.building.corp_number].filter((s): s is string => Boolean(s));
  const R = (s: string) => redactText(s, keep).replace(/\s+/g, " ").trim();
  const docType = (fileId: string) => docs.find((d) => d.fileId === fileId)?.docType ?? null;
  const out: SharedFact[] = [];

  for (const s of SCALARS) {
    const v = facts[s.field];
    if (typeof v !== "number") continue;
    const at = locateFigure(v, s.kind, docs);
    if (!at) continue;
    out.push({ fact_key: s.key, kind: s.kind, label: s.label, value_num: v, value_text: null, as_of: asOf, doc_type: at.docType, page: at.page, source: "document" });
  }
  for (const sa of facts.special_assessments ?? []) {
    if (!sa.evidence?.verified) continue;
    const perUnit = sa.amount_per_unit_cad != null;
    const purpose = R(sa.purpose);
    if (!purpose) continue;
    out.push({
      fact_key: `special_assessment:${slug(purpose)}`,
      kind: perUnit || sa.total_cad != null ? "money" : "text",
      label: `Special assessment: ${purpose}${perUnit ? " (per unit)" : sa.total_cad != null ? " (total)" : ""}`,
      value_num: sa.amount_per_unit_cad ?? sa.total_cad ?? null,
      value_text: sa.status,
      as_of: asOf,
      doc_type: docType(sa.evidence.file_id),
      page: sa.evidence.matched_page ?? sa.evidence.page,
      source: "document",
    });
  }
  for (const lit of facts.litigation ?? []) {
    if (!lit.evidence?.verified) continue;
    const subject = R(lit.subject);
    if (!subject) continue;
    out.push({
      fact_key: `litigation:${slug(subject)}`,
      kind: "text",
      label: `Lawsuit or dispute: ${subject}`,
      value_num: null,
      value_text: R(lit.status).slice(0, 120),
      as_of: asOf,
      doc_type: docType(lit.evidence.file_id),
      page: lit.evidence.matched_page ?? lit.evidence.page,
      source: "document",
    });
  }
  if (facts.rental_rules && facts.rental_rules_evidence?.verified) {
    const ev = facts.rental_rules_evidence;
    out.push({
      fact_key: "rental_rules",
      kind: "text",
      label: "Rental rules",
      value_num: null,
      value_text: R(facts.rental_rules).slice(0, 300),
      as_of: asOf,
      doc_type: docType(ev.file_id),
      page: ev.matched_page ?? ev.page,
      source: "document",
    });
  }
  // One fact per key per package (two assessments with the same purpose keep the first).
  const seen = new Set<string>();
  return out.filter((f) => (seen.has(f.fact_key) ? false : (seen.add(f.fact_key), true)));
}

/** What makes two statements of a fact the same: the figure, or the normalized text. */
export function valueKey(f: Pick<SharedFact, "value_num" | "value_text">): string {
  if (f.value_num != null) return `n:${Math.round(f.value_num * 100) / 100}`;
  return `t:${(f.value_text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 120)}`;
}

/* ------------------------------------------------------------------ */
/* The record over time                                                */
/* ------------------------------------------------------------------ */

export interface FactTimeline {
  fact_key: string;
  label: string;
  kind: SharedKind;
  /** Newest statement(s): two or more means the record disagrees with itself for that date. */
  current: SharedFactRow[];
  /** Older statements, newest first: superseded, kept with their dates. */
  history: SharedFactRow[];
}

/** Order "YYYY-MM" and "YYYY-MM-DD" on one scale (a month sorts as its first day). */
const dateKey = (d: string) => (d.length === 7 ? `${d}-01` : d);

export function buildTimelines(rows: SharedFactRow[]): FactTimeline[] {
  const groups = new Map<string, SharedFactRow[]>();
  for (const r of rows) groups.set(r.fact_key, [...(groups.get(r.fact_key) ?? []), r]);
  const out: FactTimeline[] = [];
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => dateKey(b.as_of).localeCompare(dateKey(a.as_of)) || b.seen_count - a.seen_count);
    const newest = dateKey(sorted[0].as_of);
    const current = sorted.filter((r) => dateKey(r.as_of) === newest);
    out.push({ fact_key: key, label: current[0].label, kind: current[0].kind, current, history: sorted.filter((r) => dateKey(r.as_of) !== newest) });
  }
  return out.sort((a, b) => orderOf(a.fact_key) - orderOf(b.fact_key) || a.label.localeCompare(b.label));
}

export type CheckStatus = "new" | "corroborated" | "changed" | "unchanged" | "older" | "conflict" | "not_mentioned";

export interface CheckItem {
  status: CheckStatus;
  fact_key: string;
  label: string;
  kind: SharedKind;
  /** This package's statement (null for not_mentioned). */
  value_num: number | null;
  value_text: string | null;
  as_of: string | null;
  /** The record's statement it was checked against, when there is one. */
  record: { value_num: number | null; value_text: string | null; as_of: string; seen_count: number } | null;
}

const asRecord = (r: SharedFactRow) => ({ value_num: r.value_num, value_text: r.value_text, as_of: r.as_of, seen_count: r.seen_count });

/**
 * Check one package's facts against what the record held before it.
 * Lawsuits and special assessments the record knows about but this package
 * doesn't mention come back as not_mentioned: worth asking about.
 */
export function checkAgainstRecord(incoming: SharedFact[], before: SharedFactRow[]): CheckItem[] {
  const timelines = new Map(buildTimelines(before).map((t) => [t.fact_key, t]));
  const items: CheckItem[] = [];
  for (const f of incoming) {
    const base = { fact_key: f.fact_key, label: f.label, kind: f.kind, value_num: f.value_num, value_text: f.value_text, as_of: f.as_of };
    const t = timelines.get(f.fact_key);
    if (!t) {
      items.push({ ...base, status: "new", record: null });
      continue;
    }
    const all = [...t.current, ...t.history];
    const sameDate = all.filter((r) => dateKey(r.as_of) === dateKey(f.as_of));
    const newest = t.current[0];
    if (sameDate.length > 0) {
      const match = sameDate.find((r) => valueKey(r) === valueKey(f));
      items.push(match ? { ...base, status: "corroborated", record: asRecord(match) } : { ...base, status: "conflict", record: asRecord(sameDate[0]) });
    } else if (dateKey(newest.as_of) > dateKey(f.as_of)) {
      items.push({ ...base, status: "older", record: asRecord(newest) });
    } else {
      items.push({ ...base, status: valueKey(newest) === valueKey(f) ? "unchanged" : "changed", record: asRecord(newest) });
    }
  }
  const mentioned = new Set(incoming.map((f) => f.fact_key));
  const pkgDate = incoming[0]?.as_of ?? null;
  for (const t of timelines.values()) {
    if (mentioned.has(t.fact_key)) continue;
    if (!t.fact_key.startsWith("litigation:") && !t.fact_key.startsWith("special_assessment:")) continue;
    // Only what the record had by this package's date: a later lawsuit isn't "missing" from an older package.
    if (pkgDate && dateKey(t.current[0].as_of) > dateKey(pkgDate)) continue;
    items.push({ status: "not_mentioned", fact_key: t.fact_key, label: t.label, kind: t.kind, value_num: null, value_text: null, as_of: null, record: asRecord(t.current[0]) });
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

const money = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;

export function formatValue(f: { kind: SharedKind; value_num: number | null; value_text: string | null }): string {
  if (f.kind === "money" && f.value_num != null) return f.value_text ? `${money(f.value_num)}, ${f.value_text}` : money(f.value_num);
  if (f.kind === "percent" && f.value_num != null) return `${f.value_num > 0 ? "+" : ""}${f.value_num}%`;
  return f.value_text ?? "";
}

/** "2025-03" -> "Mar 2025"; "2025-03-14" -> "Mar 14, 2025". */
export function formatAsOf(d: string): string {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(d);
  if (!m) return d;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1)));
  return date.toLocaleDateString("en-CA", { month: "short", year: "numeric", ...(m[3] ? { day: "numeric" } : {}), timeZone: "UTC" });
}

/** Lines for the analysis prompt: the record's facts, newest first, with dates. */
export function recordPromptLines(rows: SharedFactRow[], max = 12): string[] {
  return buildTimelines(rows)
    .slice(0, max)
    .map((t) => {
      const now = t.current.map((r) => `${formatValue(r)} as of ${r.as_of}`).join(" / ");
      const prev = t.history[0] ? `; earlier ${formatValue(t.history[0])} as of ${t.history[0].as_of}` : "";
      return `${t.label}: ${now}${prev}`;
    });
}
