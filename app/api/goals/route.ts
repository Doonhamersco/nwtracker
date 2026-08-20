import { NextRequest, NextResponse } from "next/server";
import { listGoals, createGoal } from "@/lib/services/goals";
import { createGoalSchema } from "@/lib/validators/goals";

export async function GET() {
  try {
    const goals = listGoals();
    return NextResponse.json(goals);
  } catch (err) {
    console.error("[GET /api/goals]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to list goals", detail: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createGoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const goal = createGoal(parsed.data);
    return NextResponse.json(goal, { status: 201 });
  } catch (err) {
    console.error("[POST /api/goals]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to create goal", detail: message }, { status: 500 });
  }
}
