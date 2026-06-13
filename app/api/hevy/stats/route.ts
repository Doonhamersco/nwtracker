import { NextResponse } from "next/server";
import { hevyClient, HevyApiError } from "@/lib/hevy/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await hevyClient.getStats();
    return NextResponse.json(stats);
  } catch (err) {
    if (err instanceof HevyApiError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status === 401 ? 401 : 502 },
      );
    }
    if (err instanceof Error && err.message.includes("HEVY_API_KEY")) {
      return NextResponse.json({ error: "HEVY_API_KEY not configured" }, { status: 500 });
    }
    console.error("[hevy/stats]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
