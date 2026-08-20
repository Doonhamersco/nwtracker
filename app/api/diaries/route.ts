import { NextRequest, NextResponse } from "next/server";
import { listDiaries, createDiary } from "@/lib/services/diaries";
import { createDiarySchema } from "@/lib/validators/diaries";

export async function GET() {
  try {
    const diaries = listDiaries();
    return NextResponse.json(diaries);
  } catch (err) {
    console.error("[GET /api/diaries]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to list diaries", detail: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createDiarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const diary = createDiary(parsed.data);
    return NextResponse.json(diary, { status: 201 });
  } catch (err) {
    console.error("[POST /api/diaries]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to create diary", detail: message }, { status: 500 });
  }
}
