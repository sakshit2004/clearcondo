import { z } from "zod";

/**
 * ClearCondo report contract.
 *
 * This is the single source of truth for the structured output of the
 * Claude analysis pipeline, the SurrealDB `report` / `flag` tables, and the
 * hand-written sample report served at /demo. Any change here must be
 * reflected in lib/analyze.ts (prompt), lib/db.ts (schema.surql) and
 * sample-data/sample-report-*.json.
 */

export const FLAG_TYPES = [
  "special_assessment", // a levy has been voted/levied, or is being discussed
  "reserve_underfunded", // reserve fund materially below study recommendation
  "unfunded_capital", // known future capital project with no funding plan
  "litigation", // active or threatened legal proceedings
  "insurance_deductible", // high deductible / adverse insurance changes
  "rental_restriction", // rental caps, pet/age/use restriction changes
  "nuisance", // repeat complaints, problem units, neighbour issues
  "governance", // board dysfunction, arrears, management red flags
  "other",
] as const;

export const SEVERITIES = ["critical", "warning", "info"] as const;

export const DOC_TYPES = [
  "reserve_study",
  "bylaws",
  "minutes_board",
  "minutes_agm",
  "info_statement",
  "financials",
  "budget",
  "insurance",
  "other",
] as const;

export const EvidenceSchema = z.object({
  file_id: z
    .string()
    .describe(
      "Stable file id from the DOCUMENT list in the prompt (e.g. 'file-0'). Must match exactly."
    ),
  page: z
    .number()
    .int()
    .positive()
    .describe("1-based page number within the file where the quote appears"),
  document_name: z.string().describe("Filename of the source document"),
  quote: z
    .string()
    .describe(
      "Verbatim excerpt from the cited page supporting this flag, max ~40 words. Copy it exactly — do not paraphrase, reword, or tidy it up."
    ),
});

export const MATCH_TYPES = ["exact_page", "exact_file", "fuzzy", "none"] as const;

/**
 * Evidence after server-side verification against the stored page text.
 * `ocr` is true when the quote was verified against an OCR transcription
 * rather than native PDF text (lower confidence).
 */
export const VerifiedEvidenceSchema = EvidenceSchema.extend({
  verified: z.boolean(),
  matched_page: z.number().int().positive().nullable(),
  match_type: z.enum(MATCH_TYPES),
  ocr: z.boolean(),
});

export const VerificationStatsSchema = z.object({
  verified_claims: z.number().int().describe("Evidence quotes verified against source text"),
  total_claims: z.number().int().describe("Total evidence quotes checked"),
});

/* ------------------------------------------------------------------ */
/* Structured facts — the per-report snapshot that powers memory diffs */
/* ------------------------------------------------------------------ */

export const FactEvidenceSchema = z.object({
  file_id: z.string().describe("Exact file_id from the DOCUMENT list"),
  page: z.number().int().positive().describe("1-based page number"),
  document_name: z.string().describe("Exact filename"),
  quote: z.string().describe("Verbatim excerpt, max ~25 words. Copy exactly."),
});

export const SpecialAssessmentFactSchema = z.object({
  amount_per_unit_cad: z.number().nullable(),
  total_cad: z.number().nullable(),
  purpose: z.string().describe("What the assessment is for"),
  status: z.enum(["levied", "proposed", "discussed"]),
  evidence: FactEvidenceSchema,
});

export const LitigationFactSchema = z.object({
  subject: z.string().describe("What the dispute is about"),
  units_affected: z.string().nullable(),
  status: z.string().describe("e.g. 'in mediation', 'settled', 'threatened'"),
  evidence: FactEvidenceSchema,
});

/**
 * Machine-readable facts extracted per report, each tied to evidence.
 * Stored as the report's facts_snapshot; consecutive snapshots are diffed
 * for the "What changed since the last review" section.
 */
export const StructuredFactsSchema = z.object({
  doc_date: z
    .string()
    .nullable()
    .describe("Most recent document date found (YYYY-MM-DD or YYYY-MM), null if none"),
  reserve_balance_cad: z.number().nullable(),
  reserve_recommended_cad: z.number().nullable(),
  contribution_monthly_cad: z.number().nullable(),
  insurance_deductible_cad: z.number().nullable(),
  special_assessments: z.array(SpecialAssessmentFactSchema),
  litigation: z.array(LitigationFactSchema),
  rental_rules: z.string().nullable().describe("Current rental rules/restrictions as stated"),
  rental_rules_evidence: FactEvidenceSchema.nullable(),
  fee_change_pct: z.number().nullable().describe("Stated change in monthly contributions vs prior year, in percent"),
});

export type StructuredFacts = z.infer<typeof StructuredFactsSchema>;
export type FactEvidence = z.infer<typeof FactEvidenceSchema>;

export const MoneyExposureSchema = z.object({
  amount_cad: z
    .number()
    .nullable()
    .describe("Total exposure in CAD if stated or directly computable"),
  per_unit_cad: z
    .number()
    .nullable()
    .describe("Per-unit exposure in CAD if stated or directly computable"),
  basis: z
    .string()
    .describe(
      "One line explaining how the number was derived, e.g. '$714,000 / 84 units'"
    ),
});

export const FlagSchema = z.object({
  flag_type: z.enum(FLAG_TYPES),
  severity: z.enum(SEVERITIES),
  title: z.string().describe("Short headline, e.g. '$8,500/unit special assessment levied'"),
  explanation: z
    .string()
    .describe(
      "Plain-language explanation of what this means for a buyer, 2-4 sentences. Never state over-assessment or legal conclusions as fact."
    ),
  evidence: z
    .array(EvidenceSchema)
    .min(1)
    .describe("At least one verbatim quote with its source document"),
  money_exposure: MoneyExposureSchema.nullable().describe(
    "Null when no dollar figure can be derived from the documents"
  ),
});

export const BuildingFactsSchema = z.object({
  name: z.string().nullable(),
  corp_number: z.string().nullable(),
  address: z.string().nullable(),
  units: z.number().nullable(),
  year_built: z.number().nullable(),
  monthly_contribution_avg_cad: z.number().nullable(),
});

export const AnalysisSchema = z.object({
  building: BuildingFactsSchema,
  structured_facts: StructuredFactsSchema.describe(
    "Machine-readable facts for building memory. Every number must come with evidence; use null when the documents do not state it."
  ),
  flags: z.array(FlagSchema).describe(
    "Every material red flag found. Empty array only if the documents genuinely contain none."
  ),
  money_exposure_total_cad: z
    .number()
    .nullable()
    .describe(
      "Buyer-relevant total exposure: sum of per-unit exposures a buyer would plausibly face. Null if nothing quantifiable."
    ),
  money_exposure_basis: z
    .string()
    .describe("One line explaining what the total includes"),
  questions_for_realtor_lawyer: z
    .array(z.string())
    .describe("3-6 concrete questions the buyer should ask their realtor or lawyer"),
  summary: z
    .string()
    .describe(
      "2-3 sentence overall read of the document stack for a prospective buyer"
    ),
});

/** The report as served everywhere: verified, with per-evidence provenance. */
export const VerifiedFlagSchema = FlagSchema.extend({
  evidence: z.array(VerifiedEvidenceSchema),
  downgraded: z.boolean(),
});

export const VerifiedFactEvidenceSchema = FactEvidenceSchema.extend({
  verified: z.boolean(),
  matched_page: z.number().int().positive().nullable(),
  match_type: z.enum(MATCH_TYPES),
  ocr: z.boolean(),
});

export const VerifiedStructuredFactsSchema = z.object({
  doc_date: z.string().nullable(),
  reserve_balance_cad: z.number().nullable(),
  reserve_recommended_cad: z.number().nullable(),
  contribution_monthly_cad: z.number().nullable(),
  insurance_deductible_cad: z.number().nullable(),
  special_assessments: z.array(
    SpecialAssessmentFactSchema.extend({ evidence: VerifiedFactEvidenceSchema })
  ),
  litigation: z.array(
    LitigationFactSchema.extend({ evidence: VerifiedFactEvidenceSchema })
  ),
  rental_rules: z.string().nullable(),
  rental_rules_evidence: VerifiedFactEvidenceSchema.nullable(),
  fee_change_pct: z.number().nullable(),
});

export const VerifiedAnalysisSchema = z.object({
  building: BuildingFactsSchema,
  structured_facts: VerifiedStructuredFactsSchema,
  flags: z.array(VerifiedFlagSchema),
  money_exposure_total_cad: z.number().nullable(),
  money_exposure_basis: z.string(),
  questions_for_realtor_lawyer: z.array(z.string()),
  summary: z.string(),
  verification: VerificationStatsSchema,
});

export type Analysis = z.infer<typeof AnalysisSchema>;
export type Flag = z.infer<typeof FlagSchema>;
export type BuildingFacts = z.infer<typeof BuildingFactsSchema>;
export type FlagType = (typeof FLAG_TYPES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type DocType = (typeof DOC_TYPES)[number];
export type MatchType = (typeof MATCH_TYPES)[number];

/** A flag whose evidence has been verified against the stored page text. */
export interface VerifiedEvidence {
  file_id: string;
  page: number;
  document_name: string;
  quote: string;
  verified: boolean;
  matched_page: number | null;
  match_type: MatchType;
  /** True when verified against an OCR transcription (lower confidence). */
  ocr: boolean;
}

export interface VerifiedFlag {
  flag_type: FlagType;
  severity: Severity;
  title: string;
  explanation: string;
  evidence: VerifiedEvidence[];
  money_exposure: Flag["money_exposure"];
  /** True when the flag was downgraded because some evidence did not verify. */
  downgraded: boolean;
}

/** A fact evidence item after server-side verification. */
export interface VerifiedFactEvidence extends FactEvidence {
  verified: boolean;
  matched_page: number | null;
  match_type: MatchType;
  ocr: boolean;
}

export interface VerifiedSpecialAssessment {
  amount_per_unit_cad: number | null;
  total_cad: number | null;
  purpose: string;
  status: "levied" | "proposed" | "discussed";
  evidence: VerifiedFactEvidence;
}

export interface VerifiedLitigation {
  subject: string;
  units_affected: string | null;
  status: string;
  evidence: VerifiedFactEvidence;
}

/** Structured facts with every evidence item verified. */
export interface VerifiedStructuredFacts {
  doc_date: string | null;
  reserve_balance_cad: number | null;
  reserve_recommended_cad: number | null;
  contribution_monthly_cad: number | null;
  insurance_deductible_cad: number | null;
  special_assessments: VerifiedSpecialAssessment[];
  litigation: VerifiedLitigation[];
  rental_rules: string | null;
  rental_rules_evidence: VerifiedFactEvidence | null;
  fee_change_pct: number | null;
}

/** The report as served to the UI and persisted: verified, never raw. */
export interface VerifiedAnalysis {
  building: BuildingFacts;
  structured_facts: VerifiedStructuredFacts;
  flags: VerifiedFlag[];
  money_exposure_total_cad: number | null;
  money_exposure_basis: string;
  questions_for_realtor_lawyer: string[];
  summary: string;
  verification: { verified_claims: number; total_claims: number };
}

/** Human labels for the UI. */
export const FLAG_TYPE_LABELS: Record<FlagType, string> = {
  special_assessment: "Special assessment",
  reserve_underfunded: "Reserve fund underfunded",
  unfunded_capital: "Unfunded capital project",
  litigation: "Litigation",
  insurance_deductible: "Insurance deductible",
  rental_restriction: "Rental / use restrictions",
  nuisance: "Nuisance / neighbour issues",
  governance: "Governance",
  other: "Other",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};
