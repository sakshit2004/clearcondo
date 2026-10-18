/**
 * Standard Alberta condo resale document checklist.
 *
 * NOTE: this list models the document package buyers typically receive in an
 * Alberta condominium resale. It MUST be confirmed against the Condominium
 * Property Act and its regulations by a qualified reviewer before being
 * treated as legal guidance. Do not cite Act section numbers in the UI —
 * the checklist is a practical prompt ("ask for it"), not a legal reference.
 */

import type { DocType } from "./report-schema";

export interface ChecklistItem {
  id: string;
  label: string;
  /** Document types (our classifier taxonomy) that satisfy this item. */
  docTypes: DocType[];
  askFor: string;
}

export const DOC_CHECKLIST: ChecklistItem[] = [
  {
    id: "bylaws",
    label: "Current bylaws",
    docTypes: ["bylaws"],
    askFor: "Ask the seller or condo manager for the current registered bylaws.",
  },
  {
    id: "financials",
    label: "Financial statements (latest fiscal year)",
    docTypes: ["financials"],
    askFor: "Ask for the corporation's most recent year-end financial statements.",
  },
  {
    id: "budget",
    label: "Annual budget",
    docTypes: ["budget", "financials"],
    askFor: "Ask for the current fiscal year's operating budget.",
  },
  {
    id: "reserve_study",
    label: "Reserve fund study and reserve fund plan",
    docTypes: ["reserve_study"],
    askFor: "Ask for the latest reserve fund study and the board's adopted reserve fund plan.",
  },
  {
    id: "minutes",
    label: "Recent board and AGM minutes",
    docTypes: ["minutes_board", "minutes_agm"],
    askFor: "Ask for the last 12 months of board minutes plus the most recent AGM minutes.",
  },
  {
    id: "info_statement",
    label: "Estoppel / information statement for the unit",
    docTypes: ["info_statement"],
    askFor: "Ask for the information statement (estoppel) for the specific unit — it shows arrears, parking, and upcoming levies.",
  },
  {
    id: "insurance",
    label: "Insurance certificate / summary",
    docTypes: ["insurance"],
    askFor: "Ask for the corporation's current insurance certificate showing coverage and deductibles.",
  },
];

/** Items with no matching uploaded document. */
export function findMissingDocs(uploadedDocTypes: string[]): ChecklistItem[] {
  const have = new Set(uploadedDocTypes);
  return DOC_CHECKLIST.filter(
    (item) => !item.docTypes.some((t) => have.has(t))
  );
}
