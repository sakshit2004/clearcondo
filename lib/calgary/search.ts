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

export interface CondoSearchResult {
  plan: string;
  /** Building street addresses, most common first. */
  addresses: string[];
  /** Units among the matched rows (the building page shows the full count). */
  units: number;
  community: string | null;
  year_built: number | null;
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

/** Group roll rows into condo buildings, biggest first. */
export function groupCondoResults(rows: SocrataRow[], limit = 10): CondoSearchResult[] {
  const byPlan = new Map<string, { rolls: Set<string>; addrs: Map<string, number>; community: string | null; year: number | null }>();
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
  return [...byPlan.entries()]
    .map(([plan, e]) => ({
      plan,
      addresses: [...e.addrs.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a).slice(0, 3),
      units: e.rolls.size,
      community: e.community,
      year_built: e.year,
    }))
    .sort((a, b) => b.units - a.units || a.plan.localeCompare(b.plan))
    .slice(0, limit);
}

/** Search the roll for condo buildings. Throws CityDataError on API failure. */
export async function searchCondoBuildings(
  raw: string,
  opts: SocrataOptions = {}
): Promise<{ query: SearchQuery; results: CondoSearchResult[] } | null> {
  const query = buildSearchQuery(raw);
  if (!query) return null;
  const rows = await soql(
    CALGARY_DATASETS.currentRoll,
    {
      $select: "roll_number, address, short_legal, comm_name, year_of_construction",
      $where: query.where,
      $limit: "3000",
    },
    opts
  );
  return { query, results: groupCondoResults(rows) };
}
