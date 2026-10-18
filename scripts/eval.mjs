/**
 * Eval runner: score a produced analysis against a hand-labeled eval case.
 *
 * Usage:
 *   npm run eval -- <stack-dir> [--analysis <analysis.json>]
 *
 * <stack-dir> holds:
 *   case.json     — { name, docs_dir, docs: [filenames], analysis } (paths
 *                   relative to the stack dir)
 *   expected.json — { flags: [ { id, severity, title_keywords | title,
 *                   min_amount_cad?, evidence_quote, source_doc } ] }
 *
 * The analysis JSON can be a produced run output, the ephemeral {analysis}
 * payload, or one of the checked-in sample reports. Quotes are always
 * re-verified against freshly extracted page text — the runner never trusts
 * `verified` fields stamped on a stored report, and it needs no API key.
 *
 * Exit code: 0 when recall >= EVAL_MIN_RECALL (default 0.8) AND zero
 * fabricated quotes. Any fabricated quote is a hard failure.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractPdfText } from "../lib/extract.ts";
import { verifyQuote } from "../lib/verify.ts";
import {
  computeMetrics,
  matchExpectedFlags,
  minRecall,
  passesEval,
  reverifyQuotes,
} from "../lib/eval.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

function usage() {
  console.error("Usage: npm run eval -- <stack-dir> [--analysis <analysis.json>]");
  process.exit(2);
}

const args = process.argv.slice(2);
const stackDirArg = args.find((a) => !a.startsWith("--"));
if (!stackDirArg) usage();
const stackDir = resolve(repoRoot, stackDirArg);
const analysisOverrideIdx = args.indexOf("--analysis");
const analysisOverride =
  analysisOverrideIdx >= 0 ? resolve(repoRoot, args[analysisOverrideIdx + 1]) : null;

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const casePath = join(stackDir, "case.json");
const expectedPath = join(stackDir, "expected.json");
if (!existsSync(casePath) || !existsSync(expectedPath)) {
  console.error(`Missing case.json or expected.json in ${stackDir}`);
  process.exit(2);
}
const caseCfg = readJson(casePath);
const expected = readJson(expectedPath).flags ?? [];
const rel = (p) => resolve(stackDir, p);

// --- Load analysis -----------------------------------------------------------
const analysisPath = analysisOverride ?? rel(caseCfg.analysis);
if (!existsSync(analysisPath)) {
  console.error(`Analysis file not found: ${analysisPath}`);
  process.exit(2);
}
const rawAnalysis = readJson(analysisPath);
const analysis = rawAnalysis.flags ? rawAnalysis : rawAnalysis.analysis;
if (!analysis || !Array.isArray(analysis.flags)) {
  console.error(`No flags[] found in ${analysisPath}`);
  process.exit(2);
}
const producedFlags = analysis.flags.map((f) => ({
  severity: f.severity ?? "",
  title: f.title ?? "",
  evidence: (f.evidence ?? []).map((e) => ({
    quote: e.quote ?? "",
    page: e.page ?? null,
    document_name: e.document_name ?? "",
    file_id: e.file_id ?? "",
  })),
  money_exposure: f.money_exposure
    ? {
        amount_cad: f.money_exposure.amount_cad ?? null,
        per_unit_cad: f.money_exposure.per_unit_cad ?? null,
      }
    : null,
}));

// --- Extract source documents (fresh page text, no API key) ------------------
console.log(`\n== Eval: ${caseCfg.name ?? stackDirArg} ==`);
console.log(`analysis: ${analysisPath}`);
const docsDir = rel(caseCfg.docs_dir);
const docs = [];
for (let i = 0; i < (caseCfg.docs ?? []).length; i++) {
  const filename = caseCfg.docs[i];
  const buf = new Uint8Array(readFileSync(join(docsDir, filename)));
  const doc = await extractPdfText(`eval-doc-${i}`, filename, buf);
  docs.push({ fileName: filename, pages: doc.pages });
  console.log(`  source: ${filename} (${doc.pages.length} pages)`);
}
const docByName = new Map(docs.map((d) => [d.fileName, d]));

// --- Re-verify every quote in the analysis -----------------------------------
// Flag evidence feeds recall table + fabrication count; structured-fact
// evidence feeds the fabrication / % verified metrics only.
const allEvidence = [];
for (const f of producedFlags) allEvidence.push(...f.evidence);
const sf = analysis.structured_facts ?? {};
for (const s of sf.special_assessments ?? []) if (s.evidence) allEvidence.push(s.evidence);
for (const l of sf.litigation ?? []) if (l.evidence) allEvidence.push(l.evidence);
if (sf.rental_rules_evidence) allEvidence.push(sf.rental_rules_evidence);

const checks = reverifyQuotes(allEvidence, docs);
const checkByQuote = new Map();
for (const c of checks) {
  if (!checkByQuote.has(c.quote)) checkByQuote.set(c.quote, c.verified);
}
const quotesVerifiedFor = (flag) =>
  flag.evidence.length > 0 &&
  flag.evidence.every((e) => checkByQuote.get(e.quote) === true);

// --- Match expected flags ----------------------------------------------------
const rawMatches = matchExpectedFlags(expected, producedFlags);
const rows = rawMatches.map(({ expected: exp, matchedIndex }) => {
  const found = matchedIndex != null;
  const p = found ? producedFlags[matchedIndex] : null;
  const labelDoc = docByName.get(exp.source_doc);
  const labelQuoteOk = labelDoc
    ? verifyQuote(exp.evidence_quote, labelDoc.pages).verified
    : false;
  let amountOk = null;
  if (found && exp.min_amount_cad != null) {
    const m = p.money_exposure;
    const headline = m ? (m.amount_cad ?? m.per_unit_cad ?? null) : null;
    amountOk = headline != null && headline >= exp.min_amount_cad;
  }
  return {
    expected: exp,
    found,
    matchedTitle: p ? p.title : null,
    severityMatch: p ? p.severity.toLowerCase() === exp.severity.toLowerCase() : null,
    amountOk,
    quotesVerified: p ? quotesVerifiedFor(p) : null,
    labelQuoteOk,
  };
});

// --- Report ------------------------------------------------------------------
const yn = (v) => (v == null ? "—" : v ? "yes" : "NO");
console.log("\n-- per-flag table --");
console.log(
  "expected id".padEnd(34) +
    "found".padEnd(7) +
    "sev".padEnd(5) +
    "amt".padEnd(5) +
    "quotes".padEnd(8) +
    "label-ok"
);
for (const r of rows) {
  const id = r.expected.id.padEnd(34).slice(0, 34);
  console.log(
    id +
      (r.found ? "yes".padEnd(7) : "NO".padEnd(7)) +
      yn(r.severityMatch).padEnd(5) +
      yn(r.amountOk).padEnd(5) +
      yn(r.quotesVerified).padEnd(8) +
      (r.labelQuoteOk ? "yes" : "NO (eval case broken?)")
  );
  if (r.found) console.log(`    -> ${r.matchedTitle}`);
}

const metrics = computeMetrics(expected, rows, checks);
const floor = minRecall();
console.log("\n-- metrics --");
console.log(
  `recall:           ${(metrics.recall * 100).toFixed(1)}% ` +
    `(${metrics.matchedCount}/${metrics.expectedCount}, floor ${Math.round(floor * 100)}% via EVAL_MIN_RECALL)`
);
console.log(
  `fabricated:       ${metrics.fabricatedQuotes} unverified quote(s) of ${metrics.totalQuotes} (hard fail if > 0)`
);
console.log(
  `% verified:       ${(metrics.pctVerified * 100).toFixed(1)}% ` +
    `(${metrics.verifiedQuotes}/${metrics.totalQuotes})`
);

const badLabels = rows.filter((r) => !r.labelQuoteOk);
if (badLabels.length > 0) {
  console.log(
    `\nWARNING: ${badLabels.length} expected flag(s) have a canonical quote that does NOT ` +
      `verify against their source_doc — the eval case itself may be stale: ` +
      badLabels.map((r) => r.expected.id).join(", ")
  );
}

const ok = passesEval(metrics) && badLabels.length === 0;
console.log(ok ? "\nEVAL PASS" : "\nEVAL FAIL");
process.exit(ok ? 0 : 1);
