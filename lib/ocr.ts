/**
 * OCR fallback for scanned/image-only PDFs.
 *
 * When text extraction finds nothing readable, the PDF is sent to Claude as a
 * native PDF document input for a faithful per-page transcription. The
 * transcription then flows through the normal analysis + verification
 * pipeline; claims verified against it are labeled "verified against OCR
 * transcription" (lower confidence) in the UI.
 *
 * Why chunked: a single transcription call is capped at ~20k output tokens,
 * which at ~65 tok/s is ~300s — the entire Vercel Hobby function budget.
 * A 100-page scan would not finish in one call, so the PDF is transcribed
 * in page-range chunks with bounded concurrency. Each chunk sends the full
 * PDF (the API has no page-range input) but asks only for its range; chunks
 * run a few at a time so a 100-page scan completes in ~2-3 waves.
 *
 * Claude API limits (checked Oct 2026): 32 MB max request size, up to 100
 * pages per request for full PDF analysis. Upload caps: the text-extraction
 * path allows 15 MB per file / 100 pages per file (MAX_TEXT_PAGES,
 * default 100); the OCR path allows 30 MB / 100 pages (enforced in
 * transcribeScannedPdf). Anything larger is rejected with a clear error
 * rather than truncated silently.
 */

import Anthropic from "@anthropic-ai/sdk";
import { analysisModel, speedParams } from "./model-config.ts";
import { z } from "zod";
import type { PageText } from "./extract";

const MAX_OCR_BYTES = 30 * 1024 * 1024;
const MAX_OCR_PAGES = 100;

/** Pages per transcription chunk. Tunable via OCR_CHUNK_PAGES. */
export function ocrChunkPages(): number {
  const v = Number(process.env.OCR_CHUNK_PAGES);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 10;
}

/** Max concurrent chunk transcriptions. Tunable via OCR_MAX_CONCURRENCY. */
export function ocrMaxConcurrency(): number {
  const v = Number(process.env.OCR_MAX_CONCURRENCY);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 8;
}

/**
 * Max time for one transcription chunk call. A 10-page chunk is ~4-5k output
 * tokens (~60-90s); 120s gives margin without letting a hung call eat the
 * whole function budget. Tunable via OCR_CHUNK_TIMEOUT_MS.
 */
export function ocrChunkTimeoutMs(): number {
  const v = Number(process.env.OCR_CHUNK_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 120_000;
}

const TranscriptionSchema = z.object({
  pages: z
    .array(
      z.object({
        page: z.number().int().positive(),
        text: z.string(),
      })
    )
    .min(1),
});

/** Split 1..pageCount into [start, end] ranges of at most chunkSize pages. */
export function pageRanges(
  pageCount: number,
  chunkSize: number
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let start = 1; start <= pageCount; start += chunkSize) {
    ranges.push([start, Math.min(start + chunkSize - 1, pageCount)]);
  }
  return ranges;
}

function transcribePrompt(start: number, end: number): string {
  const range =
    start === end ? `page ${start}` : `pages ${start} through ${end}`;
  return `You are a faithful transcription engine. The attached PDF is a scanned or image-only document with no usable text layer.

Transcribe ONLY ${range}, in order, exactly as printed. Rules:
- Transcribe, do not summarize. Include headings, body text, tables (as plain text, one row per line), footnotes, captions, and all numbers exactly as shown.
- If a word or line is illegible, write [illegible] in its place — never guess or invent text.
- Do not correct spelling, do not reformat, do not add commentary or explanations.
- Preserve the reading order of each page as best you can.
- Do NOT transcribe any page outside ${range}.

Return ONLY a single JSON object, no prose, no markdown fences:
{"pages": [{"page": ${start}, "text": "..."}]}
Page numbers are 1-based and must cover every page in ${range}.`;
}

/** Merge chunk results; throws if any page in 1..pageCount is missing. */
export function mergeChunkPages(
  chunks: PageText[][],
  pageCount: number,
  filename: string
): PageText[] {
  const pages = chunks
    .flat()
    .map((p) => ({ page: p.page, text: p.text.trim() }))
    .sort((a, b) => a.page - b.page);
  const seen = new Set(pages.map((p) => p.page));
  const missing: number[] = [];
  for (let i = 1; i <= pageCount; i++) if (!seen.has(i)) missing.push(i);
  if (missing.length > 0) {
    throw new Error(
      `OCR transcription of "${filename}" missed pages ${missing.join(", ")}. Please try again.`
    );
  }
  return pages;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

async function transcribeChunk(
  client: Anthropic,
  model: string,
  data: Uint8Array,
  filename: string,
  start: number,
  end: number
): Promise<PageText[]> {
  let message;
  try {
    message = await client.messages.create(
      {
        // Transcription needs no reasoning: thinking off, low effort.
        ...speedParams(model),
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: Buffer.from(data).toString("base64"),
                },
              },
              { type: "text", text: transcribePrompt(start, end) },
            ],
          },
        ],
      },
      { signal: AbortSignal.timeout(ocrChunkTimeoutMs()) }
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `OCR transcription timed out for "${filename}" (pages ${start}-${end}). Try a smaller file.`
      );
    }
    throw new Error(
      `OCR transcription failed for "${filename}" (pages ${start}-${end}): ${
        err instanceof Error ? err.message : "API error"
      }`
    );
  }

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `OCR transcription for "${filename}" (pages ${start}-${end}) returned an unreadable response. Please try again.`
    );
  }
  const parsed = TranscriptionSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `OCR transcription for "${filename}" (pages ${start}-${end}) returned an unexpected shape. Please try again.`
    );
  }
  return parsed.data.pages.map((p) => ({ page: p.page, text: p.text.trim() }));
}

/** Transcribe a scanned PDF into per-page text. Throws a user-friendly error. */
export async function transcribeScannedPdf(
  data: Uint8Array,
  filename: string,
  pageCount: number
): Promise<PageText[]> {
  if (data.byteLength > MAX_OCR_BYTES) {
    throw new Error(
      `"${filename}" is too large for OCR transcription (${(
        data.byteLength /
        1024 /
        1024
      ).toFixed(1)} MB; limit 30 MB).`
    );
  }
  if (pageCount > MAX_OCR_PAGES) {
    throw new Error(
      `"${filename}" has too many pages for OCR transcription (${pageCount}; limit ${MAX_OCR_PAGES}).`
    );
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey: key });
  const model = analysisModel();

  const ranges = pageRanges(pageCount, ocrChunkPages());
  const chunks = await mapWithConcurrency(ranges, ocrMaxConcurrency(), ([s, e]) =>
    transcribeChunk(client, model, data, filename, s, e)
  );
  const pages = mergeChunkPages(chunks, pageCount, filename);

  const totalChars = pages.reduce((n, p) => n + p.text.length, 0);
  if (totalChars < 50) {
    // A "successful" transcription with no content is a silent empty
    // report waiting to happen — refuse it loudly instead.
    throw new Error(
      `OCR transcription of "${filename}" came back effectively empty. The scan may be too low-quality to read.`
    );
  }
  return pages;
}
