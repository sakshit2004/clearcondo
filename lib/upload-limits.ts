/**
 * Upload batch limits for POST /api/analyze/start.
 *
 * Pure functions so the 4 MB cap (and the file-count cap) are unit-tested
 * without spinning up the route's heavy dependencies (PDF extraction,
 * OCR, Clerk). The route calls validateUploadBatch and returns its
 * rejection directly.
 */

export const MAX_FILES = 12;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
/**
 * Vercel rejects request bodies over 4.5 MB with 413 before the handler
 * runs. Cap total upload size below that so users get our clear error
 * instead of a platform rejection.
 */
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

export interface BatchRejection {
  status: 400 | 413;
  error: string;
}

/**
 * Returns null when the batch is within budget, otherwise the rejection
 * the route should return directly. Empty batches pass here — the route
 * reports "upload at least one PDF" separately.
 */
export function validateUploadBatch(
  files: { size: number }[]
): BatchRejection | null {
  if (files.length > MAX_FILES) {
    return {
      status: 400,
      error: `Too many files — the limit is ${MAX_FILES}.`,
    };
  }
  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return {
      status: 413,
      error: `Those files total ${(totalBytes / 1024 / 1024).toFixed(1)} MB — the upload limit is 4 MB total. Try fewer or smaller files.`,
    };
  }
  return null;
}
