import { NextRequest, NextResponse } from "next/server";
import { saveFile, listFiles } from "@/lib/services/files";

export async function GET(req: NextRequest) {
  const linkedToType = req.nextUrl.searchParams.get("linkedToType");
  const linkedToId = req.nextUrl.searchParams.get("linkedToId");

  if (!linkedToType || !linkedToId) {
    return NextResponse.json(
      { error: "linkedToType and linkedToId query params are required" },
      { status: 400 }
    );
  }

  try {
    const rows = listFiles(linkedToType, linkedToId);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/files]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to list files", detail: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Failed to parse form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const linkedToType = formData.get("linkedToType");
  const linkedToId = formData.get("linkedToId");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file field is required" }, { status: 400 });
  }
  if (!linkedToType || typeof linkedToType !== "string") {
    return NextResponse.json(
      { error: "linkedToType field is required" },
      { status: 400 }
    );
  }
  if (!linkedToId || typeof linkedToId !== "string") {
    return NextResponse.json(
      { error: "linkedToId field is required" },
      { status: 400 }
    );
  }

  if (!["ACCOUNT", "SNAPSHOT", "GOAL"].includes(linkedToType)) {
    return NextResponse.json(
      { error: "linkedToType must be ACCOUNT, SNAPSHOT, or GOAL" },
      { status: 422 }
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = Buffer.from(arrayBuffer);

    const row = saveFile({
      displayName: file.name,
      mimeType: file.type || "application/octet-stream",
      data,
      linkedToType: linkedToType as "ACCOUNT" | "SNAPSHOT" | "GOAL",
      linkedToId,
    });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("[POST /api/files]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to save file", detail: message },
      { status: 500 }
    );
  }
}
