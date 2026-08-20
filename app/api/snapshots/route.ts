import { NextRequest, NextResponse } from "next/server";
import { getSnapshotHistory } from "@/lib/services/checkin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "120"), 600);

  try {
    const history = getSnapshotHistory(limit);
    return NextResponse.json(history);
  } catch (err) {
    console.error("[GET /api/snapshots]", err);
    return NextResponse.json(
      { error: "Failed to fetch snapshots" },
      { status: 500 }
    );
  }
}
