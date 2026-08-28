import { NextRequest, NextResponse } from "next/server";
import {
  getSubscriptionById,
  updateSubscription,
  deleteSubscription,
} from "@/lib/services/subscriptions";
import { updateSubscriptionSchema } from "@/lib/validators/subscriptions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const item = getSubscriptionById(id);
    if (!item) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(item);
  } catch (err) {
    console.error("[GET /api/subscriptions/[id]]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to get subscription", detail: message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const subscription = updateSubscription(id, parsed.data);
    return NextResponse.json(subscription);
  } catch (err) {
    console.error("[PATCH /api/subscriptions/[id]]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to update subscription", detail: message },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    deleteSubscription(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/subscriptions/[id]]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete subscription", detail: message },
      { status: 500 }
    );
  }
}
