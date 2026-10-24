/**
 * Matching a condo building to City of Calgary assessment-roll rows.
 *
 * Primary key: the condominium plan number. Every condo unit on the roll has
 * a short_legal of the form "<plan>;<unit>", so the building is exactly the
 * set of rows whose prefix before ';' equals the plan. Fallback: the
 * normalized street address — accepted only when the address is in Calgary
 * and every matching row belongs to ONE plan. Anything less confident is a
 * no-match; we never guess.
 */
import {
  CALGARY_DATASETS,
  normalizeRollNumber,
  parseMoney,
  soql,
  soqlString,
  str,
  type SocrataOptions,
  type SocrataRow,
} from "./socrata.ts";

export interface RollUnit {
  roll_number: string;
  address: string | null;
  short_legal: string;
  assessed_value: number | null;
  assessment_class: string | null;
  property_type: string | null;
  sub_property_use: string | null;
  comm_code: string | null;
  comm_name: string | null;
  year_of_construction: number | null;
  roll_year: number | null;
}

/* ------------------------------------------------------------------ */
/* Plan numbers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Normalize a plan number: uppercase, no spaces/dashes, optional "PLAN"
 * prefix removed. Alberta condo plans are mostly 7 digits ("0812345"), older
 * ones mix letters ("7810AB"); require at least 4 digits so a stray word
 * never becomes a plan.
 */
export function normalizePlanNumber(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s
    .toUpperCase()
    .replace(/^(CONDOMINIUM\s+)?(CORPORATION|CORP\.?|PLAN)\s*(NO\.?|NUMBER|#)?/, "")
    .replace(/[\s\-.#]/g, "");
  if (!/^[0-9A-Z]{5,10}$/.test(t)) return null;
  if ((t.match(/\d/g) ?? []).length < 4) return null;
  return t;
}

/** The plan part of a short_legal ("0812345;12" -> "0812345"). */
export function planPrefix(shortLegal: string | null | undefined): string | null {
  if (!shortLegal || !shortLegal.includes(";")) return null;
  return normalizePlanNumber(shortLegal.split(";")[0]);
}

// "Condominium Plan No. 0812345", "Condo Plan 081 2345", "condominium plan 9311AB".
const PLAN_IN_TEXT =
  /condo(?:minium)?\s+plan\s*(?:no\.?|number|#)?\s*[:.]?\s*(\d{3}[ \-]\d{4}(?!\d)|\d{4,10}[A-Za-z]{0,3}(?![A-Za-z0-9]))/gi;

/** Plan numbers stated in document text, in order of first appearance. */
export function extractPlanNumbers(texts: string[]): string[] {
  const out = new Set<string>();
  for (const text of texts) {
    for (const m of text.matchAll(PLAN_IN_TEXT)) {
      const n = normalizePlanNumber(m[1]);
      if (n) out.add(n);
    }
  }
  return [...out];
}

/* ------------------------------------------------------------------ */
/* Addresses                                                           */
/* ------------------------------------------------------------------ */

const STREET_TYPES: Record<string, string> = {
  AVENUE: "AV", AVE: "AV", AV: "AV",
  STREET: "ST", STR: "ST", ST: "ST",
  ROAD: "RD", RD: "RD",
  DRIVE: "DR", DR: "DR",
  BOULEVARD: "BV", BLVD: "BV", BV: "BV",
  TRAIL: "TR", TRL: "TR", TR: "TR",
  CRESCENT: "CR", CRES: "CR", CR: "CR",
  PLACE: "PL", PL: "PL",
  COURT: "CO", CRT: "CO", CT: "CO",
  TERRACE: "TC", TERR: "TC", TC: "TC",
  WAY: "WY", WY: "WY",
  GATE: "GA", GA: "GA",
  CIRCLE: "CI", CIR: "CI",
  CLOSE: "CL",
  GREEN: "GR",
  HEIGHTS: "HT", HTS: "HT",
  HILL: "HL", HILLS: "HL",
  LANE: "LN",
  PARK: "PA",
  POINT: "PT",
  SQUARE: "SQ", SQ: "SQ",
  VIEW: "VW", VW: "VW",
  MEWS: "ME",
  LANDING: "LD",
  PARADE: "PR",
  RISE: "RI",
  MANOR: "MR",
};

const QUADRANTS: Record<string, string> = {
  NORTHWEST: "NW", NORTHEAST: "NE", SOUTHWEST: "SW", SOUTHEAST: "SE",
  NW: "NW", NE: "NE", SW: "SW", SE: "SE",
};

const POSTAL = /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/;

/**
 * Normalize a street address to the City roll's style: "1111 6 AV SW".
 * Drops unit designators (#1203, Unit 1203, "1203-1111"), city, province,
 * postal code and punctuation; abbreviates street types and quadrants;
 * strips ordinal suffixes (6th -> 6). Returns null without a civic number.
 */
export function normalizeStreetAddress(s: string | null | undefined): string | null {
  if (!s) return null;
  let t = s.toUpperCase().replace(POSTAL, " ");
  // "#1203, 1111 6 Ave" / "Unit 1203 - 1111 6 Ave" / "Suite 5"
  t = t.replace(/\b(UNIT|SUITE|APT|APARTMENT)\s*#?\s*[0-9A-Z]+\b[\s,\-]*/g, " ");
  t = t.replace(/#\s*[0-9A-Z]+[\s,\-]*/g, " ");
  // "1203-1111 6 Ave SW" -> "1111 6 Ave SW"
  t = t.replace(/^\s*[0-9]+[A-Z]?\s*-\s*(?=[0-9])/, "");
  const segments = t.split(",").map((x) => x.trim()).filter(Boolean);
  const street = segments.find((seg) => /^[0-9]+[A-Z]?\s+\S/.test(seg));
  if (!street) return null;
  const tokens = street
    .replace(/[.']/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .filter((tok) => tok !== "CALGARY" && tok !== "AB" && tok !== "ALBERTA")
    .map((tok, i) => {
      if (i > 0 && /^[0-9]+(ST|ND|RD|TH)$/.test(tok)) return tok.replace(/(ST|ND|RD|TH)$/, "");
      if (i > 0 && STREET_TYPES[tok]) return STREET_TYPES[tok];
      if (QUADRANTS[tok]) return QUADRANTS[tok];
      return tok;
    });
  return tokens.length >= 2 ? tokens.join(" ") : null;
}

/**
 * A roll address for a unit may carry the unit number first
 * ("1203 1111 6 AV SW"). Drop a leading number when the next token is also a
 * civic number, leaving the building's street address.
 */
export function stripUnitFromRollAddress(addr: string | null | undefined): string | null {
  const n = normalizeStreetAddress(addr);
  if (!n) return null;
  const tokens = n.split(" ");
  const civic = /^[0-9]+[A-Z]?$/;
  const streetTypes = new Set(Object.values(STREET_TYPES));
  // "1111 6 AV SW" is number + numbered street; "1203 1111 6 AV SW" and
  // "1203 1111 MAIN ST" carry a unit first.
  if (tokens.length >= 3 && civic.test(tokens[0]) && civic.test(tokens[1]) && !streetTypes.has(tokens[2])) {
    return tokens.slice(1).join(" ");
  }
  return n;
}

export type CalgaryScope = "calgary" | "outside" | "unknown";

/** Is this address in Calgary, clearly elsewhere, or unstated? */
export function calgaryScope(address: string | null | undefined): CalgaryScope {
  if (!address) return "unknown";
  const up = address.toUpperCase();
  if (/\bCALGARY\b/.test(up)) return "calgary";
  const postal = up.match(POSTAL)?.[0];
  if (postal) return /^(T2|T3|T1Y)/.test(postal.replace(/\s/g, "")) ? "calgary" : "outside";
  // "123 Main St, Edmonton" — a city segment that isn't Calgary.
  const segments = up.split(",").map((s) => s.trim()).filter(Boolean);
  const citySeg = segments.slice(1).find((s) => !/^(AB|ALBERTA|CANADA)$/.test(s));
  return citySeg ? "outside" : "unknown";
}

/* ------------------------------------------------------------------ */
/* Roll rows                                                           */
/* ------------------------------------------------------------------ */

export function toRollUnit(row: SocrataRow): RollUnit | null {
  const roll = normalizeRollNumber(row.roll_number);
  const shortLegal = str(row, "short_legal");
  if (!roll || !shortLegal) return null;
  const yoc = parseMoney(row.year_of_construction);
  const year = parseMoney(row.roll_year);
  return {
    roll_number: roll,
    address: str(row, "address"),
    short_legal: shortLegal,
    assessed_value: parseMoney(row.assessed_value),
    assessment_class: str(row, "assessment_class"),
    property_type: str(row, "property_type"),
    sub_property_use: str(row, "sub_property_use"),
    comm_code: str(row, "comm_code"),
    comm_name: str(row, "comm_name"),
    year_of_construction: yoc,
    roll_year: year,
  };
}

/** Rows -> units, deduplicated by roll number (the roll has duplicates). */
export function toRollUnits(rows: SocrataRow[]): RollUnit[] {
  const byRoll = new Map<string, RollUnit>();
  for (const r of rows) {
    const u = toRollUnit(r);
    if (u && !byRoll.has(u.roll_number)) byRoll.set(u.roll_number, u);
  }
  return [...byRoll.values()];
}

/** Units whose short_legal plan prefix equals the plan exactly. */
export function unitsForPlan(units: RollUnit[], plan: string): RollUnit[] {
  return units.filter((u) => planPrefix(u.short_legal) === plan);
}

/* ------------------------------------------------------------------ */
/* The match decision (pure)                                           */
/* ------------------------------------------------------------------ */

export type MatchMethod = "plan_number" | "address";

export type MatchDecision =
  | { matched: true; plan: string; method: MatchMethod; units: RollUnit[] }
  | { matched: false; reason: string };

/**
 * Decide the plan-number match from candidate plans and the roll rows the
 * query returned. Exactly one candidate plan must have rows; two candidates
 * that both hit the roll is ambiguous, and ambiguity is a no-match.
 */
export function decidePlanMatch(candidates: string[], units: RollUnit[]): MatchDecision {
  const hits = candidates
    .map((plan) => ({ plan, units: unitsForPlan(units, plan) }))
    .filter((h) => h.units.length > 0);
  if (hits.length === 1) {
    return { matched: true, plan: hits[0].plan, method: "plan_number", units: hits[0].units };
  }
  if (hits.length > 1) {
    return {
      matched: false,
      reason: `The documents mention more than one condo plan on the roll (${hits
        .map((h) => h.plan)
        .join(", ")}).`,
    };
  }
  return {
    matched: false,
    reason: candidates.length
      ? `No assessment-roll rows for plan ${candidates.join(", ")}.`
      : "No condominium plan number found in the documents.",
  };
}

/**
 * Decide the address fallback: rows whose building street address equals
 * the normalized address, all under ONE plan prefix.
 */
export function decideAddressMatch(normAddress: string, units: RollUnit[]): MatchDecision {
  const atAddress = units.filter((u) => stripUnitFromRollAddress(u.address) === normAddress);
  const plans = [...new Set(atAddress.map((u) => planPrefix(u.short_legal)).filter((p): p is string => !!p))];
  if (plans.length === 1) {
    return { matched: true, plan: plans[0], method: "address", units: [] };
  }
  if (plans.length > 1) {
    return {
      matched: false,
      reason: `More than one condo plan is registered at ${normAddress} (${plans.join(", ")}).`,
    };
  }
  return { matched: false, reason: `No condo units on the roll at ${normAddress}.` };
}

/* ------------------------------------------------------------------ */
/* The match (network)                                                 */
/* ------------------------------------------------------------------ */

export interface BuildingIdentityInput {
  /** Plan numbers stated in the document text, most trusted first. */
  planCandidates: string[];
  address: string | null;
}

export interface MatchQuery {
  /** SoQL $where used to fetch the plan's rows — becomes the source link. */
  where: string;
}

/** SoQL $where for one plan's rows. */
export function planWhere(plan: string): string {
  return `short_legal like ${soqlString(`${plan};%`)}`;
}

async function fetchPlanUnits(plans: string[], opts: SocrataOptions): Promise<RollUnit[]> {
  const rows = await soql(
    CALGARY_DATASETS.currentRoll,
    { $where: plans.map(planWhere).join(" OR "), $limit: "5000" },
    opts
  );
  return toRollUnits(rows);
}

/**
 * Match a building to the current roll. Throws CityDataError when the City
 * API fails (the caller renders "City data unavailable"); returns a
 * no-match decision when the data answered but nothing matched confidently.
 */
export async function matchBuilding(
  input: BuildingIdentityInput,
  opts: SocrataOptions = {}
): Promise<MatchDecision & { tried: string[] }> {
  const tried: string[] = [];
  const candidates = [...new Set(input.planCandidates.map(normalizePlanNumber).filter((p): p is string => !!p))];

  if (candidates.length > 0) {
    tried.push(`condo plan ${candidates.join(", ")}`);
    const units = await fetchPlanUnits(candidates, opts);
    const decision = decidePlanMatch(candidates, units);
    if (decision.matched || /more than one/.test(decision.reason)) {
      return { ...decision, tried };
    }
  }

  // Fallback: normalized address — Calgary addresses only.
  const norm = normalizeStreetAddress(input.address);
  if (!norm || calgaryScope(input.address) !== "calgary") {
    return {
      matched: false,
      reason: norm
        ? "The address isn't confirmed as Calgary, so it wasn't used for matching."
        : candidates.length
          ? `No assessment-roll rows for plan ${candidates.join(", ")}, and no usable street address.`
          : "No condominium plan number or usable street address in the documents.",
      tried,
    };
  }
  tried.push(`address ${norm}`);
  const rows = await soql(
    CALGARY_DATASETS.currentRoll,
    {
      $where: `upper(address) like ${soqlString(`%${norm}`)} AND short_legal like '%;%'`,
      $limit: "5000",
    },
    opts
  );
  const byAddress = decideAddressMatch(norm, toRollUnits(rows));
  if (!byAddress.matched) return { ...byAddress, tried };
  // Re-fetch the whole plan: units at other civic addresses belong too.
  const units = await fetchPlanUnits([byAddress.plan], opts);
  const planUnits = unitsForPlan(units, byAddress.plan);
  if (planUnits.length === 0) {
    return { matched: false, reason: `No assessment-roll rows for plan ${byAddress.plan}.`, tried };
  }
  return { matched: true, plan: byAddress.plan, method: "address", units: planUnits, tried };
}
