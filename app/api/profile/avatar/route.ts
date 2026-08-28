import { NextRequest, NextResponse } from "next/server";
import {
  clearAvatar,
  readAvatar,
  saveAvatar,
} from "@/lib/services/profile";

export async function GET() {
  try {
    const avatar = readAvatar();
    if (!avatar) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(avatar.data), {
      status: 200,
      headers: {
        "Content-Type": avatar.mimeType,
        "Content-Length": String(avatar.data.length),
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[GET /api/profile/avatar]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to serve avatar", detail: message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
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
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file field is required" }, { status: 400 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = Buffer.from(arrayBuffer);
    const mimeType = file.type || "application/octet-stream";
    const settings = saveAvatar(data, mimeType);
    return NextResponse.json(settings);
  } catch (err) {
    console.error("[PUT /api/profile/avatar]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const status =
      message.includes("2MB") ? 413 : message.includes("JPEG") ? 422 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Failed to save avatar" : message, detail: message },
      { status }
    );
  }
}

export async function DELETE() {
  try {
    const settings = clearAvatar();
    return NextResponse.json(settings);
  } catch (err) {
    console.error("[DELETE /api/profile/avatar]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to remove avatar", detail: message },
      { status: 500 }
    );
  }
}
