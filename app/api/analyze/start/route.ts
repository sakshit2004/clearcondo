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

export const maxDuration = 60;

const MAX_FILES = 12;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export interface ExtractedPayload {
  fileId: string;
  filename: string;
  docType: string;
  pages: PageText[];
  pageCount: number;
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
        const pages = await transcribeScannedPdf(
          buf,
          file.name,
          extracted.pageCount
        );
        const charCount = pages.reduce((n, p) => n + p.text.length, 0);
        docs.push({
          fileId: extracted.fileId,
          filename: extracted.filename,
          docType: classifyDocType(
            extracted.filename,
            pages.map((p) => p.text).join("\n").slice(0, 2000)
          ),
          pages,
          pageCount: extracted.pageCount,
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
