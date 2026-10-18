import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { transcribeScannedPdf } from "../ocr.ts";

describe("transcribeScannedPdf guards", () => {
  it("rejects oversized PDFs before any API call", async () => {
    const big = new Uint8Array(31 * 1024 * 1024);
    await assert.rejects(
      () => transcribeScannedPdf(big, "big.pdf", 10),
      /too large for OCR transcription/
    );
  });

  it("rejects PDFs over the page limit before any API call", async () => {
    const small = new Uint8Array([1, 2, 3]);
    await assert.rejects(
      () => transcribeScannedPdf(small, "huge.pdf", 101),
      /too many pages/
    );
  });
});
