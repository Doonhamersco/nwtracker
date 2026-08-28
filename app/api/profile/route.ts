import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateAccentColor } from "@/lib/services/profile";
import { updateProfileSchema } from "@/lib/validators/profile";

export async function GET() {
  try {
    return NextResponse.json(getSettings());
  } catch (err) {
    console.error("[GET /api/profile]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load profile", detail: message },
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

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const settings = updateAccentColor(parsed.data.accentColor);
    return NextResponse.json(settings);
  } catch (err) {
    console.error("[PATCH /api/profile]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update profile", detail: message },
      { status: 500 }
    );
  }
}
