import { NextRequest, NextResponse } from "next/server";
import { addManualSpendingLine, ManualSpendingError } from "@/lib/services/manual-spending";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const date = "date" in body ? body.date : null;
  const category = "category" in body ? body.category : null;
  const amountGbp = "amountGbp" in body ? body.amountGbp : null;
  const note = "note" in body ? body.note : null;
  if (typeof date !== "string" || typeof category !== "string" || typeof amountGbp !== "number") {
    return NextResponse.json({ error: "Date, category, and amount are required" }, { status: 422 });
  }
  if (note !== null && note !== undefined && typeof note !== "string") {
    return NextResponse.json({ error: "Note must be text" }, { status: 422 });
  }

  try {
    const view = addManualSpendingLine({
      date,
      category,
      amountGbp,
      note: typeof note === "string" ? note : null,
    });
    return NextResponse.json(view, { status: 201 });
  } catch (err) {
    if (err instanceof ManualSpendingError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("[POST /api/spending/manual/lines]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to add expense", detail: message }, { status: 500 });
  }
}
