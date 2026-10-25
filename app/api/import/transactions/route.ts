import { NextResponse } from "next/server";
import { bearerMatches } from "@/lib/auth/bearer";
import { importTransactions } from "@/lib/services/transactions";
import { importTransactionsSchema } from "@/lib/validators/transactions";
import { resolveImportTarget } from "@/lib/users/import-target";
import { runAsUser } from "@/lib/users/context";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * POST /api/import/transactions
 *
 * Session-exempt (see proxy.ts). Requires Authorization: Bearer
 * matching IMPORT_API_TOKEN. Disabled (401) when that env var is unset.
 */
export async function POST(req: Request) {
  const secret = process.env.IMPORT_API_TOKEN;
  if (!secret || !bearerMatches(req.headers.get("authorization"), secret)) {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = importTransactionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  let target: string;
  try {
    target = resolveImportTarget(parsed.data.userEmail);
  } catch {
    return NextResponse.json({ error: "User is not on the invite list" }, { status: 403 });
  }

  try {
    const statement = {
      account: parsed.data.account,
      statementMonth: parsed.data.statementMonth,
      openingBalance: parsed.data.openingBalance,
      closingBalance: parsed.data.closingBalance,
      transactions: parsed.data.transactions,
    };
    const result = runAsUser(target, () => importTransactions(statement));
    return NextResponse.json({
      inserted: result.inserted,
      skipped: result.skipped,
      balanceCheck: result.balanceCheck,
      accountId: result.accountId,
      importBatchId: result.importBatchId,
    });
  } catch (err) {
    console.error("[POST /api/import/transactions]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to import transactions", detail: message },
      { status: 500 }
    );
  }
}
