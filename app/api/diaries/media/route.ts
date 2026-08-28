import { NextRequest, NextResponse } from "next/server";
import { getObjectBytes, isDiaryObjectKey, uploadObjectStream } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!isDiaryObjectKey(key)) {
    return NextResponse.json({ error: "Invalid object key" }, { status: 400 });
  }
  try {
    const bytes = await getObjectBytes(key);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[GET /api/diaries/media]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to download", detail: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!isDiaryObjectKey(key)) {
    return NextResponse.json({ error: "Invalid object key" }, { status: 400 });
  }
  if (!req.body) {
    return NextResponse.json({ error: "Missing body" }, { status: 400 });
  }

  try {
    await uploadObjectStream(key, req.body);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[PUT /api/diaries/media]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to upload", detail: message }, { status: 500 });
  }
}
