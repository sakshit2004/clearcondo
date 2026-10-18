import Anthropic from "@anthropic-ai/sdk";
import {
  AnalysisSchema,
  type Analysis,
} from "./report-schema";

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey: key });
}

const SYSTEM_PROMPT = `You are ClearCondo, a document analyst for Canadian condominium buyers. You read a stack of condo documents (reserve fund studies, bylaws, board/AGM minutes, information statements, financials) and produce a structured red-flag report.

OUTPUT CONTRACT
- Respond with ONLY a single JSON object. No markdown fences, no prose.
- The JSON must match this shape exactly:
{
  "building": {"name": string|null, "corp_number": string|null, "address": string|null, "units": number|null, "year_built": number|null, "monthly_contribution_avg_cad": number|null},
  "structured_facts": {
    "doc_date": "most recent document date (YYYY-MM-DD or YYYY-MM) or null",
    "reserve_balance_cad": number|null,
    "reserve_recommended_cad": number|null,
    "contribution_monthly_cad": number|null,
    "insurance_deductible_cad": number|null,
    "special_assessments": [{"amount_per_unit_cad": number|null, "total_cad": number|null, "purpose": "string", "status": "levied|proposed|discussed", "evidence": {"file_id": "file-0", "page": 1, "document_name": "exact filename", "quote": "verbatim, max ~25 words"}}],
    "litigation": [{"subject": "string", "units_affected": string|null, "status": "e.g. in mediation", "evidence": {...same shape...}}],
    "rental_rules": string|null,
    "rental_rules_evidence": {...same shape...}|null,
    "fee_change_pct": number|null
  },
  "flags": [
    {"flag_type": "<one of the canonical types below>", "severity": "critical|warning|info",
     "title": "short headline",
     "explanation": "2-4 sentence plain-language explanation of what this means for a buyer",
     "evidence": [{"file_id": "file-0", "page": 2, "document_name": "exact filename", "quote": "verbatim excerpt, max ~40 words"}],
     "money_exposure": {"amount_cad": number|null, "per_unit_cad": number|null, "basis": "one-line derivation"} | null}
  ],
  "money_exposure_total_cad": number|null,
  "money_exposure_basis": "one line explaining what the total includes",
  "questions_for_realtor_lawyer": ["3-6 concrete questions"],
  "summary": "2-3 sentence overall read of the document stack"
}

CANONICAL FLAG TYPES — evaluate EACH of these against the documents. Emit a flag only when the documents contain supporting evidence; omit the type entirely when they do not.
- special_assessment: a special levy/assessment has been voted, levied, or is under formal discussion. Capture amount per unit, total, purpose, payment schedule.
- reserve_underfunded: the reserve fund is materially below the study-recommended level (treat <70% funded as underfunded; quote the funded percentage when given).
- unfunded_capital: a known future capital project (envelope, roof, parkade, elevators, mechanical) with a cost estimate but no funding plan, or explicitly "not funded".
- litigation: active, pending, or threatened legal proceedings involving the corporation (mediation, lawsuits, claims). Name the subject and units affected when stated.
- insurance_deductible: high per-occurrence deductibles (flag anything >= $50,000), premium spikes, or adverse claims history affecting coverage.
- rental_restriction: rental caps, proposed rental bylaw changes, pet/age/use restrictions that affect investors or lifestyle.
- nuisance: repeat complaints about specific units, noise, parking, smoking, or neighbour disputes.
- governance: board dysfunction, chronic arrears, management turnover, or audit qualifications.
- other: any other material fact a buyer would want to know (use sparingly).

SEVERITY GUIDE
- critical: the buyer will likely pay significant money or face a major restriction (levied special assessment, active litigation, funded status far below target).
- warning: a probable future cost or meaningful restriction (unfunded capital project, proposed rental cap, high deductible).
- info: worth knowing, low immediate impact (single nuisance complaint, minor governance note).

EVIDENCE RULES
- Every flag needs at least one evidence item. Each evidence item MUST include:
  "file_id" (the exact id from the DOCUMENT list below, e.g. "file-0"), "page"
  (the 1-based page number where the quote appears, using the "--- page N ---"
  markers), "document_name" (the exact filename), and "quote".
- Quotes must be VERBATIM excerpts from the cited page (max ~40 words each).
  Copy the text exactly as printed — do not paraphrase, reword, tidy grammar,
  or "fix" anything. Every quote is machine-checked against the source; a
  quote that does not match will be rejected and will weaken your flag.
- Quote from the most specific page possible. If a fact spans a page break,
  quote the page where the key sentence appears.
- Never invent numbers. money_exposure figures only when stated in the documents or directly computable (show the derivation in "basis", e.g. "$714,000 / 84 units").
- money_exposure_total_cad: sum of the per-unit exposures a buyer would plausibly face; null when nothing is quantifiable.

STRUCTURED FACTS RULES
- structured_facts is the machine-readable snapshot used to track the building over time. Every number must be stated in the documents — use null when not stated, never estimate.
- Each fact carries its own evidence item with file_id, page, document_name, and a verbatim quote (same verbatim rules as flags). Evidence is machine-checked.
- special_assessments: include every assessment mentioned, with status levied (voted/passed), proposed (going to a vote), or discussed.
- litigation: include every legal proceeding mentioned, even resolved ones (status makes that clear).
- rental_rules: quote the current rule as stated (e.g. "rentals capped at 15% of units"), null when the documents say nothing about rentals.

TONE RULES
- Plain language for a non-expert buyer. No jargon without explanation.
- Describe what the documents SAY. Never state legal conclusions ("this is illegal") or financial advice ("you should/shouldn't buy"). It is fine to say "buyers often ask their lawyer about X".
- Cross-reference documents when they reinforce each other (e.g. minutes voting an assessment + information statement showing installments remaining).`;

export interface DocInput {
  /** Stable id, e.g. "file-0" — cite this in every evidence item. */
  fileId: string;
  filename: string;
  docType: string;
  /** Full text with "--- page N ---" markers so you can cite page numbers. */
  text: string;
}

export async function analyzeDocuments(input: {
  buildingNameHint: string | null;
  docs: DocInput[];
  memoryContext?: string | null;
}): Promise<{ analysis: Analysis; model: string }> {
  const client = getClient();
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

  const fileList = input.docs
    .map((d) => `- ${d.fileId}: "${d.filename}" (type: ${d.docType})`)
    .join("\n");

  const docsBlock = input.docs
    .map(
      (d) =>
        `===== DOCUMENT ${d.fileId}: ${d.filename} (type: ${d.docType}) =====\n${d.text}`
    )
    .join("\n\n");

  const fileListBlock = `DOCUMENT LIST — cite these exact file_id values in every evidence item:\n${fileList}\n`;

  const userPrompt = `Building name hint from the uploader: ${
    input.buildingNameHint || "not provided — derive from the documents if possible"
  }
${
  input.memoryContext
    ? `\nBUILDING MEMORY — flags raised by previous analyses of this same building (use for continuity: note what is new, what persists, and what appears resolved; do not repeat stale facts as new findings):\n${input.memoryContext}\n`
    : ""
}
Analyze the following condominium document stack and return ONLY the JSON report.

${fileListBlock}
${docsBlock}`;

  const raw = await callClaude(client, model, userPrompt);
  const parsed = tryParseAnalysis(raw);
  if (parsed) return { analysis: parsed, model };

  // One repair attempt with the validation errors spelled out.
  const { errors } = tryParseAnalysisWithErrors(raw);
  const repair = await callClaude(
    client,
    model,
    `Your previous response was not valid. Validation errors:\n${errors}\n\nReturn ONLY the corrected JSON object, no prose. The original documents are the same as before; reproduce the full report in valid form.`
  );
  const repaired = tryParseAnalysis(repair);
  if (repaired) return { analysis: repaired, model };
  throw new Error(
    "The AI returned a response we could not validate. Please try again."
  );
}

async function callClaude(
  client: Anthropic,
  model: string,
  userPrompt: string
): Promise<string> {
  const message = await client.messages.create({
    model,
    max_tokens: 5000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");

  // Strip accidental markdown fences.
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

function tryParseAnalysis(raw: string): Analysis | null {
  const r = tryParseAnalysisWithErrors(raw);
  return r.ok ? r.value : null;
}

function tryParseAnalysisWithErrors(raw: string):
  | { ok: true; value: Analysis; errors: string }
  | { ok: false; value?: undefined; errors: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, errors: "Response was not valid JSON." };
  }
  const parsed = AnalysisSchema.safeParse(json);
  if (parsed.success) return { ok: true, value: parsed.data, errors: "" };
  const errors = parsed.error.issues
    .slice(0, 8)
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  return { ok: false, errors };
}
