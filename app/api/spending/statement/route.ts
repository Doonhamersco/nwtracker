import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ChaseStatementParseError } from "@/lib/spending/chase-statement";
import { extractPdfText } from "@/lib/spending/pdf-text";
import { previewChaseStatement, saveChaseStatement } from "@/lib/services/statement-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/spending/statement
 *
 * Signed-in dashboard upload. `intent=preview` parses a Chase UK statement
 * PDF. `intent=save` parses it again and inserts rows through the same
 * import used by POST /api/import/transactions, which skips duplicates.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a PDF upload." }, { status: 400 });
  }

  const intent = form.get("intent") === "save" ? "save" : "preview";
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a statement PDF." }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const typeOk =
    type === "" || type === "application/pdf" || type === "application/x-pdf" || name.endsWith(".pdf");
  if (!typeOk || !name.endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF statements can be imported." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That PDF is empty or larger than 8 MB." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) {
    return NextResponse.json({ error: "That file is not a PDF." }, { status: 400 });
  }

  try {
    const text = await extractPdfText(bytes);
    if (intent === "save") {
      const result = saveChaseStatement(text);
      return NextResponse.json({
        inserted: result.inserted,
        skipped: result.skipped,
        balanceCheck: result.balanceCheck,
        statementMonth: result.statementMonth,
        accountId: result.accountId,
      });
    }
    const preview = previewChaseStatement(text);
    return NextResponse.json(preview);
  } catch (err) {
    if (err instanceof ChaseStatementParseError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("[POST /api/spending/statement]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Could not read that statement.", detail: message },
      { status: 500 }
    );
  }
}

function isPdf(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}
