import { NextRequest, NextResponse } from "next/server";
import { getGoalById, updateGoal, deleteGoal } from "@/lib/services/goals";
import { updateGoalSchema } from "@/lib/validators/goals";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const goal = getGoalById(id);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    return NextResponse.json(goal);
  } catch (err) {
    console.error("[GET /api/goals/[id]]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to get goal", detail: message }, { status: 500 });
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

  const parsed = updateGoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const goal = updateGoal(id, parsed.data);
    return NextResponse.json(goal);
  } catch (err) {
    console.error("[PATCH /api/goals/[id]]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update goal", detail: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    deleteGoal(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/goals/[id]]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to delete goal", detail: message }, { status: 500 });
  }
}
