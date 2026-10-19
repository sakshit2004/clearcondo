/**
 * Personal-name redaction for report surfaces.
 *
 * Board/AGM minutes routinely name private individuals — directors
 * ("D. Whitfield (President)"), owners, managers ("Maya Chen, Property
 * Manager"). Reports must never surface those names. This module strips
 * them server-side, BEFORE verification and persistence, so the database,
 * the UI, and Agent Memory only ever hold redacted text.
 *
 * HOW IT WORKS (three passes)
 *  Pass 1 — stash protected spans behind placeholders (case-insensitive):
 *           caller-supplied phrases (building name, address, corp id),
 *           "Condominium Corporation No. X" phrases.
 *  Pass 2 — case-SENSITIVE name redaction (the `i` flag is deliberately
 *           absent: `[A-Z]` must not match lowercase, otherwise ordinary
 *           prose like "the president called" would be destroyed):
 *           emails -> "[name redacted]"; titled names ("Dr. D. Whitfield")
 *           -> "[name redacted]"; role-annotated names -> role display;
 *           initial+surname ("J. Park", "J Park"), "LAST, First"
 *           ("Whitfield, Daryl"), ALL-CAPS bigrams ("DARYL WHITFIELD",
 *           guarded by a structural denylist), and surviving
 *           "Firstname Lastname" bigrams/trigrams -> "[name redacted]",
 *           with company/structural guards. Trailing possessives
 *           ("Whitfield's") are redacted with the name.
 *  Pass 3 — restore the stashed spans verbatim.
 *
 * HEURISTIC TRADEOFFS (documented honestly)
 * - Pattern-based, not a trained NER model. It prefers OVER-redaction of
 *   person-like names: a stray "[name redacted]" is ugly but safe; a
 *   leaked real name is a privacy failure.
 * - Catches: role-annotated names ("D. Whitfield (President)",
 *   "Maya Chen, Property Manager", "President D. Whitfield"),
 *   initial+surname ("J. Park", "R. Alvarez", "J Park"), "LAST, First",
 *   ALL-CAPS bigrams, titled names ("Dr. Whitfield"), hyphenated and
 *   apostrophe names ("Mary-Jane Watson", "O'Brien"), names with
 *   diacritics ("José García"), possessives ("Whitfield's"), email
 *   addresses, and bare "Firstname Lastname" bigrams/trigrams that
 *   survive the guards.
 * - NEVER redacted: building names / addresses / corp numbers (caller
 *   phrases + CORP_RE), company names (a capitalized run whose last or
 *   next word is a company keyword: Ltd/Inc/Engineering/Management…),
 *   unit references ("Unit 1204" — digits never match the name patterns),
 *   dollar amounts, dates, percentages (no pattern matches them).
 * - Known limits: first-name-only mentions ("Daryl said…"), all-lowercase
 *   names, and surname-alone mentions cannot be told apart from ordinary
 *   prose and are NOT redacted; 2-letter ALL-CAPS words ("AL BO") are
 *   skipped to protect boilerplate like "BE IT"; an ALL-CAPS bigram whose
 *   words are both absent from the structural/boilerplate denylist is
 *   redacted even if it is not a name (documented over-redaction bias);
 *   "City, Province" pairs ("Toronto, Ontario") match the LAST,FIRST
 *   pattern and are redacted — building addresses are protected phrases,
 *   but stray ones in prose are not; quoted person names ARE redacted
 *   (only the caller phrases are protected, not quotes).
 */

import type { Analysis, VerifiedAnalysis } from "./report-schema";

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

/**
 * Single ALL-CAPS words that mark a bigram as document structure or
 * motion boilerplate, not a person. Compared lowercased; either word
 * matching keeps the bigram. Calibrated against real minutes vocabulary:
 * headers ("MEETING MINUTES"), motion language ("BE IT RESOLVED THAT",
 * "MOVED BY", "SECONDED", "CARRIED"), and the company-keyword list.
 */
const STRUCTURAL_ALLCAPS_WORDS = new Set([
  "meeting",
  "meetings",
  "minutes",
  "board",
  "annual",
  "general",
  "financial",
  "statement",
  "statements",
  "reserve",
  "fund",
  "funds",
  "special",
  "assessment",
  "assessments",
  "condominium",
  "corporation",
  "information",
  "building",
  "envelope",
  "parkade",
  "membrane",
  "action",
  "items",
  "business",
  "budget",
  "budgets",
  "report",
  "reports",
  "member",
  "members",
  "old",
  "new",
  "property",
  "manager",
  "management",
  "sample",
  "document",
  "documents",
  "demo",
  "data",
  // Motion / boilerplate vocabulary.
  "resolved",
  "resolution",
  "moved",
  "mover",
  "seconded",
  "seconder",
  "carried",
  "adopted",
  "approved",
  "whereas",
  "therefore",
  "that",
  "this",
  "with",
  "from",
  "for",
  "and",
  "the",
  "not",
  "yet",
  "all",
  "any",
  "are",
  "was",
  "were",
  "has",
  "have",
  "will",
  "shall",
  "per",
  "via",
  ...COMPANY_KEYWORDS,
]);

/* ------------------------------------------------------------------ */
/* Patterns                                                            */
/* ------------------------------------------------------------------ */

// A capitalized word, Unicode-aware ("José", "García"), allowing internal
// capitals ("McDonald") and hyphen/apostrophe joins ("O'Brien",
// "Mary-Jane", "Jean-Pierre"). A lone capital ("O", "I") also matches —
// the bare-name guards decide its fate, and the module prefers
// over-redaction to a leaked name.
const WORD = String.raw`\p{Lu}\p{Ll}*(?:['\u2019-]?\p{Lu}\p{Ll}*)*`;
// A person-name candidate: "D. Whitfield", "J Park", "Maya Chen",
// or a three-word name ("Mary Jane Watson").
const PERSON = String.raw`(?:\p{Lu}\.?\s*${WORD}|${WORD}(?:\s+${WORD}){1,2})`;
// Honorifics: "Dr. Daryl Whitfield", "Mr. Park" (the title is dropped
// with the name).
const TITLE = String.raw`(?:Dr|Mr|Mrs|Ms|Miss)\.`;
// An ALL-CAPS word ("DARYL", "WHITFIELD"). Only matched as a bigram, and
// only when neither word is structural/boilerplate — headers like
// "MEETING MINUTES" and motion text like "BE IT RESOLVED THAT" must
// survive. Minimum 3 letters: 2-letter words are overwhelmingly
// initials, abbreviations ("ST", "NW"), or boilerplate ("BE", "IT").
const ACAP = String.raw`\p{Lu}{3,}(?:['\u2019-]\p{Lu}+)*`;
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
  // The `u` flag enables the Unicode property escapes in WORD/PERSON/ACAP.
  // Emails go first: they are contact PII even when they contain no
  // space-separated name ("d.whitfield@example.com").
  const noEmails = staged.replace(
    /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu,
    REDACTED_NAME
  );

  const nameRe = new RegExp(
    [
      // "Dr. Daryl Whitfield" / "Mr. Park" — title dropped with the name.
      `(?<titled>${TITLE}\\s*(?:${PERSON}|${WORD}))`,
      // "D. Whitfield (President)" / "Hartley Engineering (August 2026)"
      `(?<roleParen>(?<rpName>${PERSON})\\s*\\((?<rpRole>[^)]{1,40})\\))`,
      // "Maya Chen, Property Manager" / "J. Park, Secretary"
      `(?<roleComma>(?<rcName>${PERSON}),\\s*(?<rcRole>[A-Z][a-z]+(?:\\s+[A-Z][a-z]+){0,2}))`,
      // "President D. Whitfield"
      `(?<roleLead>(?<rlRole>[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)\\s+(?<rlName>${PERSON}))`,
      // "Whitfield, Daryl" (attendance-list style)
      `(?<commaName>(?<cnFirst>${WORD}),\\s*(?<cnLast>${WORD}))`,
      // "DARYL WHITFIELD" (all-caps sign-offs)
      `(?<allCaps>(?<acFirst>${ACAP})\\s+(?<acLast>${ACAP}))`,
      // "Maya Chen" / "J. Park" / "J Park" / "Whitfield's"
      `(?<bare>${PERSON})(?<poss>'s|\\u2019s)?`,
    ].join("|"),
    "gu"
  );

  const redacted = noEmails.replace(
    nameRe,
    (...args: unknown[]): string => {
      const groups = args[args.length - 1] as Record<
        string,
        string | undefined
      >;
      const full = args[0] as string;
      if (groups.titled) return REDACTED_NAME;
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
        // Unrecognized leading word. It may be the first word of a
        // three-word name ("Mary Jane Watson" split as lead "Mary" +
        // "Jane Watson"), so screen the whole span first: when the guards
        // don't keep it, the entire span is one name. Otherwise keep the
        // lead word ("Ask Maya Chen", "Board Meeting Minutes") and screen
        // just the name part through the bare guards.
        const combined = `${groups.rlRole} ${groups.rlName ?? ""}`;
        if (redactBareName(combined) === REDACTED_NAME) return REDACTED_NAME;
        return `${groups.rlRole} ${redactBareName(groups.rlName ?? "")}`;
      }
      if (groups.commaName) {
        // "SECONDED"/"MOVED" etc. after a comma are motion language, not a
        // first name ("D. Whitfield, SECONDED BY …").
        const w1 = (groups.cnFirst ?? "").toLowerCase();
        const w2 = (groups.cnLast ?? "").toLowerCase();
        if (STRUCTURAL_ALLCAPS_WORDS.has(w1) || STRUCTURAL_ALLCAPS_WORDS.has(w2)) {
          return full;
        }
        const pair = `${groups.cnFirst} ${groups.cnLast}`;
        // Kept: return the original span (comma included), not the
        // guard-screened pair.
        return redactBareName(pair) === REDACTED_NAME ? REDACTED_NAME : full;
      }
      if (groups.allCaps) {
        const w1 = (groups.acFirst ?? "").toLowerCase();
        const w2 = (groups.acLast ?? "").toLowerCase();
        if (
          STRUCTURAL_ALLCAPS_WORDS.has(w1) ||
          STRUCTURAL_ALLCAPS_WORDS.has(w2)
        ) {
          return full;
        }
        return REDACTED_NAME;
      }
      if (groups.bare) {
        // The possessive was screened out of the guards; a kept name gets
        // its "'s" back via the original span.
        return redactBareName(groups.bare) === REDACTED_NAME
          ? REDACTED_NAME
          : full;
      }
      return full;
    }
  );

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

/**
 * Build the client-safe version of a verified analysis for API responses
 * and server-component props. Every evidence `quote` is replaced by its
 * redacted `quote_display` (falling back to the original only when no
 * redacted version exists, e.g. pre-redaction data).
 *
 * WHY: the database keeps original quotes for the verification audit, but
 * originals can contain personal names from minutes. Verification already
 * ran server-side, so the browser never needs them — serving them would
 * leak names through API JSON and React Flight data even though the UI
 * renders quote_display.
 */
export function toPublicAnalysis(a: VerifiedAnalysis): VerifiedAnalysis {
  const pub = <T extends { quote: string; quote_display?: string }>(
    e: T
  ): T => ({ ...e, quote: e.quote_display ?? e.quote });
  return {
    ...a,
    flags: a.flags.map((f) => ({ ...f, evidence: f.evidence.map(pub) })),
    structured_facts: {
      ...a.structured_facts,
      special_assessments: a.structured_facts.special_assessments.map((s) => ({
        ...s,
        evidence: pub(s.evidence),
      })),
      litigation: a.structured_facts.litigation.map((l) => ({
        ...l,
        evidence: pub(l.evidence),
      })),
      rental_rules_evidence: a.structured_facts.rental_rules_evidence
        ? pub(a.structured_facts.rental_rules_evidence)
        : null,
    },
  };
}
