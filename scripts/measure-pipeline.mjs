/**
 * Pipeline timing harness (no LLM, no network).
 *
 * Measures the stages of the analysis pipeline that run locally:
 *   1. PDF text extraction over the full demo-docs stack (mirrors
 *      /api/analyze/start minus the OCR fallback, which needs an API key).
 *   2. Evidence verification over the largest sample report (mirrors the
 *      verify step in /api/analyze/run).
 *
 * Then extrapolates to a 100-page stack and estimates the Claude call from
 * token counts (clearly labeled ESTIMATE — no API key here).
 *
 * Run: node --experimental-strip-types scripts/measure-pipeline.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractPdfText,
  docTextWithPageMarkers,
} from "../lib/extract.ts";
import { verifyAnalysis } from "../lib/verify.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const docsDir = join(repoRoot, "demo-docs");

const pdfFiles = readdirSync(docsDir)
  .filter((f) => f.toLowerCase().endsWith(".pdf"))
  .sort();

// --- Stage 1: extraction (start route, text path) ---------------------------
console.log("== Stage 1: extraction (all demo-docs PDFs) ==");
let totalPages = 0;
let totalChars = 0;
let totalExtractMs = 0;
const docs = [];
for (const f of pdfFiles) {
  const buf = new Uint8Array(readFileSync(join(docsDir, f)));
  const t0 = performance.now();
  const doc = await extractPdfText(`file-${f}`, f, buf);
  const ms = performance.now() - t0;
  totalExtractMs += ms;
  totalPages += doc.pages.length;
  totalChars += doc.charCount;
  docs.push(doc);
  console.log(
    `  ${f}: ${doc.pages.length}p, ${doc.charCount} chars, ${ms.toFixed(0)} ms`
  );
}
const msPerPage = totalExtractMs / Math.max(totalPages, 1);
console.log(
  `  TOTAL: ${totalPages} pages, ${totalChars} chars in ${totalExtractMs.toFixed(0)} ms`
);
console.log(`  => ${msPerPage.toFixed(1)} ms/page`);

// --- Stage 2: verification (run route, local part) --------------------------
console.log("\n== Stage 2: verification (sample-report-2026.json) ==");
const report = JSON.parse(
  readFileSync(join(repoRoot, "sample-data", "sample-report-2026.json"), "utf8")
);
const fileIds = new Map(pdfFiles.map((f, i) => [`file-${f}`, `file-${i}`]));
// Remap the harness file ids to the canonical file-N ids used in the sample.
const byName = new Map(docs.map((d) => [d.filename, d]));
const verifiableDocs = pdfFiles.map((f, i) => {
  const d = byName.get(f);
  return {
    fileId: `file-${i}`,
    fileName: f,
    pages: d.pages,
    ocr: false,
  };
});
// Rewrite evidence file_ids in a deep copy to the canonical ids.
const remapped = JSON.parse(JSON.stringify(report));
const fixIds = (e) => {
  if (e && typeof e.file_id === "string") {
    const idx = pdfFiles.indexOf(
      [...byName.keys()].find((k) => `file-${k}` === e.file_id) ?? ""
    );
    if (idx >= 0) e.file_id = `file-${idx}`;
  }
};
for (const fl of remapped.flags ?? []) for (const e of fl.evidence ?? []) fixIds(e);
for (const s of remapped.structured_facts?.special_assessments ?? []) fixIds(s.evidence);
for (const l of remapped.structured_facts?.litigation ?? []) fixIds(l.evidence);
if (remapped.structured_facts?.rental_rules_evidence)
  fixIds(remapped.structured_facts.rental_rules_evidence);

const quoteCount =
  (remapped.flags ?? []).reduce((n, f) => n + (f.evidence ?? []).length, 0) +
  (remapped.structured_facts?.special_assessments ?? []).length +
  (remapped.structured_facts?.litigation ?? []).length +
  (remapped.structured_facts?.rental_rules_evidence ? 1 : 0);

const t0 = performance.now();
const verified = verifyAnalysis(remapped, verifiableDocs);
const verifyMs = performance.now() - t0;
console.log(
  `  ${quoteCount} quotes verified in ${verifyMs.toFixed(0)} ms ` +
    `(${(verifyMs / Math.max(quoteCount, 1)).toFixed(1)} ms/quote), ` +
    `${verified.verification.verified_claims}/${verified.verification.total_claims} verified`
);

// --- Stage 3: Claude call (ESTIMATE — no API key) -----------------------------
console.log("\n== Stage 3: Claude analysis call (ESTIMATE, token math) ==");
const analysisInput = docs
  .map((d) =>
    docTextWithPageMarkers({
      fileId: d.fileId,
      filename: d.filename,
      pages: d.pages,
      pageCount: d.pageCount,
      charCount: d.charCount,
      status: d.status,
      isScanned: d.isScanned,
    })
  )
  .join("\n\n");
const inputTokens = Math.round(analysisInput.length / 4);
const OUTPUT_TOKENS = 5000; // max_tokens in lib/analyze.ts
const OUTPUT_TOKENS_PER_SEC = 65; // conservative Sonnet throughput
const PREFILL_TOKENS_PER_SEC = 3000; // rough prefill rate
const estOutputSec = OUTPUT_TOKENS / OUTPUT_TOKENS_PER_SEC;
const estPrefillSec = inputTokens / PREFILL_TOKENS_PER_SEC;
console.log(`  analysis input: ${analysisInput.length} chars ~= ${inputTokens} tokens`);
console.log(
  `  EST output ${OUTPUT_TOKENS} tok @ ~${OUTPUT_TOKENS_PER_SEC}/s ~= ${estOutputSec.toFixed(0)}s`
);
console.log(
  `  EST prefill/TTFT ~= ${estPrefillSec.toFixed(0)}s`
);
console.log(
  `  EST single analysis call ~= ${(estOutputSec + estPrefillSec).toFixed(0)}s`
);

// --- Extrapolation to a 100-page stack ---------------------------------------
console.log("\n== Extrapolation: 100-page text stack ==");
const scalePages = 100 / Math.max(totalPages, 1);
const xChars = Math.round(totalChars * scalePages);
const xTokens = Math.round(xChars / 4);
const xExtractSec = (totalExtractMs * scalePages) / 1000;
const xVerifySec = ((verifyMs / Math.max(quoteCount, 1)) * quoteCount * scalePages) / 1000;
const xClaudeSec = xTokens / PREFILL_TOKENS_PER_SEC + estOutputSec;
console.log(`  extraction:      ~${xExtractSec.toFixed(1)}s (measured rate)`);
console.log(`  verification:    ~${xVerifySec.toFixed(1)}s (measured rate, quotes scale with pages)`);
console.log(`  Claude analysis: ~${xClaudeSec.toFixed(0)}s (ESTIMATE)`);
console.log(`  persist (DB):    <2s (assumed, network-local)`);
const xTotal = xExtractSec + xVerifySec + xClaudeSec + 2;
console.log(`  ----------------------------------------`);
console.log(`  TOTAL (sync):    ~${xTotal.toFixed(0)}s vs Vercel Hobby max 300s`);
console.log(
  xTotal < 240
    ? "  VERDICT: fits with margin — no background job needed for text stacks."
    : "  VERDICT: too close — background job recommended."
);
