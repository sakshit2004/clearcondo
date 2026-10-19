import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractPdfText } from "../extract.ts";

/**
 * Build a minimal valid multi-page PDF in pure JS (no fixtures, no deps).
 * Every page carries enough text to clear the scanned-PDF threshold.
 */
function makePdf(numPages: number): Uint8Array {
  const objects: string[] = [];
  const pageNums: number[] = [];
  const contentNums: number[] = [];
  let next = 3;
  for (let i = 0; i < numPages; i++) {
    pageNums.push(next++);
    contentNums.push(next++);
  }
  const fontNum = next++;
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageNums
    .map((n) => `${n} 0 R`)
    .join(" ")}] /Count ${numPages} >>`;
  for (let i = 0; i < numPages; i++) {
    const text = `Page ${i + 1} of the test document. This sentence exists so the page holds well over fifty characters of extractable text.`;
    const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
    objects[pageNums[i]] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 ${fontNum} 0 R >> >> /Contents ${contentNums[i]} 0 R >>`;
    objects[contentNums[i]] =
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }
  objects[fontNum] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  // ASCII-only, so string length === byte offset.
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let n = 1; n <= fontNum; n++) {
    offsets[n] = pdf.length;
    pdf += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${fontNum + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= fontNum; n++) {
    pdf += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${fontNum + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefPos}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

describe("extractPdfText page counts", () => {
  it("exposes the uncapped totalPages alongside the capped pageCount", async () => {
    const doc = await extractPdfText("file-0", "big.pdf", makePdf(105));
    assert.equal(doc.totalPages, 105);
    assert.equal(doc.pageCount, 100); // maxTextPages() cap for the text path
    assert.equal(doc.truncated, true);
    assert.ok(!doc.isScanned);
  });

  it("totalPages equals pageCount for small documents", async () => {
    const doc = await extractPdfText("file-0", "small.pdf", makePdf(3));
    assert.equal(doc.totalPages, 3);
    assert.equal(doc.pageCount, 3);
    assert.equal(doc.truncated, false);
    assert.equal(doc.pages.length, 3);
    assert.match(doc.pages[0].text, /Page 1 of the test document/);
  });
});
