import { NextRequest, NextResponse } from "next/server";
import { addRecurringSubscription } from "@/lib/services/spending";
import { addRecurringSubscriptionSchema } from "@/lib/validators/transactions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = addRecurringSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const subscription = addRecurringSubscription(parsed.data);
    return NextResponse.json(subscription, { status: 201 });
  } catch (err) {
    console.error("[POST /api/spending/recurring]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to add subscription", detail: message },
      { status: 500 }
    );
  }
}
