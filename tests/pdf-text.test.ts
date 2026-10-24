import { describe, expect, it } from "vitest";
import { extractPdfText } from "@/lib/spending/pdf-text";

describe("extractPdfText", () => {
  it("reads lines from a synthetic PDF", async () => {
    const text = await extractPdfText(minimalPdf(["01 Sep 2026 NORTHWIND GROCERS", "Purchase"]));
    expect(text).toContain("01 Sep 2026 NORTHWIND GROCERS");
    expect(text).toContain("Purchase");
  });
});

function minimalPdf(lines: string[]): Uint8Array {
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = lines
    .map((line, index) => `BT /F1 12 Tf 50 ${740 - index * 18} Td (${escape(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
    `4 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xrefAt = Buffer.byteLength(body);
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index++) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += xref;
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new Uint8Array(Buffer.from(body));
}
