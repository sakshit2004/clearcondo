/**
 * Smoke test for PDF text extraction (no LLM, no network).
 * Run: npm run smoke
 * Asserts every demo PDF yields readable text containing expected markers.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractPdfText, docPlainText } from "../lib/extract.ts";

const here = dirname(fileURLToPath(import.meta.url));
const docsDir = join(here, "..", "demo-docs");

const EXPECTED = {
  "demo-01-board-minutes-2026-09-09.pdf": ["$1,150,000", "$100,000", "Unit 1204"],
  "demo-02-agm-minutes-2026-04-22.pdf": ["special assessment of $8,500", "61% funded", "71% in favour"],
  "demo-03-reserve-fund-plan-summary-2026.pdf": ["NOT YET FUNDED", "61%"],
  "demo-04-information-statement-unit-506.pdf": ["$4,250 remains payable", "$100,000"],
  "m3-sample-reserve-fund-study.pdf": ["Reserve Fund Study"],
  "demo-2024-01-board-minutes-2024-09-11.pdf": ["$660,000", "$25,000", "no known legal proceedings"],
  "demo-2024-02-reserve-fund-plan-summary-2024.pdf": ["63%", "$700,000", "NOT YET FUNDED"],
};

let failures = 0;
for (const [file, markers] of Object.entries(EXPECTED)) {
  const path = join(docsDir, file);
  try {
    const buf = new Uint8Array(readFileSync(path));
    const doc = await extractPdfText(`file-${file}`, file, buf);
    const text = docPlainText(doc);
    const missing = markers.filter((m) => !text.includes(m));
    const perPageOk = doc.pages.length > 0 && doc.pages.every((p, i) => p.page === i + 1);
    if (doc.charCount < 300) {
      console.log(`FAIL ${file}: only ${doc.charCount} chars extracted`);
      failures++;
    } else if (!perPageOk) {
      console.log(`FAIL ${file}: per-page structure broken`);
      failures++;
    } else if (missing.length > 0) {
      console.log(`FAIL ${file}: missing markers: ${missing.join(", ")}`);
      failures++;
    } else {
      console.log(`ok   ${file}: ${doc.pageCount}p, ${doc.charCount} chars, per-page ok, all markers found`);
    }
  } catch (err) {
    console.log(`FAIL ${file}: ${err instanceof Error ? err.message : err}`);
    failures++;
  }
}

// Negative test: garbage input must throw a friendly error.
try {
  await extractPdfText("file-bad", "bad.pdf", new Uint8Array([1, 2, 3, 4]));
  console.log("FAIL bad.pdf: expected an error, got none");
  failures++;
} catch {
  console.log("ok   bad.pdf: rejected with a friendly error");
}

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll smoke tests passed.");
