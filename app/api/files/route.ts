import { NextRequest, NextResponse } from "next/server";
import { saveFile, listFiles, type FileLinkType } from "@/lib/services/files";
import { fileLinkTypeEnum } from "@/db/schema";

const FILE_LINK_TYPES = new Set<string>(fileLinkTypeEnum);

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

  if (!FILE_LINK_TYPES.has(linkedToType)) {
    return NextResponse.json(
      { error: "linkedToType must be ACCOUNT, SNAPSHOT, GOAL, or SUBSCRIPTION" },
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
      linkedToType: linkedToType as FileLinkType,
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
