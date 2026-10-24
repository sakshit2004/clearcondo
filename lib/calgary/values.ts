/**
 * Assessment value trend for a condo building vs similar buildings.
 *
 * The building's per-year total and median unit value come from the
 * historical rolls (plus the current roll for this year). "Similar" means
 * condo buildings in the same community with the same property-use code,
 * picked by closest unit count. Comparison is on % change from a shared
 * base year, so differently-priced buildings are comparable. This is
 * context only — the UI says what a gap "may reflect", never what it means.
 */
import {
  CALGARY_DATASETS,
  normalizeRollNumber,
  parseMoney,
  resourceUrl,
  soql,
  soqlString,
  type SocrataOptions,
  type SocrataRow,
} from "./socrata.ts";
import { planPrefix, toRollUnits, type RollUnit } from "./match.ts";

export interface UnitYearValue {
  roll_number: string;
  year: number;
  value: number;
}

export interface YearSummary {
  year: number;
  total: number;
  median: number;
  units: number;
}

export interface TrendPoint {
  year: number;
  building_total: number;
  building_median: number;
  building_units: number;
  /** % change of the building's median since the base (first) year. */
  building_change_pct: number | null;
  /** Median % change of the comparable buildings' medians since the base year. */
  comparables_change_pct: number | null;
  comparables_count: number;
}

export interface ComparableBuilding {
  plan: string;
  units: number;
  median_current: number;
  roll_numbers: string[];
}

export function median(nums: number[]): number {
  if (nums.length === 0) return NaN;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Historical rows -> unit/year values, one per (roll, year); bad values dropped. */
export function toUnitYearValues(rows: SocrataRow[], rollSet?: Set<string>): UnitYearValue[] {
  const out = new Map<string, UnitYearValue>();
  for (const r of rows) {
    const roll = normalizeRollNumber(r.roll_number);
    const year = parseMoney(r.roll_year);
    const value = parseMoney(r.assessed_value);
    if (!roll || !year || value == null || value <= 0) continue;
    if (rollSet && !rollSet.has(roll)) continue;
    out.set(`${roll}|${year}`, { roll_number: roll, year, value });
  }
  return [...out.values()];
}

/** Current-roll units as this year's values (when the roll states its year). */
export function currentYearValues(units: RollUnit[], fallbackYear: number): UnitYearValue[] {
  return units
    .filter((u) => u.assessed_value != null && u.assessed_value > 0)
    .map((u) => ({ roll_number: u.roll_number, year: u.roll_year ?? fallbackYear, value: u.assessed_value! }));
}

/** Per-year totals and medians, ascending by year. */
export function summarizeByYear(values: UnitYearValue[]): YearSummary[] {
  const byYear = new Map<number, number[]>();
  for (const v of values) {
    const list = byYear.get(v.year) ?? [];
    list.push(v.value);
    byYear.set(v.year, list);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, vals]) => ({
      year,
      total: vals.reduce((s, x) => s + x, 0),
      median: median(vals),
      units: vals.length,
    }));
}

/** Merge history with current-year values; history wins for a year it has. */
export function mergeYears(history: UnitYearValue[], current: UnitYearValue[]): UnitYearValue[] {
  const years = new Set(history.map((h) => h.year));
  return [...history, ...current.filter((c) => !years.has(c.year))];
}

/**
 * Pick comparable buildings from same-community, same-use roll units:
 * other plans with at least 3 units, closest unit count first.
 */
export function pickComparables(
  units: RollUnit[],
  targetPlan: string,
  targetUnits: number,
  max = 6
): ComparableBuilding[] {
  const byPlan = new Map<string, RollUnit[]>();
  for (const u of units) {
    const plan = planPrefix(u.short_legal);
    if (!plan || plan === targetPlan) continue;
    const list = byPlan.get(plan) ?? [];
    list.push(u);
    byPlan.set(plan, list);
  }
  return [...byPlan.entries()]
    .filter(([, list]) => list.length >= 3)
    .map(([plan, list]) => ({
      plan,
      units: list.length,
      median_current: median(list.map((u) => u.assessed_value ?? 0).filter((v) => v > 0)),
      roll_numbers: list.map((u) => u.roll_number),
    }))
    .filter((c) => Number.isFinite(c.median_current))
    .sort((a, b) => Math.abs(a.units - targetUnits) - Math.abs(b.units - targetUnits) || a.plan.localeCompare(b.plan))
    .slice(0, max);
}

const pct = (from: number, to: number) => (from > 0 ? ((to - from) / from) * 100 : null);

/**
 * The building's trend with comparables' median % change alongside. The
 * base year is the building's first year; a comparable counts for a year
 * only when it has both the base year and that year.
 */
/** Years shown in the trend; the historical rolls go back to 2005. */
export const TREND_YEARS = 10;

export function buildTrend(
  allYears: YearSummary[],
  comparables: YearSummary[][],
  maxYears = TREND_YEARS
): TrendPoint[] {
  const building = allYears.slice(-maxYears);
  if (building.length === 0) return [];
  const base = building[0];
  return building.map((y) => {
    const changes = comparables
      .map((comp) => {
        const b = comp.find((c) => c.year === base.year);
        const t = comp.find((c) => c.year === y.year);
        return b && t ? pct(b.median, t.median) : null;
      })
      .filter((c): c is number => c != null);
    return {
      year: y.year,
      building_total: y.total,
      building_median: y.median,
      building_units: y.units,
      building_change_pct: pct(base.median, y.median),
      comparables_change_pct: changes.length ? median(changes) : null,
      comparables_count: changes.length,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Network                                                             */
/* ------------------------------------------------------------------ */

/** SoQL IN-list matching roll numbers with and without leading zeros. */
export function rollInWhere(rolls: string[]): string {
  const forms = new Set<string>();
  for (const r of rolls) {
    forms.add(r);
    forms.add(r.replace(/^0+/, "") || "0");
  }
  return `roll_number in (${[...forms].map(soqlString).join(", ")})`;
}

const HISTORY_CHUNK = 50;

/** Historical values for roll numbers (chunked so URLs stay short). */
export async function fetchHistory(rolls: string[], opts: SocrataOptions = {}): Promise<UnitYearValue[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < rolls.length; i += HISTORY_CHUNK) chunks.push(rolls.slice(i, i + HISTORY_CHUNK));
  const results = await Promise.all(
    chunks.map((chunk) =>
      soql(
        CALGARY_DATASETS.historicalRolls,
        { $select: "roll_number, roll_year, assessed_value", $where: rollInWhere(chunk), $limit: "50000" },
        opts
      )
    )
  );
  return toUnitYearValues(results.flat(), new Set(rolls));
}

/** Link to the historical-roll rows behind the building's trend. */
export function historyQueryUrl(rolls: string[]): string {
  return resourceUrl(CALGARY_DATASETS.historicalRolls, { $where: rollInWhere(rolls), $order: "roll_year" });
}

export interface SimilarityBasis {
  comm_code: string;
  comm_name: string | null;
  /** Field the use code came from (sub_property_use or property_type). */
  use_field: "sub_property_use" | "property_type";
  use_code: string;
}

/** The building's community and its most common property-use code. */
export function similarityBasis(units: RollUnit[]): SimilarityBasis | null {
  const mode = (vals: (string | null)[]) => {
    const counts = new Map<string, number>();
    for (const v of vals) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const comm = mode(units.map((u) => u.comm_code));
  if (!comm) return null;
  const sub = mode(units.map((u) => u.sub_property_use));
  const prop = mode(units.map((u) => u.property_type));
  const use_field = sub ? "sub_property_use" : prop ? "property_type" : null;
  if (!use_field) return null;
  return {
    comm_code: comm,
    comm_name: units.find((u) => u.comm_code === comm)?.comm_name ?? null,
    use_field,
    use_code: (sub ?? prop)!,
  };
}

export function comparablesWhere(basis: SimilarityBasis): string {
  return `comm_code = ${soqlString(basis.comm_code)} AND ${basis.use_field} = ${soqlString(
    basis.use_code
  )} AND short_legal like '%;%'`;
}

/** Current-roll units of the same use in the same community. */
export async function fetchComparableUnits(basis: SimilarityBasis, opts: SocrataOptions = {}): Promise<RollUnit[]> {
  const rows = await soql(
    CALGARY_DATASETS.currentRoll,
    {
      $select: "roll_number, short_legal, assessed_value, roll_year, comm_code",
      $where: comparablesWhere(basis),
      $limit: "20000",
    },
    opts
  );
  return toRollUnits(rows);
}
