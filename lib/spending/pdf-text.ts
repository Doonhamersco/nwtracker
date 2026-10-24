import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

interface TextItem {
  str?: string;
  transform?: number[];
}

/**
 * Extract statement text with pdf.js, grouping glyphs into visual lines.
 * The worker is loaded from node_modules so the same path works in the Fly image.
 */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const require = createRequire(process.cwd() + "/package.json");
  const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

  const doc = await pdfjs
    .getDocument({
      data,
      disableFontFace: true,
      isEvalSupported: false,
      useSystemFonts: true,
      verbosity: 0,
    })
    .promise;

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(linesFromItems(content.items as TextItem[]));
  }
  return pages.join("\n");
}

function linesFromItems(items: TextItem[]): string {
  const positioned = items
    .filter((item) => item.str && item.str.trim() && item.transform)
    .map((item) => ({
      str: item.str as string,
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
    }));

  const lines: { y: number; parts: { x: number; str: string }[] }[] = [];
  for (const item of positioned.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find((entry) => Math.abs(entry.y - item.y) < 2);
    if (line) line.parts.push(item);
    else lines.push({ y: item.y, parts: [item] });
  }

  return lines
    .map((line) =>
      line.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((line) => line.length > 0)
    .join("\n");
}
