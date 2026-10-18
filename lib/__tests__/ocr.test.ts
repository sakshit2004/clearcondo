import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  transcribeScannedPdf,
  pageRanges,
  mergeChunkPages,
} from "../ocr.ts";

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

describe("pageRanges", () => {
  it("splits evenly", () => {
    assert.deepEqual(pageRanges(20, 10), [
      [1, 10],
      [11, 20],
    ]);
  });
  it("handles a ragged tail", () => {
    assert.deepEqual(pageRanges(25, 10), [
      [1, 10],
      [11, 20],
      [21, 25],
    ]);
  });
  it("handles fewer pages than the chunk size", () => {
    assert.deepEqual(pageRanges(3, 10), [[1, 3]]);
  });
  it("is 1-based and contiguous", () => {
    const ranges = pageRanges(100, 10);
    assert.equal(ranges.length, 10);
    assert.deepEqual(ranges[0], [1, 10]);
    assert.deepEqual(ranges[9], [91, 100]);
    for (let i = 1; i < ranges.length; i++) {
      assert.equal(ranges[i][0], ranges[i - 1][1] + 1);
    }
  });
});

describe("mergeChunkPages", () => {
  it("merges out-of-order chunks and sorts by page", () => {
    const merged = mergeChunkPages(
      [
        [
          { page: 3, text: "c" },
          { page: 4, text: "d" },
        ],
        [
          { page: 1, text: "a" },
          { page: 2, text: "b" },
        ],
      ],
      4,
      "f.pdf"
    );
    assert.deepEqual(
      merged.map((p) => p.page),
      [1, 2, 3, 4]
    );
  });
  it("throws loudly when a page is missing", () => {
    assert.throws(
      () =>
        mergeChunkPages(
          [[{ page: 1, text: "a" }], [{ page: 3, text: "c" }]],
          3,
          "f.pdf"
        ),
      /missed pages 2/
    );
  });
});
