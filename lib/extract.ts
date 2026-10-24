import { extractText } from "unpdf";

export type ExtractionStatus = "extracted" | "ocr" | "failed";

export interface PageText {
  /** 1-based page number within the file. */
  page: number;
  text: string;
}

export interface ExtractedDoc {
  /** Stable id assigned by the caller, e.g. "file-0". Cited by Claude in evidence. */
  fileId: string;
  filename: string;
  pages: PageText[];
  /** Page count capped at maxTextPages() for the text path. */
  pageCount: number;
  /** True page count, uncapped — the OCR path uses this (100-page ceiling).
   *  Present when known (always set by extractPdfText). */
  totalPages?: number;
  /** True when pages/chars were dropped by the maxTextPages()/maxTextChars() caps.
   *  Optional: only the extraction step sets it; the run route rebuilds
   *  a partial doc for prompt rendering and doesn't need it. */
  truncated?: boolean;
  charCount: number;
  status: ExtractionStatus;
  /** True when the file was detected as scanned/image-only. */
  isScanned: boolean;
}

/** Max pages of text extracted per doc. Tunable via MAX_TEXT_PAGES. */
export function maxTextPages(): number {
  const v = Number(process.env.MAX_TEXT_PAGES);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 100;
}

/** Max characters of text kept per doc. Tunable via MAX_TEXT_CHARS. */
export function maxTextChars(): number {
  const v = Number(process.env.MAX_TEXT_CHARS);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 150_000;
}

/** Pages below this many extracted characters are treated as image-only. Configurable. */
export function scanThresholdChars(): number {
  const v = Number(process.env.SCAN_TEXT_THRESHOLD_CHARS);
  return Number.isFinite(v) && v > 0 ? v : 50;
}

/** Joined text of all pages, with explicit page markers for the analysis prompt. */
export function docTextWithPageMarkers(doc: ExtractedDoc): string {
  return doc.pages
    .map((p) => `--- page ${p.page} ---\n${p.text}`)
    .join("\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/** Plain joined text (no markers) — for classification and search. */
export function docPlainText(doc: ExtractedDoc): string {
  return doc.pages
    .map((p) => p.text)
    .join("\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/**
 * Extract per-page text from a PDF buffer.
 *
 * Never throws for scanned documents: those come back with isScanned=true and
 * (near-)empty page text so the caller can route them to the OCR fallback.
 * Throws a user-friendly error only when the file is not a readable PDF at all.
 */
export async function extractPdfText(
  fileId: string,
  filename: string,
  data: Uint8Array
): Promise<ExtractedDoc> {
  let result: { totalPages: number; text: string[] };
  try {
    // unpdf transfers (detaches) the input buffer — pass a copy so the
    // caller's bytes stay usable (the start route reuses them for OCR).
    result = await extractText(data.slice());
  } catch (err) {
    throw new Error(
      `Could not read "${filename}" as a PDF. It may be corrupted or password-protected.`
    );
  }

  const threshold = scanThresholdChars();
  const maxPages = maxTextPages();
  const maxChars = maxTextChars();
  const rawPages = result.text.slice(0, maxPages);
  const pages: PageText[] = rawPages.map((t, i) => ({
    page: i + 1,
    text: (t || "").replace(/[ \t]+\n/g, "\n").trim(),
  }));

  const isScanned =
    pages.length > 0 && pages.every((p) => p.text.length < threshold);

  let charCount = pages.reduce((n, p) => n + p.text.length, 0);

  // Track whether content was dropped so the UI can say so honestly —
  // a 200-page PDF analyzed as 100 pages must never look complete.
  const truncated =
    result.totalPages > maxPages || charCount > maxChars;

  // Hard cap on total characters: truncate from the last page backwards.
  if (charCount > maxChars && !isScanned) {
    let remaining = maxChars;
    for (const p of pages) {
      if (p.text.length <= remaining) {
        remaining -= p.text.length;
      } else {
        p.text = p.text.slice(0, remaining);
        remaining = 0;
      }
    }
    charCount = maxChars;
  }

  return {
    fileId,
    filename,
    pages,
    pageCount: Math.min(result.totalPages, maxPages),
    totalPages: result.totalPages,
    truncated,
    charCount,
    status: "extracted",
    isScanned,
  };
}

const SEP = "[\\s_-]*";
const rx = (s: string) => new RegExp(s.replace(/ /g, SEP));

/**
 * Title-first order, for the filename and the document header: a title
 * says what the document IS ("Minutes of the Annual General Meeting"),
 * while "reserve fund" turns up in nearly every minutes body.
 */
const TITLE_RULES: [RegExp, string][] = [
  [rx("estoppel|information statement|form 26|unit information"), "info_statement"],
  [rx("annual general meeting|\\bagm\\b"), "minutes_agm"],
  [/minutes/, "minutes_board"],
  [rx("reserve fund"), "reserve_study"],
  [/by[\s-]?laws?/, "bylaws"],
  [rx("financial statement|\\baudit"), "financials"],
  [/budget/, "budget"],
  [/insurance/, "insurance"],
];

/** Body order (fallback): the original keyword priority. */
const BODY_RULES: [RegExp, string][] = [
  [/reserve fund/, "reserve_study"],
  [/estoppel|information statement|form 26|unit information/, "info_statement"],
  [/annual general meeting|\bagm\b/, "minutes_agm"],
  [/minutes/, "minutes_board"],
  [/by-?law/, "bylaws"],
  [/budget/, "budget"],
  [/financial statement|audit/, "financials"],
  [/insurance/, "insurance"],
];

/** Header window: long enough to get past a watermark line to the title. */
const HEADER_CHARS = 500;

/**
 * Classify a document: filename first, then its header (title), then the
 * first chunk of body text. Deterministic.
 */
export function classifyDocType(filename: string, text: string): string {
  // "agm_minutes.pdf" -> "agm minutes": "_" is a word char, so \b would miss.
  const name = filename.toLowerCase().replace(/\.pdf$/, "").replace(/[_.\-]+/g, " ");
  const passes: [string, [RegExp, string][]][] = [
    [name, TITLE_RULES],
    [text.slice(0, HEADER_CHARS).toLowerCase(), TITLE_RULES],
    [text.slice(0, 2000).toLowerCase(), BODY_RULES],
  ];
  for (const [hay, rules] of passes) {
    for (const [re, type] of rules) if (re.test(hay)) return type;
  }
  return "other";
}
