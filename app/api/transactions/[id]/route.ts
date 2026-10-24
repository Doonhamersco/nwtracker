import { NextRequest, NextResponse } from "next/server";
import { updateTransaction } from "@/lib/services/transactions";
import { updateTransactionSchema } from "@/lib/validators/transactions";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const row = updateTransaction(id, parsed.data);
    return NextResponse.json(row);
  } catch (err) {
    console.error("[PATCH /api/transactions/[id]]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to update transaction", detail: message },
      { status: 500 }
    );
  }
}
