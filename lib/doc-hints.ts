import { DOC_CHECKLIST } from "./doc-checklist";

/**
 * Filename hints for the live package checklist on the upload forms. A
 * guess to help the sender spot gaps before sending — the real document
 * types are classified from the text once the PDFs are read.
 */
const NAME_HINTS: Record<string, RegExp> = {
  bylaws: /bylaw/i,
  financials: /financ/i,
  budget: /budget/i,
  reserve_study: /reserve/i,
  minutes: /minute|agm|board/i,
  info_statement: /estoppel|info/i,
  insurance: /insur|certificate/i,
};

/** The Alberta checklist with a best guess of which items the files cover. */
export function guessChecklist(fileNames: string[]) {
  return DOC_CHECKLIST.map((item) => ({
    ...item,
    have: fileNames.some((n) => NAME_HINTS[item.id]?.test(n) ?? false),
  }));
}
