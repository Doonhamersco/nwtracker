import { NextRequest, NextResponse } from "next/server";
import { deleteManualSpendingLine, ManualSpendingError } from "@/lib/services/manual-spending";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const view = deleteManualSpendingLine(id);
    return NextResponse.json(view);
  } catch (err) {
    if (err instanceof ManualSpendingError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("[DELETE /api/spending/manual/lines/[id]]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to delete expense", detail: message }, { status: 500 });
  }
}
