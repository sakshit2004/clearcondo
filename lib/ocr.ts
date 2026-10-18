/**
 * OCR fallback for scanned/image-only PDFs.
 *
 * When text extraction finds nothing readable, the PDF is sent to Claude as a
 * native PDF document input for a faithful per-page transcription. The
 * transcription then flows through the normal analysis + verification
 * pipeline; claims verified against it are labeled "verified against OCR
 * transcription" (lower confidence) in the UI.
 *
 * Claude API limits (checked Oct 2026): 32 MB max request size, up to 100
 * pages per request for full PDF analysis. Our upload caps (15 MB, 40 pages)
 * sit comfortably inside those, so a single transcription call suffices;
 * anything larger is rejected with a clear error rather than chunked
 * silently.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { PageText } from "./extract";

const MAX_OCR_BYTES = 30 * 1024 * 1024;
const MAX_OCR_PAGES = 100;

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

const TRANSCRIBE_PROMPT = `You are a faithful transcription engine. The attached PDF is a scanned or image-only document with no usable text layer.

Transcribe EVERY page, in order, exactly as printed. Rules:
- Transcribe, do not summarize. Include headings, body text, tables (as plain text, one row per line), footnotes, captions, and all numbers exactly as shown.
- If a word or line is illegible, write [illegible] in its place — never guess or invent text.
- Do not correct spelling, do not reformat, do not add commentary or explanations.
- Preserve the reading order of each page as best you can.

Return ONLY a single JSON object, no prose, no markdown fences:
{"pages": [{"page": 1, "text": "..."}, {"page": 2, "text": "..."}]}
Page numbers are 1-based and must cover every page of the PDF.`;

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
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

  let message;
  try {
    message = await client.messages.create({
      model,
      max_tokens: 20000,
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
            { type: "text", text: TRANSCRIBE_PROMPT },
          ],
        },
      ],
    });
  } catch (err) {
    throw new Error(
      `OCR transcription failed for "${filename}": ${
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
      `OCR transcription for "${filename}" returned an unreadable response. Please try again.`
    );
  }
  const parsed = TranscriptionSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `OCR transcription for "${filename}" returned an unexpected shape. Please try again.`
    );
  }

  const pages = parsed.data.pages
    .slice(0, pageCount)
    .map((p) => ({ page: p.page, text: p.text.trim() }))
    .sort((a, b) => a.page - b.page);

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
