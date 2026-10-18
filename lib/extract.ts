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
  /** Page count capped at MAX_PAGES for the text path. */
  pageCount: number;
  /** True page count, uncapped — the OCR path uses this (100-page ceiling).
   *  Present when known (always set by extractPdfText). */
  totalPages?: number;
  /** True when pages/chars were dropped by the MAX_PAGES / MAX_CHARS caps.
   *  Optional: only the extraction step sets it; the run route rebuilds
   *  a partial doc for prompt rendering and doesn't need it. */
  truncated?: boolean;
  charCount: number;
  status: ExtractionStatus;
  /** True when the file was detected as scanned/image-only. */
  isScanned: boolean;
}

const MAX_CHARS_PER_DOC = 60_000;
const MAX_PAGES = 40;

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
  const rawPages = result.text.slice(0, MAX_PAGES);
  const pages: PageText[] = rawPages.map((t, i) => ({
    page: i + 1,
    text: (t || "").replace(/[ \t]+\n/g, "\n").trim(),
  }));

  const isScanned =
    pages.length > 0 && pages.every((p) => p.text.length < threshold);

  let charCount = pages.reduce((n, p) => n + p.text.length, 0);

  // Track whether content was dropped so the UI can say so honestly —
  // a 100-page PDF analyzed as 40 pages must never look complete.
  const truncated =
    result.totalPages > MAX_PAGES || charCount > MAX_CHARS_PER_DOC;

  // Hard cap on total characters: truncate from the last page backwards.
  if (charCount > MAX_CHARS_PER_DOC && !isScanned) {
    let remaining = MAX_CHARS_PER_DOC;
    for (const p of pages) {
      if (p.text.length <= remaining) {
        remaining -= p.text.length;
      } else {
        p.text = p.text.slice(0, remaining);
        remaining = 0;
      }
    }
    charCount = MAX_CHARS_PER_DOC;
  }

  return {
    fileId,
    filename,
    pages,
    pageCount: Math.min(result.totalPages, MAX_PAGES),
    totalPages: result.totalPages,
    truncated,
    charCount,
    status: "extracted",
    isScanned,
  };
}

/** Classify a document from its filename + first chunk of text. Deterministic. */
export function classifyDocType(filename: string, text: string): string {
  const hay = `${filename} ${text.slice(0, 2000)}`.toLowerCase();
  if (/reserve fund/.test(hay)) return "reserve_study";
  if (/estoppel|information statement|form 26|unit information/.test(hay))
    return "info_statement";
  if (/annual general meeting|\bagm\b/.test(hay)) return "minutes_agm";
  if (/minutes/.test(hay)) return "minutes_board";
  if (/by-?law/.test(hay)) return "bylaws";
  if (/budget/.test(hay)) return "budget";
  if (/financial statement|audit/.test(hay)) return "financials";
  if (/insurance/.test(hay)) return "insurance";
  return "other";
}
