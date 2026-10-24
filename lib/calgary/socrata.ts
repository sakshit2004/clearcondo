/**
 * Minimal City of Calgary Open Data (Socrata SODA) client.
 *
 * Server-side only. No app token is needed at our volume; when
 * CALGARY_SOCRATA_APP_TOKEN is set it is sent as X-App-Token for a higher
 * rate limit. Every request carries its own abort timeout, and every failure
 * (network, timeout, non-2xx, non-JSON) surfaces as a CityDataError so the
 * caller can render "City data unavailable" instead of failing the report.
 */

export const CALGARY_OPEN_DATA = "https://data.calgary.ca";

export const CALGARY_DATASETS = {
  /** Current-year property assessment roll. */
  currentRoll: "4bsw-nn7w",
  /** Historical assessment rolls (values are text with thousands commas). */
  historicalRolls: "4ur7-wsgc",
  /** Building permits. */
  permits: "c2es-76ed",
} as const;

export type CalgaryDataset = (typeof CALGARY_DATASETS)[keyof typeof CALGARY_DATASETS];

export const DATASET_TITLES: Record<CalgaryDataset, string> = {
  "4bsw-nn7w": "Current Year Property Assessments",
  "4ur7-wsgc": "Historical Property Assessments",
  "c2es-76ed": "Building Permits",
};

export type SocrataRow = Record<string, unknown>;

export class CityDataError extends Error {
  readonly dataset: CalgaryDataset;
  constructor(message: string, dataset: CalgaryDataset) {
    super(message);
    this.name = "CityDataError";
    this.dataset = dataset;
  }
}

export interface SocrataOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Per-request timeout; tunable via CALGARY_DATA_TIMEOUT_MS. */
export function cityDataTimeoutMs(): number {
  const v = Number(process.env.CALGARY_DATA_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 8_000;
}

/** Human-facing dataset landing page. */
export function datasetPageUrl(dataset: CalgaryDataset): string {
  return `${CALGARY_OPEN_DATA}/d/${dataset}`;
}

/** SODA resource URL for a query — doubles as the "source row" link in the UI. */
export function resourceUrl(
  dataset: CalgaryDataset,
  params: Record<string, string>
): string {
  // encodeURIComponent (not URLSearchParams) so spaces are %20, never "+".
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return `${CALGARY_OPEN_DATA}/resource/${dataset}.json${qs ? `?${qs}` : ""}`;
}

/** Quote a string literal for SoQL (single quotes doubled). */
export function soqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/** Run one SoQL query; returns the JSON rows or throws CityDataError. */
export async function soql(
  dataset: CalgaryDataset,
  params: Record<string, string>,
  opts: SocrataOptions = {}
): Promise<SocrataRow[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? cityDataTimeoutMs();
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = process.env.CALGARY_SOCRATA_APP_TOKEN;
  if (token) headers["X-App-Token"] = token;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(resourceUrl(dataset, params), {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new CityDataError(`City data returned HTTP ${res.status}`, dataset);
    }
    const body = (await res.json()) as unknown;
    if (!Array.isArray(body)) {
      throw new CityDataError("City data returned an unexpected shape", dataset);
    }
    return body as SocrataRow[];
  } catch (err) {
    if (err instanceof CityDataError) throw err;
    const aborted =
      controller.signal.aborted ||
      (err instanceof Error && err.name === "AbortError");
    throw new CityDataError(
      aborted
        ? `City data timed out after ${timeoutMs}ms`
        : `City data request failed: ${err instanceof Error ? err.message : String(err)}`,
      dataset
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Read a field as a trimmed string (Socrata returns everything as text). */
export function str(row: SocrataRow, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

/**
 * Parse a money/number field. Historical rolls store values as text with
 * thousands separators ("1,234,500"), so strip everything but digits, a
 * decimal point and a leading minus.
 */
export function parseMoney(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Roll numbers are 9 digits; some datasets drop the leading zeros. */
export function normalizeRollNumber(v: unknown): string | null {
  if (v == null) return null;
  const digits = String(v).replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(9, "0");
}
