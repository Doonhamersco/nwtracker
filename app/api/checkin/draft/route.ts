import { NextResponse } from "next/server";
import { buildCheckinDraft } from "@/lib/services/checkin";

export async function GET() {
  try {
    const draft = await buildCheckinDraft();
    return NextResponse.json(draft);
  } catch (err) {
    console.error("[GET /api/checkin/draft]", err);
    return NextResponse.json(
      { error: "Failed to build check-in draft" },
      { status: 500 }
    );
  }
}
