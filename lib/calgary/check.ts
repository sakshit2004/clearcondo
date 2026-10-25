/**
 * The "Public record check" (City of Calgary): orchestration, caching, and
 * the per-report assessment against the uploaded documents.
 *
 * Two stages, cached differently:
 *  1. getCityRecords() — what the City's open data says about the building
 *     (roll match, value trend, major permits). Depends only on the
 *     building's identity, so it is cached per building for 24 hours.
 *  2. assessReport() — compares those records with ONE report's documents
 *     (identity check, permit keyword search). Pure, cheap, never cached.
 *
 * Failure policy: a City API failure never fails the report. The roll match
 * failing makes the whole section "City data unavailable"; a later failure
 * (history, comparables, permits) marks only that subsection unavailable.
 * Unavailable results are not cached, so the next view retries.
 */
import {
  CALGARY_DATASETS,
  CityDataError,
  datasetPageUrl,
  resourceUrl,
  type SocrataOptions,
} from "./socrata.ts";
import {
  matchBuilding,
  normalizePlanNumber,
  normalizeStreetAddress,
  dwellingUnits,
  planWhere,
  stripUnitFromRollAddress,
  type MatchMethod,
} from "./match.ts";
import {
  median,
  buildTrend,
  currentYearValues,
  fetchComparableUnits,
  fetchHistory,
  historyQueryUrl,
  mergeYears,
  pickComparables,
  similarityBasis,
  summarizeByYear,
  type SimilarityBasis,
  type TrendPoint,
} from "./values.ts";
import { fetchBuildingAppeals, type AppealsSection } from "./appeals.ts";
import {
  checkMentions,
  fetchMajorPermits,
  lookbackStart,
  type MajorPermit,
  type MentionCheck,
  type SearchableDoc,
} from "./permits.ts";

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Most comparable-building roll numbers fetched for history. */
const MAX_COMPARABLE_ROLLS = 300;

export interface CityRecordsInput {
  /** Plan numbers, most trusted first (document text, then corp number). */
  planCandidates: string[];
  address: string | null;
}

type Unavailable = { status: "unavailable"; message: string };

export interface ValuesSection {
  status: "ok";
  trend: TrendPoint[];
  history_url: string;
  basis: SimilarityBasis | null;
  comparables: { plan: string; units: number; median_current: number; source_url: string }[];
  /** Set when the building's history loaded but comparables did not. */
  comparables_error?: string;
}

export interface PermitsSection {
  status: "ok";
  since: string;
  items: MajorPermit[];
  query_url: string;
}

export type CityRecords = { identity_key: string; fetched_at: string } & (
  | Unavailable
  | { status: "no_match"; reason: string; tried: string[] }
  | {
      status: "matched";
      plan: string;
      method: MatchMethod;
      roll_query_url: string;
      roll_year: number | null;
      unit_count: number;
      residential_unit_count: number;
      building_addresses: string[];
      comm_name: string | null;
      year_of_construction: number | null;
      /** Current-roll total (all entries) and median home value (dwellings only; null when none). */
      current_total: number | null;
      current_median: number | null;
      values: ValuesSection | Unavailable;
      permits: PermitsSection | Unavailable;
      /** Absent in records cached before the appeals preview shipped. */
      appeals?: AppealsSection | Unavailable;
    }
);

/** v3: current_median counts dwellings only (not parking stalls or storage; "40S" is a home). */
const RECORDS_VERSION = "v3";

/** Cache identity: a corrected plan or address must not hit a stale entry. */
export function identityKey(input: CityRecordsInput): string {
  const plans = [...new Set(input.planCandidates.map(normalizePlanNumber).filter(Boolean))];
  // Bump RECORDS_VERSION when the cached shape or a computed field changes,
  // so stale cache entries are ignored instead of served for 24h.
  return `${RECORDS_VERSION}|plans:${plans.join(",")}|addr:${normalizeStreetAddress(input.address) ?? ""}`;
}

export interface CityRecordsCache {
  get(key: string): Promise<CityRecords | null>;
  set(key: string, value: CityRecords): Promise<void>;
}

/** Process-local cache — used when SurrealDB isn't configured. */
export function memoryCache(store = new Map<string, CityRecords>()): CityRecordsCache {
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value) {
      store.set(key, value);
    },
  };
}

const sharedMemoryCache = memoryCache();

const errMessage = (e: unknown) =>
  e instanceof CityDataError ? e.message : e instanceof Error ? e.message : String(e);

function mostCommon(vals: (string | null)[], max: number): string[] {
  const counts = new Map<string, number>();
  for (const v of vals) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([v]) => v);
}

/** Fetch everything the City's data says about the building (uncached). */
export async function fetchCityRecords(
  input: CityRecordsInput,
  now: Date,
  opts: SocrataOptions = {}
): Promise<CityRecords> {
  const base = { identity_key: identityKey(input), fetched_at: now.toISOString() };
  let match;
  try {
    match = await matchBuilding(input, opts);
  } catch (e) {
    return { ...base, status: "unavailable", message: errMessage(e) };
  }
  if (!match.matched) {
    return { ...base, status: "no_match", reason: match.reason, tried: match.tried };
  }
  const units = match.units;
  const addresses = mostCommon(units.map((u) => stripUnitFromRollAddress(u.address)), 3);
  const thisYear = now.getUTCFullYear();

  const valuesP = (async (): Promise<ValuesSection> => {
    const rolls = units.map((u) => u.roll_number);
    const history = await fetchHistory(rolls, opts);
    const buildingYears = summarizeByYear(mergeYears(history, currentYearValues(units, thisYear)));
    const basis = similarityBasis(units);
    const section: ValuesSection = {
      status: "ok",
      trend: buildTrend(buildingYears, []),
      history_url: historyQueryUrl(rolls),
      basis,
      comparables: [],
    };
    if (!basis) return section;
    try {
      const compUnits = await fetchComparableUnits(basis, opts);
      const comps = [];
      let budget = MAX_COMPARABLE_ROLLS;
      for (const c of pickComparables(compUnits, match.plan, units.length)) {
        if (c.roll_numbers.length > budget) continue;
        budget -= c.roll_numbers.length;
        comps.push(c);
      }
      const compHistory = await fetchHistory(comps.flatMap((c) => c.roll_numbers), opts);
      const compYears = comps.map((c) => {
        const set = new Set(c.roll_numbers);
        const current = currentYearValues(
          compUnits.filter((u) => set.has(u.roll_number)),
          thisYear
        );
        return summarizeByYear(mergeYears(compHistory.filter((h) => set.has(h.roll_number)), current));
      });
      section.trend = buildTrend(buildingYears, compYears);
      section.comparables = comps.map((c) => ({
        plan: c.plan,
        units: c.units,
        median_current: c.median_current,
        source_url: resourceUrl(CALGARY_DATASETS.currentRoll, { $where: planWhere(c.plan) }),
      }));
    } catch (e) {
      section.comparables_error = errMessage(e);
    }
    return section;
  })();

  const permitsP = (async (): Promise<PermitsSection> => {
    const since = lookbackStart(now);
    if (addresses.length === 0) {
      return { status: "ok", since, items: [], query_url: datasetPageUrl(CALGARY_DATASETS.permits) };
    }
    const { permits, query_url } = await fetchMajorPermits(addresses, now, opts);
    return { status: "ok", since, items: permits, query_url };
  })();

  const appealsP = fetchBuildingAppeals(
    units.map((u) => u.address).filter((a): a is string => !!a),
    opts
  );

  const [values, permits, appeals] = await Promise.allSettled([valuesP, permitsP, appealsP]);
  const currentValues = units.map((u) => u.assessed_value).filter((v): v is number => v != null && v > 0);
  // The median "unit" is a median home: stalls, lockers and non-residential entries left out.
  const dwellingValues = dwellingUnits(units).map((u) => u.assessed_value as number);
  const yoc = units.map((u) => u.year_of_construction).find((y): y is number => !!y) ?? null;

  return {
    ...base,
    status: "matched",
    plan: match.plan,
    method: match.method,
    roll_query_url: resourceUrl(CALGARY_DATASETS.currentRoll, { $where: planWhere(match.plan) }),
    roll_year: units.find((u) => u.roll_year)?.roll_year ?? null,
    unit_count: units.length,
    residential_unit_count: units.filter((u) => (u.assessment_class ?? "").toUpperCase().startsWith("RE")).length,
    building_addresses: addresses,
    comm_name: units.find((u) => u.comm_name)?.comm_name ?? null,
    year_of_construction: yoc,
    values:
      values.status === "fulfilled" ? values.value : { status: "unavailable", message: errMessage(values.reason) },
    permits:
      permits.status === "fulfilled" ? permits.value : { status: "unavailable", message: errMessage(permits.reason) },
    current_total: currentValues.length ? currentValues.reduce((a, b) => a + b, 0) : null,
    current_median: dwellingValues.length ? median(dwellingValues) : null,
    appeals:
      appeals.status === "fulfilled" ? appeals.value : { status: "unavailable", message: errMessage(appeals.reason) },
  };
}

/**
 * City records for a building, served from cache when fresh (< 24h) and
 * for the same identity. Never throws.
 */
export async function getCityRecords(
  input: CityRecordsInput,
  opts: SocrataOptions & { cache?: CityRecordsCache; cacheKey?: string; now?: Date } = {}
): Promise<{ records: CityRecords; fromCache: boolean }> {
  const now = opts.now ?? new Date();
  const cache = opts.cache ?? sharedMemoryCache;
  const key = opts.cacheKey ?? identityKey(input);
  const idKey = identityKey(input);
  try {
    const cached = await cache.get(key);
    if (
      cached &&
      cached.identity_key === idKey &&
      now.getTime() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS
    ) {
      return { records: cached, fromCache: true };
    }
  } catch {
    /* a broken cache is a miss */
  }
  const records = await fetchCityRecords(input, now, opts);
  if (records.status !== "unavailable") {
    try {
      await cache.set(key, records);
    } catch {
      /* caching is best-effort */
    }
  }
  return { records, fromCache: false };
}

/* ------------------------------------------------------------------ */
/* Per-report assessment (pure)                                        */
/* ------------------------------------------------------------------ */

export type CheckStatus = "match" | "mismatch" | "unknown";

export interface IdentityCheck {
  plan: { docs: string[]; roll: string; status: CheckStatus };
  units: { docs: number | null; roll: number; roll_residential: number; status: CheckStatus };
  address: { docs: string | null; docs_normalized: string | null; roll: string[]; status: CheckStatus };
}

export interface PermitWithMention {
  permit: MajorPermit;
  mention: MentionCheck;
}

export interface PublicRecordCheck {
  records: CityRecords;
  identity: IdentityCheck | null;
  permits: PermitWithMention[];
}

export interface ReportContext {
  docPlans: string[];
  docAddress: string | null;
  docUnits: number | null;
  docs: SearchableDoc[];
}

export function buildIdentityCheck(
  records: Extract<CityRecords, { status: "matched" }>,
  ctx: Pick<ReportContext, "docPlans" | "docAddress" | "docUnits">
): IdentityCheck {
  const docPlans = [...new Set(ctx.docPlans.map(normalizePlanNumber).filter((p): p is string => !!p))];
  const docNorm = normalizeStreetAddress(ctx.docAddress);
  return {
    plan: {
      docs: docPlans,
      roll: records.plan,
      status: docPlans.length === 0 ? "unknown" : docPlans.includes(records.plan) ? "match" : "mismatch",
    },
    units: {
      docs: ctx.docUnits,
      roll: records.unit_count,
      roll_residential: records.residential_unit_count,
      status:
        ctx.docUnits == null
          ? "unknown"
          : ctx.docUnits === records.unit_count || ctx.docUnits === records.residential_unit_count
            ? "match"
            : "mismatch",
    },
    address: {
      docs: ctx.docAddress,
      docs_normalized: docNorm,
      roll: records.building_addresses,
      status: !docNorm ? "unknown" : records.building_addresses.includes(docNorm) ? "match" : "mismatch",
    },
  };
}

/** Compare the City records with one report's documents. */
export function assessReport(records: CityRecords, ctx: ReportContext): PublicRecordCheck {
  if (records.status !== "matched") return { records, identity: null, permits: [] };
  const permits =
    records.permits.status === "ok"
      ? records.permits.items.map((permit) => ({ permit, mention: checkMentions(permit.categories, ctx.docs) }))
      : [];
  return { records, identity: buildIdentityCheck(records, ctx), permits };
}
