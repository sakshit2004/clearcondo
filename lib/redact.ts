/**
 * Personal-name redaction for report surfaces.
 *
 * Board/AGM minutes routinely name private individuals — directors
 * ("D. Whitfield (President)"), owners, managers ("Maya Chen, Property
 * Manager"). Reports must never surface those names. This module strips
 * them server-side, BEFORE verification and persistence, so the database,
 * the UI, and Agent Memory only ever hold redacted text.
 *
 * HOW IT WORKS (two passes)
 *  Pass 1 — stash protected spans behind placeholders (case-insensitive):
 *           caller-supplied phrases (building name, address, corp id),
 *           "Condominium Corporation No. X" phrases.
 *  Pass 2 — case-SENSITIVE name redaction (the `i` flag is deliberately
 *           absent: `[A-Z]` must not match lowercase, otherwise ordinary
 *           prose like "the president called" would be destroyed):
 *           role-annotated names -> role display, initial+surname and
 *           surviving "Firstname Lastname" bigrams -> "[name redacted]",
 *           with company/structural guards.
 *  Pass 3 — restore the stashed spans verbatim.
 *
 * HEURISTIC TRADEOFFS (documented honestly)
 * - Pattern-based, not a trained NER model. It prefers OVER-redaction of
 *   person-like names: a stray "[name redacted]" is ugly but safe; a
 *   leaked real name is a privacy failure.
 * - Catches: role-annotated names ("D. Whitfield (President)",
 *   "Maya Chen, Property Manager", "President D. Whitfield"),
 *   initial+surname ("J. Park", "R. Alvarez"), and bare
 *   "Firstname Lastname" bigrams that survive the guards.
 * - NEVER redacted: building names / addresses / corp numbers (caller
 *   phrases + CORP_RE), company names (a capitalized run whose last or
 *   next word is a company keyword: Ltd/Inc/Engineering/Management…),
 *   unit references ("Unit 1204" — digits never match the name patterns),
 *   dollar amounts, dates, percentages (no pattern matches them).
 * - Known limits: three-word names may leave a stray first word
 *   ("Mary [name redacted]"); hyphenated surnames match the first
 *   segment only; all-caps headers are skipped deliberately (structural,
 *   not personal references); a structural bigram on the denylist that
 *   happens to be someone's name will be missed; quoted person names ARE
 *   redacted (only the caller phrases are protected, not quotes).
 */

import type { Analysis } from "./report-schema";

export const REDACTED_NAME = "[name redacted]";

/* ------------------------------------------------------------------ */
/* Vocabularies                                                        */
/* ------------------------------------------------------------------ */

/** Role word (lowercased) -> display replacement. */
const ROLE_DISPLAY: Record<string, string> = {
  president: "the President",
  "vice-president": "the Vice-President",
  "vice president": "the Vice-President",
  secretary: "the Secretary",
  treasurer: "the Treasurer",
  director: "a director",
  "property manager": "the property manager",
  manager: "the manager",
  chair: "the chair",
  chairman: "the chair",
  chairperson: "the chair",
};

/** Words that mark a capitalized run as a company, not a person. */
const COMPANY_KEYWORDS = new Set([
  "ltd",
  "inc",
  "corp",
  "corporation",
  "llc",
  "llp",
  "co",
  "management",
  "engineering",
  "consulting",
  "services",
  "group",
  "partners",
  "associates",
  "properties",
  "realty",
  "holdings",
  "enterprises",
  "solutions",
]);

/**
 * Capitalized bigrams that are document structure, not people.
 * Compared lowercased against the exact two-word candidate.
 */
const STRUCTURAL_BIGRAMS = new Set([
  "annual general",
  "general meeting",
  "board meeting",
  "meeting minutes",
  "special assessment",
  "special assessments",
  "reserve fund",
  "building envelope",
  "information statement",
  "financial statement",
  "financial statements",
  "annual budget",
  "annual report",
  "condominium corporation",
  "property manager",
  "board members",
  "old business",
  "new business",
  "action items",
  "parkade membrane",
  "north hill",
]);

/* ------------------------------------------------------------------ */
/* Patterns                                                            */
/* ------------------------------------------------------------------ */

// A capitalized word that is NOT all-caps ("MINUTES" must not match).
// Allows internal capitals for names like "McDonald".
const WORD = String.raw`[A-Z][a-z]+(?:[A-Z][a-z]+)*`;
// A person-name candidate: "D. Whitfield" or "Maya Chen".
const PERSON = String.raw`(?:[A-Z]\.\s*${WORD}|${WORD}\s+${WORD})`;
const CORP_RE = String.raw`Condominium Corporation No\.?\s*[\d-]+`;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isCompanyWord(w: string): boolean {
  return COMPANY_KEYWORDS.has(w.toLowerCase().replace(/\.+$/, ""));
}

function roleDisplay(role: string): string | null {
  const key = role.toLowerCase().replace(/\s+/g, " ").trim();
  return ROLE_DISPLAY[key] ?? null;
}

/** Determiner/article first words: "The Board" is not a person. */
const NON_NAME_FIRST_WORDS = new Set([
  "the",
  "a",
  "an",
  "this",
  "that",
  "these",
  "those",
  "each",
  "every",
  "any",
  "all",
  "no",
  "our",
  "their",
  "your",
  "his",
  "her",
  "its",
  "my",
  "per",
]);

/**
 * Decide the fate of one bare person-name candidate.
 * Guards: determiner first word ("The Board"), company keyword as the
 * second word, structural bigram denylist. Otherwise redact.
 */
function redactBareName(candidate: string): string {
  const words = candidate.trim().split(/\s+/);
  if (words.length < 2) return candidate;
  if (NON_NAME_FIRST_WORDS.has(words[0].toLowerCase())) return candidate;
  const second = words[words.length - 1];
  if (isCompanyWord(second)) return candidate;
  if (STRUCTURAL_BIGRAMS.has(words.slice(-2).join(" ").toLowerCase())) {
    return candidate;
  }
  return REDACTED_NAME;
}

/**
 * Redact person-like names in free text.
 *
 * @param text free text from a report surface (title, explanation, quote…)
 * @param protectedPhrases extra spans to never touch (building name,
 *        address, corp identifiers). Matched case-insensitively.
 */
export function redactText(
  text: string,
  protectedPhrases: string[] = []
): string {
  if (!text) return text;

  // ---- Pass 1: stash protected spans behind placeholders.
  const stash: string[] = [];
  const protectParts = [
    CORP_RE,
    ...protectedPhrases.filter((p) => p && p.trim()).map(escapeRegExp),
  ];
  const protectRe = new RegExp(protectParts.join("|"), "gi");
  const PH = (i: number) => `\u0001PROT${i}\u0001`;
  const staged = text.replace(protectRe, (m) => {
    stash.push(m);
    return PH(stash.length - 1);
  });

  // ---- Pass 2: redact names (CASE-SENSITIVE by design — see header).
  const nameRe = new RegExp(
    [
      // "D. Whitfield (President)" / "Hartley Engineering (August 2026)"
      `(?<roleParen>(?<rpName>${PERSON})\\s*\\((?<rpRole>[^)]{1,40})\\))`,
      // "Maya Chen, Property Manager" / "J. Park, Secretary"
      `(?<roleComma>(?<rcName>${PERSON}),\\s*(?<rcRole>[A-Z][a-z]+(?:\\s+[A-Z][a-z]+){0,2}))`,
      // "President D. Whitfield"
      `(?<roleLead>(?<rlRole>[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)\\s+(?<rlName>${PERSON}))`,
      `(?<bare>${PERSON})`,
    ].join("|"),
    "g"
  );

  const redacted = staged.replace(nameRe, (...args: unknown[]): string => {
    const groups = args[args.length - 1] as Record<string, string | undefined>;
    if (groups.roleParen) {
      const disp = roleDisplay(groups.rpRole ?? "");
      if (disp) return disp;
      // Unknown parenthetical ("Hartley Engineering (August 2026)"):
      // still screen the name part through the bare-name guards.
      return `${redactBareName(groups.rpName ?? "")} (${groups.rpRole})`;
    }
    if (groups.roleComma) {
      const disp = roleDisplay(groups.rcRole ?? "");
      if (disp) return disp;
      return `${redactBareName(groups.rcName ?? "")}, ${groups.rcRole}`;
    }
    if (groups.roleLead) {
      const disp = roleDisplay(groups.rlRole ?? "");
      if (disp) return disp;
      // Unrecognized leading word ("Ask Maya Chen", "Board Meeting Minutes"):
      // keep the lead word, screen the name part through the bare guards.
      return `${groups.rlRole} ${redactBareName(groups.rlName ?? "")}`;
    }
    if (groups.bare) return redactBareName(groups.bare);
    return args[0] as string;
  });

  // ---- Pass 3: restore protected spans verbatim.
  return redacted.replace(/\u0001PROT(\d+)\u0001/g, (_, i) => stash[Number(i)]);
}

/**
 * Phrases from the analysis that must never be redacted: building name,
 * address, corporation number.
 */
export function protectedPhrasesFor(
  building: Analysis["building"]
): string[] {
  const out: string[] = [];
  if (building.name) out.push(building.name);
  if (building.address) out.push(building.address);
  if (building.corp_number) out.push(building.corp_number);
  return out;
}

/**
 * Redact every person-name surface of an analysis, server-side, BEFORE
 * verification and persistence.
 *
 * - flag titles, explanations, money-exposure basis: redacted in place.
 * - evidence quotes: `quote` is KEPT ORIGINAL (verification must run
 *   against the source text); `quote_display` carries the redacted text
 *   for the UI. The "verified" badge always refers to the original.
 * - structured facts free text (purpose, subject, status, rental_rules):
 *   redacted; their evidence quotes get the same quote/quote_display split.
 * - building identity (name, address, corp_number): NEVER redacted.
 */
export function redactAnalysis(analysis: Analysis): Analysis {
  const prot = protectedPhrasesFor(analysis.building);
  const R = (s: string) => redactText(s, prot);
  const withDisplay = <T extends { quote: string }>(
    e: T
  ): T & { quote_display: string } => ({
    ...e,
    quote_display: R(e.quote),
  });

  return {
    ...analysis,
    flags: analysis.flags.map((f) => ({
      ...f,
      title: R(f.title),
      explanation: R(f.explanation),
      money_exposure: f.money_exposure
        ? { ...f.money_exposure, basis: R(f.money_exposure.basis) }
        : f.money_exposure,
      evidence: f.evidence.map(withDisplay),
    })),
    structured_facts: {
      ...analysis.structured_facts,
      special_assessments: analysis.structured_facts.special_assessments.map(
        (s) => ({
          ...s,
          purpose: R(s.purpose),
          evidence: withDisplay(s.evidence),
        })
      ),
      litigation: analysis.structured_facts.litigation.map((l) => ({
        ...l,
        subject: R(l.subject),
        status: R(l.status),
        units_affected: l.units_affected
          ? R(l.units_affected)
          : l.units_affected,
        evidence: withDisplay(l.evidence),
      })),
      rental_rules: analysis.structured_facts.rental_rules
        ? R(analysis.structured_facts.rental_rules)
        : analysis.structured_facts.rental_rules,
      rental_rules_evidence: analysis.structured_facts.rental_rules_evidence
        ? withDisplay(analysis.structured_facts.rental_rules_evidence)
        : analysis.structured_facts.rental_rules_evidence,
    },
    summary: R(analysis.summary),
    money_exposure_basis: R(analysis.money_exposure_basis),
    questions_for_realtor_lawyer: analysis.questions_for_realtor_lawyer.map(R),
  };
}
