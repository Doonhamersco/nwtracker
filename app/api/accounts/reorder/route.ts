import { NextRequest, NextResponse } from "next/server";
import { reorderAccounts } from "@/lib/services/accounts";
import { reorderAccountsSchema } from "@/lib/validators/accounts";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reorderAccountsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    reorderAccounts(parsed.data.orderedIds);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/accounts/reorder]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to reorder accounts", detail: message },
      { status: 500 }
    );
  }
}
