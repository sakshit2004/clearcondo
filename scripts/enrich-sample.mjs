/**
 * Enrich a hand-written sample report JSON with verification data.
 *
 * For every evidence quote in the JSON, this script extracts the demo PDFs,
 * verifies the quote against the stored page text (same verifier the server
 * uses), and writes back: file_id, page, verified, matched_page, match_type.
 * It FAILS LOUDLY if any quote does not verify — a hand-written sample must
 * never ship an unverified claim.
 *
 * Run: node --experimental-strip-types scripts/enrich-sample.mjs <input.json> <output.json>
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { extractPdfText } from "../lib/extract.ts";
import { verifyQuote } from "../lib/verify.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const docsDir = join(repoRoot, "demo-docs");

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error("usage: enrich-sample.mjs <input.json> <output.json>");
  process.exit(1);
}

// Deterministic file ids: alphabetical by filename.
const pdfFiles = readdirSync(docsDir)
  .filter((f) => f.toLowerCase().endsWith(".pdf"))
  .sort();
const fileIds = new Map(pdfFiles.map((f, i) => [f, `file-${i}`]));

// Extract all PDFs per page.
const docs = [];
for (const f of pdfFiles) {
  const buf = new Uint8Array(readFileSync(join(docsDir, f)));
  const doc = await extractPdfText(fileIds.get(f), f, buf);
  docs.push(doc);
  console.log(`extracted ${f} -> ${fileIds.get(f)} (${doc.pages.length} pages)`);
}
const byId = new Map(docs.map((d) => [d.fileId, d]));

const report = JSON.parse(readFileSync(join(repoRoot, inputPath), "utf8"));

let verified = 0;
let total = 0;
const failures = [];

/** Yield every evidence item in the report: flag evidence + structured-fact evidence. */
function* allEvidences(report) {
  for (const flag of report.flags ?? []) {
    for (const e of flag.evidence ?? []) yield { e, flag };
  }
  const sf = report.structured_facts;
  if (sf) {
    for (const s of sf.special_assessments ?? []) yield { e: s.evidence, flag: null };
    for (const l of sf.litigation ?? []) yield { e: l.evidence, flag: null };
    if (sf.rental_rules_evidence) yield { e: sf.rental_rules_evidence, flag: null };
  }
}

const flagOk = new Map((report.flags ?? []).map((f) => [f, true]));
for (const { e, flag } of allEvidences(report)) {
  total++;
  const fileId = fileIds.get(e.document_name);
  if (!fileId) {
    failures.push(`unknown document_name: ${e.document_name}`);
    if (flag) flagOk.set(flag, false);
    continue;
  }
  const doc = byId.get(fileId);
  // First pass: find the page; second pass: confirm exact_page.
  const found = verifyQuote(e.quote, doc.pages, null);
  if (!found.verified || found.matchedPage == null) {
    failures.push(
      `UNVERIFIED quote in ${e.document_name}: "${e.quote.slice(0, 80)}..."`
    );
    if (flag) flagOk.set(flag, false);
    continue;
  }
  const confirmed = verifyQuote(e.quote, doc.pages, found.matchedPage);
  e.file_id = fileId;
  e.page = found.matchedPage;
  e.verified = true;
  e.matched_page = found.matchedPage;
  e.match_type = confirmed.matchType; // "exact_page"
  e.ocr = false;
  verified++;
}
for (const [f, ok] of flagOk) f.downgraded = !ok;

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}

report.verification = { verified_claims: verified, total_claims: total };
writeFileSync(join(repoRoot, outputPath), JSON.stringify(report, null, 2) + "\n");
console.log(`\nwrote ${outputPath}: ${verified}/${total} claims verified`);
