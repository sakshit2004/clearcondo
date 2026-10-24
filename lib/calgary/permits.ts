/**
 * Major building permits at a condo's address, and whether the uploaded
 * documents mention the same kind of work.
 *
 * "Major" means the permit text names one of five capital categories: roof,
 * envelope, parkade, balcony, structural. A permit is flagged "not mentioned"
 * ONLY when a keyword search of every extracted page finds none of its
 * categories' terms — and the UI shows exactly which terms and documents
 * were searched, so the buyer can check the claim.
 */
import {
  CALGARY_DATASETS,
  parseMoney,
  resourceUrl,
  soql,
  soqlString,
  str,
  type SocrataOptions,
  type SocrataRow,
} from "./socrata.ts";
import { stripUnitFromRollAddress } from "./match.ts";

export const PERMIT_CATEGORIES = ["roof", "envelope", "parkade", "balcony", "structural"] as const;
export type PermitCategory = (typeof PERMIT_CATEGORIES)[number];

export const PERMIT_CATEGORY_LABELS: Record<PermitCategory, string> = {
  roof: "Roof",
  envelope: "Building envelope",
  parkade: "Parkade",
  balcony: "Balconies",
  structural: "Structural",
};

/** Terms that classify a permit's own text into a category. */
const PERMIT_TERMS: Record<PermitCategory, string[]> = {
  roof: ["roof", "roofing", "re-roof", "reroof", "shingle", "shingles"],
  envelope: [
    "envelope", "cladding", "siding", "stucco", "exterior wall", "exterior walls",
    "window replacement", "replace windows", "masonry", "brick", "facade", "façade",
    "curtain wall", "rainscreen",
  ],
  parkade: ["parkade", "parking garage", "underground parking", "parking structure"],
  balcony: ["balcony", "balconies"],
  structural: [
    "structural", "foundation", "shoring", "underpinning", "load bearing",
    "load-bearing", "beam", "beams", "column", "columns", "slab",
  ],
};

/**
 * Terms searched in the documents. Broader than PERMIT_TERMS on purpose:
 * minutes say "the roof project" or "membrane repairs", and a false "not
 * mentioned" is worse than a missed flag.
 */
export const DOC_SEARCH_TERMS: Record<PermitCategory, string[]> = {
  roof: ["roof", "roofs", "roofing", "re-roof", "reroof", "shingle", "shingles"],
  envelope: [
    "envelope", "cladding", "siding", "stucco", "exterior wall", "exterior walls",
    "window", "windows", "masonry", "brick", "facade", "façade", "caulking",
    "sealant", "rainscreen", "curtain wall",
  ],
  parkade: ["parkade", "parking garage", "underground parking", "garage", "membrane"],
  balcony: ["balcony", "balconies", "railing", "railings"],
  structural: [
    "structural", "structure", "foundation", "shoring", "underpinning", "slab",
    "beam", "beams", "column", "columns", "engineer", "engineering",
  ],
};

function termRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[\\s-]+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
}

/** Categories a permit's text falls into (empty = not a major permit). */
export function classifyPermit(text: string): PermitCategory[] {
  return PERMIT_CATEGORIES.filter((c) => PERMIT_TERMS[c].some((t) => termRegex(t).test(text)));
}

/* ------------------------------------------------------------------ */
/* Document keyword search (pure)                                      */
/* ------------------------------------------------------------------ */

export interface SearchableDoc {
  filename: string;
  docType: string;
  pages: { page: number; text: string }[];
}

export interface MentionHit {
  filename: string;
  page: number;
  term: string;
}

export type MentionCheck =
  | {
      status: "mentioned";
      hits: MentionHit[];
      searchedTerms: string[];
      searchedDocs: string[];
    }
  | {
      status: "not_mentioned";
      searchedTerms: string[];
      searchedDocs: string[];
      /** True when at least one minutes document was searched. */
      minutesSearched: boolean;
    }
  | { status: "not_run"; reason: string };

const MINUTES_TYPES = new Set(["minutes_board", "minutes_agm"]);

/**
 * Search the extracted pages for any of the categories' terms. Without any
 * page text there is nothing to search, so the check is "not_run" — never
 * "not mentioned".
 */
export function checkMentions(categories: PermitCategory[], docs: SearchableDoc[]): MentionCheck {
  const withText = docs.filter((d) => d.pages.some((p) => p.text && p.text.trim().length > 0));
  if (withText.length === 0) {
    return {
      status: "not_run",
      reason: "No extracted document text is available for this report, so the documents weren't searched.",
    };
  }
  const searchedTerms = [...new Set(categories.flatMap((c) => DOC_SEARCH_TERMS[c]))];
  const searchedDocs = withText.map((d) => d.filename);
  const hits: MentionHit[] = [];
  for (const term of searchedTerms) {
    const re = termRegex(term);
    for (const d of withText) {
      const p = d.pages.find((pg) => re.test(pg.text));
      if (p) {
        hits.push({ filename: d.filename, page: p.page, term });
        break; // one hit per term is enough to show the evidence
      }
    }
  }
  if (hits.length > 0) return { status: "mentioned", hits, searchedTerms, searchedDocs };
  return {
    status: "not_mentioned",
    searchedTerms,
    searchedDocs,
    minutesSearched: withText.some((d) => MINUTES_TYPES.has(d.docType)),
  };
}

/* ------------------------------------------------------------------ */
/* Permits (network)                                                   */
/* ------------------------------------------------------------------ */

export interface MajorPermit {
  permit_number: string;
  address: string | null;
  issued_date: string | null;
  applied_date: string | null;
  status: string | null;
  description: string;
  work_class: string | null;
  declared_value_cad: number | null;
  categories: PermitCategory[];
  source_url: string;
}

/** How far back "recent" permits go. */
export const PERMIT_LOOKBACK_YEARS = 5;

export function lookbackStart(now: Date, years = PERMIT_LOOKBACK_YEARS): string {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

/** Row -> MajorPermit, or null when the row isn't a major permit at the address. */
export function toMajorPermit(
  row: SocrataRow,
  buildingAddresses: Set<string>,
  since: string
): MajorPermit | null {
  const num = str(row, "permitnum", "permit_number");
  if (!num) return null;
  const address = str(row, "originaladdress", "address");
  if (!buildingAddresses.has(stripUnitFromRollAddress(address) ?? "")) return null;
  const issued = str(row, "issueddate");
  const applied = str(row, "applieddate");
  const date = (issued ?? applied ?? "").slice(0, 10);
  if (!date || date < since) return null;
  const description = str(row, "description") ?? "";
  const workClass = str(row, "workclassmapped", "workclass");
  const categories = classifyPermit(
    [description, workClass, str(row, "permitclassmapped", "permitclass")].filter(Boolean).join(" · ")
  );
  if (categories.length === 0) return null;
  return {
    permit_number: num,
    address,
    issued_date: issued ? issued.slice(0, 10) : null,
    applied_date: applied ? applied.slice(0, 10) : null,
    status: str(row, "statuscurrent"),
    description: description || workClass || "No description",
    work_class: workClass,
    declared_value_cad: parseMoney(row.estprojectcost),
    categories,
    source_url: resourceUrl(CALGARY_DATASETS.permits, { permitnum: num }),
  };
}

/** SoQL $where for permits at the building's civic addresses since a date. */
export function permitsWhere(addresses: string[], since: string): string {
  const addr = addresses.map((a) => `upper(originaladdress) like ${soqlString(`%${a}%`)}`).join(" OR ");
  const date = `(issueddate >= ${soqlString(since)} OR applieddate >= ${soqlString(since)})`;
  return `(${addr}) AND ${date}`;
}

/** Fetch major permits at the building's addresses in the lookback window. */
export async function fetchMajorPermits(
  addresses: string[],
  now: Date,
  opts: SocrataOptions = {}
): Promise<{ permits: MajorPermit[]; query_url: string }> {
  const since = lookbackStart(now);
  const params = {
    $where: permitsWhere(addresses, since),
    $order: "issueddate DESC",
    $limit: "500",
  };
  const rows = await soql(CALGARY_DATASETS.permits, params, opts);
  const addrSet = new Set(addresses);
  const seen = new Set<string>();
  const permits: MajorPermit[] = [];
  for (const r of rows) {
    const p = toMajorPermit(r, addrSet, since);
    if (p && !seen.has(p.permit_number)) {
      seen.add(p.permit_number);
      permits.push(p);
    }
  }
  permits.sort((a, b) => (b.issued_date ?? b.applied_date ?? "").localeCompare(a.issued_date ?? a.applied_date ?? ""));
  return { permits, query_url: resourceUrl(CALGARY_DATASETS.permits, params) };
}
