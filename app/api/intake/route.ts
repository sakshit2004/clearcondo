import { NextResponse } from "next/server";
import { extractPdfText, classifyDocType } from "@/lib/extract";
import { hasUploadConsent } from "@/lib/retention";
import { validateUploadBatch, MAX_FILE_BYTES } from "@/lib/upload-limits";
import {
  generateRefCode,
  validateServiceOrderInput,
  type ServiceOrderDoc,
} from "@/lib/service-order";
import { withDb, createServiceOrder, isDbConfigured } from "@/lib/db";

/**
 * The service desk: POST /api/intake accepts a document package with NO
 * account. A realtor forwards the PDFs the seller's side delivered; we
 * extract the text (raw PDF bytes are never stored), persist a service
 * order, and return its reference code. The finished, verified report is
 * produced from the stored pages by the normal pipeline and delivered to
 * the sender's email — the sender never operates the tool.
 *
 * Extraction of a full stack can take a while on scanned files, so this
 * route gets the same generous ceiling as the analysis start route.
 */
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      {
        error:
          "The order desk opens at launch — intake needs the service database configured.",
      },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Could not read the submission." },
      { status: 400 }
    );
  }

  const input = {
    realtorName: String(form.get("realtorName") ?? "").trim(),
    brokerage: String(form.get("brokerage") ?? "").trim() || null,
    email: String(form.get("email") ?? "").trim(),
    propertyAddress: String(form.get("propertyAddress") ?? "").trim(),
    conditionDate: String(form.get("conditionDate") ?? "").trim() || null,
  };

  const fieldError = validateServiceOrderInput(input);
  if (fieldError) {
    return NextResponse.json({ error: fieldError }, { status: 400 });
  }

  if (!hasUploadConsent(form.get("consent"))) {
    return NextResponse.json(
      {
        error:
          "Consent is required so we can read the documents. Please check the consent box and try again.",
      },
      { status: 400 }
    );
  }

  const files = form
    .getAll("files")
    .filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json(
      { error: "Attach at least one PDF from the document package." },
      { status: 400 }
    );
  }
  const rejection = validateUploadBatch(files);
  if (rejection) {
    return NextResponse.json(
      { error: rejection.error },
      { status: rejection.status }
    );
  }
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `"${f.name}" is too large — the per-file limit is 15 MB.` },
        { status: 413 }
      );
    }
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
      return NextResponse.json(
        { error: `"${f.name}" is not a PDF. The package should be PDFs.` },
        { status: 400 }
      );
    }
  }

  // Extract per-page text now; the bytes are discarded after this request,
  // exactly like the self-serve analysis flow.
  const documents: ServiceOrderDoc[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await extractPdfText(`order-file-${i}`, f.name, bytes);
      documents.push({
        filename: f.name,
        docType: classifyDocType(f.name, doc.pages.map((p) => p.text).join("\n")),
        pageCount: doc.pageCount,
        charCount: doc.charCount,
        // Scanned packages carry almost no text at intake; fulfilment runs
        // them through OCR transcription before analysis, like the app flow.
        status: doc.isScanned ? "ocr" : doc.status,
        pages: doc.pages,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : `Could not read "${f.name}" as a PDF.`,
        },
        { status: 400 }
      );
    }
  }

  // Persist with a fresh reference code; one retry on the (astronomically
  // unlikely) unique-index collision.
  for (let attempt = 0; attempt < 2; attempt++) {
    const refCode = generateRefCode();
    try {
      const saved = await withDb((db) =>
        createServiceOrder(db, { ...input, refCode, consent: true }, documents)
      );
      if (saved === null) {
        return NextResponse.json(
          { error: "The order desk opens at launch — intake is not configured." },
          { status: 503 }
        );
      }
      return NextResponse.json({
        refCode,
        status: "received",
        documents: documents.map((d) => ({
          filename: d.filename,
          pageCount: d.pageCount,
        })),
      });
    } catch (err) {
      if (attempt === 1) {
        console.error("service order persist failed", err);
        return NextResponse.json(
          { error: "We couldn't save your order. Please try again." },
          { status: 500 }
        );
      }
    }
  }
  // Unreachable, but keeps the handler's return type total.
  return NextResponse.json(
    { error: "We couldn't save your order. Please try again." },
    { status: 500 }
  );
}
