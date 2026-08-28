import { NextRequest, NextResponse } from "next/server";
import { diaryPresignSchema } from "@/lib/validators/diaries";
import { presignGetUrl, presignPutUrl } from "@/lib/r2";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = diaryPresignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const url =
      parsed.data.purpose === "put"
        ? await presignPutUrl(parsed.data.key)
        : await presignGetUrl(parsed.data.key);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[POST /api/diaries/presign]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to sign URL", detail: message }, { status: 500 });
  }
}
