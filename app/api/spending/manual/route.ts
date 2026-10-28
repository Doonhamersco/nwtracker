import { NextRequest, NextResponse } from "next/server";
import { ManualSpendingError, saveManualCategoryTotals } from "@/lib/services/manual-spending";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const month = body && typeof body === "object" && "month" in body ? body.month : null;
  const amounts = body && typeof body === "object" && "amounts" in body ? body.amounts : null;
  if (typeof month !== "string" || !Array.isArray(amounts)) {
    return NextResponse.json({ error: "Month and amounts are required" }, { status: 422 });
  }

  const parsed = amounts.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const category = "category" in row ? row.category : null;
    const amountGbp = "amountGbp" in row ? row.amountGbp : null;
    if (typeof category !== "string" || typeof amountGbp !== "number") return [];
    return [{ category, amountGbp }];
  });
  if (parsed.length !== amounts.length) {
    return NextResponse.json({ error: "Each amount needs a category and a number" }, { status: 422 });
  }

  try {
    const view = saveManualCategoryTotals(month, parsed);
    return NextResponse.json(view);
  } catch (err) {
    if (err instanceof ManualSpendingError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("[POST /api/spending/manual]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to save spending", detail: message }, { status: 500 });
  }
}
