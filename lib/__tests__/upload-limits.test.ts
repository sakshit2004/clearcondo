import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateUploadBatch,
  MAX_FILES,
  MAX_TOTAL_BYTES,
} from "../upload-limits.ts";

const MB = 1024 * 1024;
const file = (mb: number) => ({ size: Math.round(mb * MB) });

describe("validateUploadBatch", () => {
  it("accepts a batch under the caps", () => {
    assert.equal(validateUploadBatch([file(1), file(2)]), null);
  });

  it("accepts an empty batch (the route reports that separately)", () => {
    assert.equal(validateUploadBatch([]), null);
  });

  it("accepts exactly 4 MB total", () => {
    assert.equal(validateUploadBatch([{ size: MAX_TOTAL_BYTES }]), null);
  });

  it("rejects over 4 MB total with 413 and the measured size", () => {
    const res = validateUploadBatch([file(2.5), file(2)]);
    assert.ok(res, "expected a rejection");
    assert.equal(res.status, 413);
    assert.ok(
      res.error.includes("4.5 MB"),
      `message should name the total: ${res.error}`
    );
    assert.ok(res.error.includes("4 MB total"), res.error);
  });

  it("rejects one byte over the cap", () => {
    const res = validateUploadBatch([{ size: MAX_TOTAL_BYTES + 1 }]);
    assert.ok(res, "expected a rejection");
    assert.equal(res.status, 413);
  });

  it("rejects more than 12 files with 400", () => {
    const files = Array.from({ length: MAX_FILES + 1 }, () => file(0.1));
    const res = validateUploadBatch(files);
    assert.ok(res, "expected a rejection");
    assert.equal(res.status, 400);
    assert.ok(res.error.includes(String(MAX_FILES)), res.error);
  });

  it("accepts exactly 12 files", () => {
    const files = Array.from({ length: MAX_FILES }, () => file(0.1));
    assert.equal(validateUploadBatch(files), null);
  });
});
