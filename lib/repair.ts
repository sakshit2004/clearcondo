/**
 * Repair-retry helpers for the analysis pipeline.
 *
 * When Claude's first response fails schema validation, the repair retry
 * resends the validation errors WITH the source documents (previously only
 * the errors went back, so the model had no material to work from and the
 * repair could never succeed on a real stack). To bound cost, only the
 * cited documents go back when the failed response names any; otherwise
 * the full stack.
 *
 * Pure functions — no imports, unit-tested.
 */

export interface RepairDocInput {
  fileId: string;
  filename: string;
  docType: string;
  text: string;
}

/**
 * file_ids cited in a failed response, e.g. `"file_id": "file-3"`.
 * Used to narrow the repair retry to the documents the model actually
 * referenced.
 */
export function citedFileIds(raw: string): string[] {
  const ids = new Set<string>();
  for (const m of raw.matchAll(/"file_id"\s*:\s*"(file-\d+)"/g)) {
    ids.add(m[1]);
  }
  return [...ids];
}

/**
 * Build the repair prompt: validation errors + the cited documents'
 * full text (or the whole stack when nothing was cited).
 */
export function repairPrompt(
  errors: string,
  docs: RepairDocInput[],
  rawFailedResponse: string
): string {
  const cited = citedFileIds(rawFailedResponse);
  const subset =
    cited.length > 0 ? docs.filter((d) => cited.includes(d.fileId)) : docs;
  const useDocs = subset.length > 0 ? subset : docs;
  const docsBlock = useDocs
    .map(
      (d) =>
        `===== DOCUMENT ${d.fileId}: ${d.filename} (type: ${d.docType}) =====\n${d.text}`
    )
    .join("\n\n");
  return (
    `Your previous response was not valid. Validation errors:\n${errors}\n\n` +
    `The source documents are below${
      cited.length > 0 ? " (only the ones your response cited)" : ""
    }. Return ONLY the corrected full JSON object, no prose.\n\n${docsBlock}`
  );
}
