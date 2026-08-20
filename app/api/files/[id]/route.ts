import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getFile, deleteFile } from "@/lib/services/files";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const result = getFile(id);
    if (!result) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const { row, absolutePath } = result;

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json(
        { error: "File not found on disk" },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(absolutePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": row.mimeType,
        "Content-Disposition": `inline; filename="${row.displayName}"`,
        "Content-Length": String(fileBuffer.length),
      },
    });
  } catch (err) {
    console.error("[GET /api/files/[id]]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to serve file", detail: message },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const result = getFile(id);
    if (!result) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    deleteFile(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/files/[id]]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete file", detail: message },
      { status: 500 }
    );
  }
}
