import { NextRequest, NextResponse } from "next/server";
import { getPlan, updateCareerPlan } from "@/lib/services/career-plan";
import { updateCareerPlanSchema } from "@/lib/validators/career-plan";

export async function GET() {
  try {
    return NextResponse.json(getPlan());
  } catch (err) {
    console.error("[GET /api/plan]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load plan", detail: message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateCareerPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    return NextResponse.json(updateCareerPlan(parsed.data));
  } catch (err) {
    console.error("[PATCH /api/plan]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update plan", detail: message },
      { status: 500 }
    );
  }
}
