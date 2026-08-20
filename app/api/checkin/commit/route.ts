import { NextRequest, NextResponse } from "next/server";
import { commitCheckin } from "@/lib/services/checkin";
import { commitCheckinSchema } from "@/lib/validators/checkin";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = commitCheckinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const result = await commitCheckin(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[POST /api/checkin/commit]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to commit snapshot", detail: message },
      { status: 500 }
    );
  }
}
