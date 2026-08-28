import { NextRequest, NextResponse } from "next/server";
import {
  listSubscriptions,
  createSubscription,
} from "@/lib/services/subscriptions";
import { createSubscriptionSchema } from "@/lib/validators/subscriptions";

export async function GET() {
  try {
    const items = listSubscriptions();
    return NextResponse.json(items);
  } catch (err) {
    console.error("[GET /api/subscriptions]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to list subscriptions", detail: message },
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

  const parsed = createSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const subscription = createSubscription(parsed.data);
    return NextResponse.json(subscription, { status: 201 });
  } catch (err) {
    console.error("[POST /api/subscriptions]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create subscription", detail: message },
      { status: 500 }
    );
  }
}
