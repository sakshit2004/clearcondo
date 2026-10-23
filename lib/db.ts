import { Surreal } from "surrealdb";
import { readFileSync } from "fs";
import { join } from "path";
import type {
  BuildingFacts,
  DocType,
  Flag,
  VerifiedAnalysis,
  VerifiedEvidence,
  VerifiedStructuredFacts,
} from "./report-schema";
import type { PageText } from "./extract";

/* ------------------------------------------------------------------ */
/* Connection                                                          */
/* ------------------------------------------------------------------ */

export function isDbConfigured(): boolean {
  return Boolean(process.env.SURREL_URL || process.env.SURREAL_URL);
}

function env(name: string): string | undefined {
  // Accept both SURREAL_* and legacy SURREL_* spellings.
  return process.env[name] ?? process.env[name.replace("SURREAL", "SURREL")];
}

let schemaEnsuredFor: string | null = null;

async function connect(): Promise<Surreal | null> {
  const url = env("SURREAL_URL");
  if (!url) return null;
  const db = new Surreal();
  try {
    await db.connect(url);
    const ns = env("SURREAL_NS") || "clearcondo";
    const database = env("SURREAL_DB") || "prod";
    // Authenticate BEFORE selecting a namespace. SurrealDB v3 dropped
    // v2's behavior of auto-creating namespaces/databases on USE, and
    // an unauthenticated USE against a missing namespace fails with
    // NotFoundError — which is exactly what a fresh Cloud instance hit
    // in production (digest 1800948725, GET /app).
    const token = env("SURREAL_TOKEN");
    if (token) {
      await db.authenticate(token);
    } else {
      const username = env("SURREAL_USER");
      const password = env("SURREAL_PASS");
      if (username && password) {
        await db.signin({ username, password });
      }
    }
    // Self-bootstrap so a fresh instance works with zero manual setup:
    // define the namespace/database when missing. DEFINE failures are
    // ignored (already exists); each USE is the real check and surfaces
    // any genuine error. Identifiers are interpolated, so restrict them
    // to the safe character set SurrealDB names allow.
    if (!/^[A-Za-z0-9_]+$/.test(ns) || !/^[A-Za-z0-9_]+$/.test(database)) {
      throw new Error("Invalid SURREAL_NS / SURREAL_DB value");
    }
    try {
      await db.query(`DEFINE NAMESPACE ${ns};`);
    } catch {
      /* already exists */
    }
    await db.use({ namespace: ns });
    try {
      await db.query(`DEFINE DATABASE ${database};`);
    } catch {
      /* already exists */
    }
    await db.use({ namespace: ns, database });
    const schemaKey = `${url}|${ns}|${database}`;
    if (schemaEnsuredFor !== schemaKey) {
      const schema = readFileSync(join(process.cwd(), "lib", "schema.surql"), "utf8");
      await db.query(schema);
      schemaEnsuredFor = schemaKey;
    }
    return db;
  } catch (err) {
    try {
      await db.close();
    } catch {
      /* ignore */
    }
    throw err;
  }
}

/** Run a callback with a connected db; null when SurrealDB is not configured. */
export async function withDb<T>(
  fn: (db: Surreal) => Promise<T>
): Promise<T | null> {
  const db = await connect();
  if (!db) return null;
  try {
    return await fn(db);
  } finally {
    try {
      await db.close();
    } catch {
      /* ignore */
    }
  }
}

/** Run a SurrealQL statement; returns the first result set's rows. */
export async function dbQuery<T>(
  db: Surreal,
  sql: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  return q<T>(db, sql, params);
}

type QueryResult = Record<string, unknown>[];

async function q<T>(
  db: Surreal,
  sql: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const res = (await db.query(sql, params)) as unknown[];
  return (res[0] as T) ?? ([] as unknown as T);
}

const rid = (id: unknown): string => String(id);

/* ------------------------------------------------------------------ */
/* Row types                                                           */
/* ------------------------------------------------------------------ */

export interface BuildingRow {
  id: string;
  name: string;
  corp_number: string | null;
  address: string | null;
  units: number | null;
  year_built: number | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  report_count?: number;
}

export interface ReportRow {
  id: string;
  building: string;
  owner_id: string;
  status: string;
  summary: string;
  money_exposure_total_cad: number | null;
  money_exposure_basis: string;
  questions: string[];
  model: string;
  facts: BuildingFacts;
  facts_snapshot: VerifiedStructuredFacts | null;
  doc_date: string | null;
  missing_documents: MissingDoc[] | null;
  verified_claims: number;
  total_claims: number;
  created_at: string;
  building_name?: string;
}

export interface FlagRow {
  id: string;
  report: string;
  building: string;
  owner_id: string;
  flag_type: string;
  severity: string;
  title: string;
  explanation: string;
  evidence: VerifiedEvidence[];
  money_exposure: {
    amount_cad: number | null;
    per_unit_cad: number | null;
    basis: string;
  } | null;
  downgraded: boolean;
  created_at: string;
}

export interface DocumentMeta {
  filename: string;
  docType: DocType;
  pageCount: number;
  charCount: number;
  /** extracted | ocr | failed */
  status: string;
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

function normalizeIdent(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Building identity: the condo plan / corporation number when the documents
 * state one, otherwise the normalized name + address. Normalization makes
 * "North Hill Terrace" and "north hill terrace," resolve to the same building.
 */
function dedupeKey(ownerId: string, facts: BuildingFacts, hint: string | null): string {
  const corp = normalizeIdent(facts.corp_number || "");
  if (corp) return `${ownerId}|corp:${corp}`;
  const name = normalizeIdent(facts.name || hint || "unknown");
  const addr = normalizeIdent(facts.address || "");
  return `${ownerId}|name:${name}::${addr}`;
}

/** Find or create the building row for this owner; returns its record id. */
export async function upsertBuilding(
  db: Surreal,
  ownerId: string,
  facts: BuildingFacts,
  nameHint: string | null
): Promise<string> {
  const key = dedupeKey(ownerId, facts, nameHint);
  const existing = await q<{ id: unknown }[]>(
    db,
    "SELECT id FROM building WHERE dedupe_key = $key LIMIT 1",
    { key }
  );
  if (existing.length > 0) {
    const id = rid(existing[0].id);
    // Fill in facts we were missing before; never overwrite good data with nulls.
    const sets: string[] = ["updated_at = time::now()"];
    const params: Record<string, unknown> = { id };
    const name = facts.name || nameHint;
    if (name) {
      sets.push("name = $name");
      params.name = name;
    }
    if (facts.corp_number) {
      sets.push("corp_number = $corp");
      params.corp = facts.corp_number;
    }
    if (facts.address) {
      sets.push("address = $addr");
      params.addr = facts.address;
    }
    if (facts.units) {
      sets.push("units = $units");
      params.units = facts.units;
    }
    if (facts.year_built) {
      sets.push("year_built = $yb");
      params.yb = facts.year_built;
    }
    await q(db, `UPDATE type::thing($id) SET ${sets.join(", ")}`, params);
    return id;
  }
  const created = await q<{ id: unknown }[]>(
    db,
    `CREATE building CONTENT {
       name: $name, corp_number: $corp, address: $addr, units: $units,
       year_built: $yb, owner_id: $owner, dedupe_key: $key
     } RETURN id`,
    {
      name: facts.name || nameHint || "Unnamed building",
      corp: facts.corp_number,
      addr: facts.address,
      units: facts.units,
      yb: facts.year_built,
      owner: ownerId,
      key,
    }
  );
  return rid(created[0].id);
}

/**
 * Persist one uploaded document: metadata + extracted page text, linked to
 * both its building and the report (analysis run) that produced it.
 * Raw PDF bytes are never stored — only the extracted text.
 * Returns the document record id.
 */
export async function createDocument(
  db: Surreal,
  ownerId: string,
  buildingId: string,
  reportId: string,
  meta: DocumentMeta,
  pages: PageText[]
): Promise<string> {
  const created = await q<{ id: unknown }[]>(
    db,
    `CREATE document CONTENT {
       building: type::thing($building), report: type::thing($report),
       filename: $filename, doc_type: $docType,
       page_count: $pageCount, char_count: $chars,
       status: $status, owner_id: $owner,
       pages: $pageTexts
     } RETURN id`,
    {
      building: buildingId,
      report: reportId,
      filename: meta.filename,
      docType: meta.docType,
      pageCount: meta.pageCount,
      chars: meta.charCount,
      status: meta.status,
      owner: ownerId,
      pageTexts: pages.map((p) => ({ page_number: p.page, text: p.text })),
    }
  );
  return rid(created[0].id);
}

export interface MissingDoc {
  id: string;
  label: string;
  askFor: string;
}

/** Persist a verified analysis; returns the report record id. */
export async function persistAnalysis(
  db: Surreal,
  ownerId: string,
  buildingId: string,
  analysis: VerifiedAnalysis,
  model: string,
  missing: MissingDoc[] = []
): Promise<string> {
  const created = await q<{ id: unknown }[]>(
    db,
    `CREATE report CONTENT {
       building: type::thing($building), owner_id: $owner,
       status: "complete", summary: $summary,
       money_exposure_total_cad: $total, money_exposure_basis: $basis,
       questions: $questions, model: $model, facts: $facts,
       verified_claims: $vClaims, total_claims: $tClaims,
       facts_snapshot: $snapshot, doc_date: $docDate,
       missing_documents: $missing
     } RETURN id`,
    {
      building: buildingId,
      owner: ownerId,
      summary: analysis.summary,
      total: analysis.money_exposure_total_cad,
      basis: analysis.money_exposure_basis,
      questions: analysis.questions_for_realtor_lawyer,
      model,
      facts: analysis.building,
      vClaims: analysis.verification.verified_claims,
      tClaims: analysis.verification.total_claims,
      snapshot: analysis.structured_facts,
      docDate: analysis.structured_facts.doc_date,
      missing,
    }
  );
  const reportId = rid(created[0].id);

  for (const flag of analysis.flags) {
    await q(
      db,
      `CREATE flag CONTENT {
         report: type::thing($report), building: type::thing($building),
         owner_id: $owner, flag_type: $flagType, severity: $severity,
         title: $title, explanation: $explanation, evidence: $evidence,
         money_exposure: $money, downgraded: $downgraded
       }`,
      {
        report: reportId,
        building: buildingId,
        owner: ownerId,
        flagType: flag.flag_type,
        severity: flag.severity,
        title: flag.title,
        explanation: flag.explanation,
        evidence: flag.evidence,
        money: flag.money_exposure,
        downgraded: flag.downgraded,
      }
    );
  }
  return reportId;
}

/* ------------------------------------------------------------------ */
/* Delete cascade                                                        */
/* ------------------------------------------------------------------ */

/** Minimal query surface for the delete cascade (real Surreal or test fake). */
export interface CascadeDb {
  query: (
    sql: string,
    params?: Record<string, unknown>
  ) => Promise<unknown[]>;
}

export interface DeleteCascadeResult {
  buildingId: string;
  buildingDeleted: boolean;
}

/**
 * Delete a report and everything that analysis run produced: its flags, its
 * documents (metadata + extracted page text), and the report row itself.
 *
 * If the building has no remaining reports afterwards, the building shell is
 * removed too — an empty building is cruft, and future uploads re-create it
 * via the normal dedupe path. Returns null when the report doesn't exist or
 * isn't owned by the user.
 *
 * Agent Memory beliefs are NOT removed here — the hosted service only offers
 * semantic forget, so that happens best-effort via forgetReportBeliefs in
 * lib/agent-memory.ts (documented limitation in lib/retention.ts).
 */
export async function deleteReportCascade(
  db: CascadeDb,
  ownerId: string,
  reportId: string
): Promise<DeleteCascadeResult | null> {
  const first = async <T>(
    sql: string,
    params: Record<string, unknown>
  ): Promise<T[]> => {
    const res = await db.query(sql, params);
    return ((res[0] ?? []) as T[]);
  };
  const reports = await first<{ id: unknown; building: unknown }>(
    "SELECT id, building FROM report WHERE id = type::thing($id) AND owner_id = $owner LIMIT 1",
    { id: reportId, owner: ownerId }
  );
  if (reports.length === 0) return null;
  const buildingId = String(reports[0].building);
  const scope = { id: reportId, owner: ownerId };
  // Order matters: children first, then the report row.
  await db.query(
    "DELETE flag WHERE report = type::thing($id) AND owner_id = $owner",
    scope
  );
  await db.query(
    "DELETE document WHERE report = type::thing($id) AND owner_id = $owner",
    scope
  );
  await db.query(
    "DELETE report WHERE id = type::thing($id) AND owner_id = $owner",
    scope
  );
  const remaining = await first<{ id: unknown }>(
    "SELECT id FROM report WHERE building = type::thing($building) AND owner_id = $owner LIMIT 1",
    { building: buildingId, owner: ownerId }
  );
  let buildingDeleted = false;
  if (remaining.length === 0) {
    await db.query(
      "DELETE building WHERE id = type::thing($building) AND owner_id = $owner",
      { building: buildingId, owner: ownerId }
    );
    buildingDeleted = true;
  }
  return { buildingId, buildingDeleted };
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function listReports(
  db: Surreal,
  ownerId: string
): Promise<ReportRow[]> {
  return q<ReportRow[]>(
    db,
    `SELECT *, building.name AS building_name FROM report
     WHERE owner_id = $owner ORDER BY created_at DESC`,
    { owner: ownerId }
  );
}

export async function getReport(
  db: Surreal,
  ownerId: string,
  reportId: string
): Promise<{ report: ReportRow; flags: FlagRow[] } | null> {
  const reports = await q<ReportRow[]>(
    db,
    `SELECT *, building.name AS building_name FROM report
     WHERE id = type::thing($id) AND owner_id = $owner LIMIT 1`,
    { id: reportId, owner: ownerId }
  );
  if (reports.length === 0) return null;
  const flags = await q<FlagRow[]>(
    db,
    `SELECT * FROM flag WHERE report = type::thing($id) ORDER BY created_at`,
    { id: reportId }
  );
  return { report: reports[0], flags };
}

export async function listBuildings(
  db: Surreal,
  ownerId: string
): Promise<BuildingRow[]> {
  const buildings = await q<BuildingRow[]>(
    db,
    "SELECT * FROM building WHERE owner_id = $owner ORDER BY updated_at DESC",
    { owner: ownerId }
  );
  const counts = await q<{ id: string; n: number }[]>(
    db,
    `SELECT building AS id, count() AS n FROM report
     WHERE owner_id = $owner GROUP BY building`,
    { owner: ownerId }
  );
  const countById = new Map(counts.map((c) => [String(c.id), c.n]));
  return buildings.map((b) => ({
    ...b,
    report_count: countById.get(String(b.id)) ?? 0,
  }));
}

export async function getBuildingHistory(
  db: Surreal,
  ownerId: string,
  buildingId: string
): Promise<{ building: BuildingRow; reports: ReportRow[]; flags: FlagRow[] } | null> {
  const buildings = await q<BuildingRow[]>(
    db,
    "SELECT * FROM building WHERE id = type::thing($id) AND owner_id = $owner LIMIT 1",
    { id: buildingId, owner: ownerId }
  );
  if (buildings.length === 0) return null;
  const reports = await q<ReportRow[]>(
    db,
    "SELECT * FROM report WHERE building = type::thing($id) ORDER BY created_at DESC",
    { id: buildingId }
  );
  const flags = await q<FlagRow[]>(
    db,
    "SELECT * FROM flag WHERE building = type::thing($id) ORDER BY created_at DESC",
    { id: buildingId }
  );
  return { building: buildings[0], reports, flags };
}

/**
 * The most recent facts snapshot for a building, excluding one report.
 * Used to compute "what changed since the last review".
 */
export async function getPreviousFactsSnapshot(
  db: Surreal,
  ownerId: string,
  buildingId: string,
  excludeReportId?: string
): Promise<{ snapshot: VerifiedStructuredFacts; docDate: string | null; reportId: string } | null> {
  const rows = await q<
    { id: unknown; facts_snapshot: VerifiedStructuredFacts | null; doc_date: string | null }[]
  >(
    db,
    `SELECT id, facts_snapshot, doc_date FROM report
     WHERE building = type::thing($building) AND owner_id = $owner
     ${excludeReportId ? "AND id != type::thing($exclude)" : ""}
     ORDER BY created_at DESC LIMIT 1`,
    excludeReportId
      ? { building: buildingId, owner: ownerId, exclude: excludeReportId }
      : { building: buildingId, owner: ownerId }
  );
  if (rows.length === 0 || !rows[0].facts_snapshot) return null;
  return {
    snapshot: rows[0].facts_snapshot,
    docDate: rows[0].doc_date,
    reportId: String(rows[0].id),
  };
}

/** Candidate buildings matching a typed hint — for the confirm/merge step on upload. */
export async function matchBuildings(
  db: Surreal,
  ownerId: string,
  hint: string
): Promise<{ id: string; name: string; corp_number: string | null; address: string | null; report_count: number }[]> {
  const h = hint.trim();
  if (h.length < 2) return [];
  return q(
    db,
    `SELECT id, name, corp_number, address,
       count(SELECT id FROM report WHERE building = $parent.id) AS report_count
     FROM building
     WHERE owner_id = $owner
       AND (name ILIKE $like OR corp_number ILIKE $like OR address ILIKE $like)
     ORDER BY updated_at DESC LIMIT 5`,
    { owner: ownerId, like: `%${h}%` }
  );
}

/** Prior flags for a building, newest first — fed back into the analysis prompt as building memory. */
export async function getPriorFlags(
  db: Surreal,
  ownerId: string,
  buildingId: string,
  limit = 12
): Promise<Flag[]> {
  const rows = await q<FlagRow[]>(
    db,
    `SELECT flag_type, severity, title, explanation, created_at FROM flag
     WHERE building = type::thing($id) AND owner_id = $owner
     ORDER BY created_at DESC LIMIT $limit`,
    { id: buildingId, owner: ownerId, limit }
  );
  return rows.map((r) => ({
    flag_type: r.flag_type as Flag["flag_type"],
    severity: r.severity as Flag["severity"],
    title: r.title,
    explanation: r.explanation,
    evidence: [],
    money_exposure: null,
  }));
}

/* ------------------------------------------------------------------ */
/* Service orders (the no-login service front door)                    */
/* ------------------------------------------------------------------ */

import type {
  ServiceOrder,
  ServiceOrderDoc,
  ServiceOrderInput,
  ServiceOrderStatus,
} from "./service-order";

export interface ServiceOrderRow {
  id: string;
  ref_code: string;
  realtor_name: string;
  brokerage: string | null;
  email: string;
  property_address: string;
  condition_date: string | null;
  status: string;
  documents: (Omit<ServiceOrderDoc, "pages"> & {
    pages: { page_number: number; text: string }[];
  })[];
  created_at: string;
}

export function serviceOrderFromRow(row: ServiceOrderRow): ServiceOrder {
  return {
    refCode: row.ref_code,
    realtorName: row.realtor_name,
    brokerage: row.brokerage,
    email: row.email,
    propertyAddress: row.property_address,
    conditionDate: row.condition_date,
    status: (row.status as ServiceOrderStatus) || "received",
    createdAt: row.created_at,
    documents: (row.documents ?? []).map((d) => ({
      filename: d.filename,
      docType: d.docType,
      pageCount: d.pageCount,
      charCount: d.charCount,
      status: d.status,
      pages: (d.pages ?? []).map((p) => ({ page: p.page_number, text: p.text })),
    })),
  };
}

/** Persist a service order; returns the stored order with its ref code. */
export async function createServiceOrder(
  db: Surreal,
  input: ServiceOrderInput & { refCode: string; consent: boolean },
  documents: ServiceOrderDoc[]
): Promise<void> {
  await q(
    db,
    `CREATE service_order CONTENT {
       ref_code: $ref, realtor_name: $name, brokerage: $brokerage,
       email: $email, property_address: $address,
       condition_date: $conditionDate, status: "received",
       consent: $consent, documents: $documents
     }`,
    {
      ref: input.refCode,
      name: input.realtorName,
      brokerage: input.brokerage,
      email: input.email,
      address: input.propertyAddress,
      conditionDate: input.conditionDate,
      consent: input.consent,
      documents: documents.map((d) => ({
        filename: d.filename,
        docType: d.docType,
        pageCount: d.pageCount,
        charCount: d.charCount,
        status: d.status,
        pages: d.pages.map((p) => ({ page_number: p.page, text: p.text })),
      })),
    }
  );
}

export async function getServiceOrderByRef(
  db: Surreal,
  refCode: string
): Promise<ServiceOrder | null> {
  const rows = await q<ServiceOrderRow[]>(
    db,
    "SELECT * FROM service_order WHERE ref_code = $ref LIMIT 1",
    { ref: refCode }
  );
  return rows.length > 0 ? serviceOrderFromRow(rows[0]) : null;
}

/* ------------------------------------------------------------------ */
/* Credits (Stripe test mode)                                          */
/* ------------------------------------------------------------------ */

export function isStripeEnabled(): boolean {
  return (
    process.env.STRIPE_ENABLED === "true" &&
    // Test-mode only: a live key must never enable billing (see lib/stripe.ts).
    (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")
  );
}

export async function getCreditBalance(
  db: Surreal,
  ownerId: string
): Promise<number> {
  const rows = await q<{ balance: number }[]>(
    db,
    "SELECT balance FROM credit WHERE owner_id = $owner LIMIT 1",
    { owner: ownerId }
  );
  return rows.length > 0 ? rows[0].balance : 0;
}

export async function addCredits(
  db: Surreal,
  ownerId: string,
  amount: number
): Promise<number> {
  const rows = await q<{ balance: number }[]>(
    db,
    `UPDATE credit SET balance = balance + $amount, updated_at = time::now()
     WHERE owner_id = $owner RETURN balance`,
    { owner: ownerId, amount }
  );
  if (rows.length > 0) return rows[0].balance;
  const created = await q<{ balance: number }[]>(
    db,
    "CREATE credit CONTENT { owner_id: $owner, balance: $amount } RETURN balance",
    { owner: ownerId, amount }
  );
  return created[0].balance;
}

export async function spendCredit(db: Surreal, ownerId: string): Promise<boolean> {
  const rows = await q<{ balance: number }[]>(
    db,
    `UPDATE credit SET balance = balance - 1, updated_at = time::now()
     WHERE owner_id = $owner AND balance > 0 RETURN balance`,
    { owner: ownerId }
  );
  return rows.length > 0;
}
