import { NextResponse } from "next/server";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import {
  extractPdfText,
  classifyDocType,
  docPlainText,
  type PageText,
} from "@/lib/extract";
import { transcribeScannedPdf } from "@/lib/ocr";
import { isAnthropicConfigured } from "@/lib/analyze";
import { findMissingDocs } from "@/lib/doc-checklist";
import { hasUploadConsent } from "@/lib/retention";

/**
 * Vercel Hobby (Fluid compute) allows up to 300s per function invocation.
 * Extraction is fast, but the OCR fallback transcribes scanned PDFs via
 * Claude and can take minutes on large scans — 60s would kill it.
 */
export const maxDuration = 300;

const MAX_FILES = 12;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
/**
 * Vercel rejects request bodies over 4.5 MB with 413 before the handler
 * runs. Cap total upload size below that so users get our clear error
 * instead of a platform rejection.
 */
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

export interface ExtractedPayload {
  fileId: string;
  filename: string;
  docType: string;
  pages: PageText[];
  pageCount: number;
  /** Uncapped page count (present for text-extracted docs). */
  totalPages?: number;
  /** True when pages/chars were dropped by the extraction caps. */
  truncated: boolean;
  charCount: number;
  /** extracted | ocr | failed */
  status: "extracted" | "ocr" | "failed";
  isScanned: boolean;
}

/**
 * Step 1 of the analysis pipeline: extract per-page text from uploaded PDFs.
 * Returns the extracted documents; the client then POSTs them to /api/analyze/run.
 */
export async function POST(req: Request) {
  if (!isClerkConfigured()) {
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 }
    );
  }
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Could not read the upload." },
      { status: 400 }
    );
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const buildingNameHint = (form.get("buildingName") as string | null)?.trim() || null;

  if (!hasUploadConsent(form.get("consent"))) {
    return NextResponse.json(
      { error: "Upload consent is required. Please check the consent box and try again." },
      { status: 400 }
    );
  }

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Upload at least one PDF." },
      { status: 400 }
    );
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Too many files — the limit is ${MAX_FILES}.` },
      { status: 400 }
    );
  }
  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      {
        error: `Those files total ${(totalBytes / 1024 / 1024).toFixed(1)} MB — the upload limit is 4 MB total. Try fewer or smaller files.`,
      },
      { status: 413 }
    );
  }

  const docs: ExtractedPayload[] = [];
  const failures: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileId = `file-${i}`;
    if (file.size > MAX_FILE_BYTES) {
      failures.push(`"${file.name}" exceeds the 15 MB limit.`);
      continue;
    }
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const extracted = await extractPdfText(fileId, file.name, buf);
      if (!extracted.isScanned) {
        docs.push({
          fileId: extracted.fileId,
          filename: extracted.filename,
          docType: classifyDocType(extracted.filename, docPlainText(extracted)),
          pages: extracted.pages,
          pageCount: extracted.pageCount,
          totalPages: extracted.totalPages,
          truncated: extracted.truncated ?? false,
          charCount: extracted.charCount,
          status: "extracted",
          isScanned: false,
        });
        continue;
      }
      // Scanned / image-only PDF: OCR fallback via Claude's native PDF input.
      if (!isAnthropicConfigured()) {
        failures.push(
          `"${file.name}" looks like a scanned/image-only PDF, and OCR needs an Anthropic API key on this deployment.`
        );
        continue;
      }
      try {
        // NOTE: pass totalPages (uncapped), not pageCount — the text path
        // caps pageCount at 40, but the OCR path supports up to 100 pages.
        const totalPages = extracted.totalPages ?? extracted.pageCount;
        const pages = await transcribeScannedPdf(buf, file.name, totalPages);
        const charCount = pages.reduce((n, p) => n + p.text.length, 0);
        docs.push({
          fileId: extracted.fileId,
          filename: extracted.filename,
          docType: classifyDocType(
            extracted.filename,
            pages.map((p) => p.text).join("\n").slice(0, 2000)
          ),
          pages,
          pageCount: totalPages,
          totalPages,
          truncated: false, // OCR transcribes the full page range (≤100)
          charCount,
          status: "ocr",
          isScanned: true,
        });
      } catch (err) {
        failures.push(
          err instanceof Error ? err.message : `Could not OCR "${file.name}".`
        );
      }
    } catch (err) {
      failures.push(
        err instanceof Error ? err.message : `Could not read "${file.name}".`
      );
    }
  }

  if (docs.length === 0) {
    return NextResponse.json(
      { error: failures[0] || "No readable documents were uploaded." },
      { status: 422 }
    );
  }

  const missing = findMissingDocs(docs.map((d) => d.docType)).map((m) => ({
    id: m.id,
    label: m.label,
    askFor: m.askFor,
  }));

  return NextResponse.json({ docs, buildingNameHint, failures, missing });
}
