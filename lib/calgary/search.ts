/**
 * "Look up a Calgary condo": search the current assessment roll for condo
 * buildings by street address or condo plan number.
 *
 * Condo units carry a short_legal of "<plan>;<unit>" (one ';'), while
 * houses carry "<plan>;<block>;<lot>" (two). Matching rows are grouped by
 * plan, so each result is one building. The roll has no building names,
 * so names can't be searched; the UI says so.
 */
import {
  CALGARY_DATASETS,
  soql,
  soqlString,
  str,
  type SocrataOptions,
  type SocrataRow,
} from "./socrata.ts";
import { normalizePlanNumber, normalizeStreetWords, planPrefix, stripUnitFromRollAddress } from "./match.ts";

/** How a result matched: the address exactly, as a prefix, as whole words, by plan, or only the street. */
export type MatchQuality = "exact" | "prefix" | "words" | "plan" | "nearby";

export interface CondoSearchResult {
  plan: string;
  /** Building street addresses, best match first. */
  addresses: string[];
  /** Units at the matched addresses (the building page shows the plan's full count). */
  units: number;
  community: string | null;
  year_built: number | null;
  match: MatchQuality;
}

export type SearchQuery =
  | { kind: "plan"; plan: string; where: string }
  | { kind: "address"; term: string; where: string };

export const MIN_QUERY = 3;
export const MAX_QUERY = 80;

/** A condo unit's legal: exactly "plan;unit". */
export function isCondoLegal(shortLegal: string | null | undefined): boolean {
  return !!shortLegal && shortLegal.split(";").length === 2;
}

/**
 * Turn user input into a roll query, or null when it's unusable. A bare
 * plan-shaped token searches by plan; anything else searches the address
 * (normalized to the roll's style when it parses as a street address).
 */
export function buildSearchQuery(raw: string): SearchQuery | null {
  const q = raw.replace(/[^A-Za-z0-9 #\-.,']/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < MIN_QUERY || q.length > MAX_QUERY) return null;
  const plan = /^(plan\s*)?[0-9][0-9 \-]{3,10}[0-9A-Za-z]?$/i.test(q) ? normalizePlanNumber(q) : null;
  if (plan) {
    return { kind: "plan", plan, where: `short_legal like ${soqlString(`${plan};%`)}` };
  }
  // A street address loses any unit number ("#1203 1111 6 AV SW", "1203
  // 1111 6 AV SW" -> "1111 6 AV SW"); a bare street name is abbreviated
  // the roll's way ("Deermeade Bay" -> "DEERMEADE BA").
  const term = stripUnitFromRollAddress(q) ?? normalizeStreetWords(q) ?? "";
  if (term.replace(/[^A-Z0-9]/g, "").length < MIN_QUERY) return null;
  return {
    kind: "address",
    term,
    where: `upper(address) like ${soqlString(`%${term}%`)} AND short_legal like '%;%'`,
  };
}

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * How well a building address matches the search term:
 * 3 exact ("1111 6 AV SW"), 2 prefix, including a half-typed last word
 * ("1111 6 A"), 1 whole words elsewhere ("DEERMEADE" in "16 DEERMEADE BA
 * SE"), 0 no match. 0 covers mid-word hits like "21111 6 AV SW" for
 * "1111 6 AV SW", which the roll's LIKE query returns but aren't matches.
 */
export function addressMatchScore(address: string, term: string): number {
  if (address === term) return 3;
  if (address.startsWith(term)) return 2;
  return new RegExp(`(^|\\s)${escapeRe(term)}`).test(address) ? 1 : 0;
}

const QUALITY_BY_SCORE: Record<number, MatchQuality> = { 3: "exact", 2: "prefix", 1: "words" };

interface PlanGroup {
  rolls: Set<string>;
  addrs: Map<string, number>;
  community: string | null;
  year: number | null;
}

function groupByPlan(rows: SocrataRow[]): Map<string, PlanGroup> {
  const byPlan = new Map<string, PlanGroup>();
  for (const r of rows) {
    const legal = str(r, "short_legal");
    if (!isCondoLegal(legal)) continue;
    const plan = planPrefix(legal);
    if (!plan) continue;
    const entry = byPlan.get(plan) ?? { rolls: new Set(), addrs: new Map(), community: null, year: null };
    entry.rolls.add(str(r, "roll_number") ?? `${entry.rolls.size}`);
    const addr = stripUnitFromRollAddress(str(r, "address"));
    if (addr) entry.addrs.set(addr, (entry.addrs.get(addr) ?? 0) + 1);
    entry.community ??= str(r, "comm_name");
    const y = Number(str(r, "year_of_construction"));
    if (!entry.year && Number.isFinite(y) && y > 1800) entry.year = Math.round(y);
    byPlan.set(plan, entry);
  }
  return byPlan;
}

function toResult(plan: string, e: PlanGroup, match: MatchQuality, rank: (addr: string) => number): CondoSearchResult {
  return {
    plan,
    addresses: [...e.addrs.entries()]
      .sort((a, b) => rank(b[0]) - rank(a[0]) || b[1] - a[1])
      .map(([a]) => a)
      .slice(0, 3),
    units: e.rolls.size,
    community: e.community,
    year_built: e.year,
    match,
  };
}

/**
 * Group roll rows into condo buildings. With a term, drop buildings with
 * no real address match and rank exact > prefix > whole words, then by
 * size; without one (plan search), biggest first.
 */
export function groupCondoResults(rows: SocrataRow[], term: string | null = null, limit = 10): CondoSearchResult[] {
  const scored = [...groupByPlan(rows).entries()].map(([plan, e]) => {
    const score = term ? Math.max(0, ...[...e.addrs.keys()].map((a) => addressMatchScore(a, term))) : 3;
    return { plan, e, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.e.rolls.size - a.e.rolls.size || a.plan.localeCompare(b.plan))
    .slice(0, limit)
    .map(({ plan, e, score }) =>
      toResult(plan, e, term ? QUALITY_BY_SCORE[score] : "plan", (a) => (term ? addressMatchScore(a, term) : 0))
    );
}

/** "1111 6 AV SW" -> { civic: 1111, street: "6 AV SW" }; null without a civic number. */
export function splitCivic(term: string): { civic: number; street: string } | null {
  const m = term.match(/^([0-9]+)[A-Z]?\s+(.+)$/);
  if (!m || m[2].split(" ").length < 2) return null;
  return { civic: Number(m[1]), street: m[2] };
}

/**
 * Buildings on the same street, nearest civic number first, for an
 * address that matched nothing. Labelled "nearby" — never presented as
 * the building that was searched.
 */
export function nearbyCondoResults(rows: SocrataRow[], civic: number, street: string, limit = 10): CondoSearchResult[] {
  const onStreet = (a: string) => splitCivic(a)?.street.startsWith(street) ?? false;
  const distance = (a: string) => Math.abs((splitCivic(a)?.civic ?? Infinity) - civic);
  return [...groupByPlan(rows).entries()]
    .map(([plan, e]) => ({ plan, e, d: Math.min(...[...e.addrs.keys()].filter(onStreet).map(distance)) }))
    .filter((x) => Number.isFinite(x.d))
    .sort((a, b) => a.d - b.d || a.plan.localeCompare(b.plan))
    .slice(0, limit)
    .map(({ plan, e }) => toResult(plan, e, "nearby", (a) => (onStreet(a) ? -distance(a) : -Infinity)));
}

const SELECT = "roll_number, address, short_legal, comm_name, year_of_construction";

export interface CondoSearchResponse {
  query: SearchQuery;
  results: CondoSearchResult[];
  /** Set when the address matched nothing and results are the same street, nearest first. */
  nearbyStreet: string | null;
}

/** Search the roll for condo buildings. Throws CityDataError on API failure. */
export async function searchCondoBuildings(raw: string, opts: SocrataOptions = {}): Promise<CondoSearchResponse | null> {
  const query = buildSearchQuery(raw);
  if (!query) return null;
  const rows = await soql(CALGARY_DATASETS.currentRoll, { $select: SELECT, $where: query.where, $limit: "3000" }, opts);
  if (query.kind === "plan") {
    return { query, results: groupCondoResults(rows), nearbyStreet: null };
  }
  const results = groupCondoResults(rows, query.term);
  const split = results.length === 0 ? splitCivic(query.term) : null;
  if (!split) return { query, results, nearbyStreet: null };
  // Nothing at that civic number: show condo buildings on the same street.
  const streetRows = await soql(
    CALGARY_DATASETS.currentRoll,
    {
      $select: SELECT,
      $where: `upper(address) like ${soqlString(`% ${split.street}%`)} AND short_legal like '%;%'`,
      $limit: "3000",
    },
    opts
  );
  return { query, results: nearbyCondoResults(streetRows, split.civic, split.street), nearbyStreet: split.street };
}
