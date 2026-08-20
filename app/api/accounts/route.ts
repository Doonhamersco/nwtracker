import { NextRequest, NextResponse } from "next/server";
import { listAccounts, createAccount } from "@/lib/services/accounts";
import { createAccountSchema } from "@/lib/validators/accounts";

export async function GET(req: NextRequest) {
  try {
    const includeInactive =
      req.nextUrl.searchParams.get("includeInactive") === "true";
    const rows = listAccounts(includeInactive);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/accounts]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to list accounts", detail: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const account = createAccount(parsed.data);
    return NextResponse.json(account, { status: 201 });
  } catch (err) {
    console.error("[POST /api/accounts]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create account", detail: message },
      { status: 500 }
    );
  }
}
