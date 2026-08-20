import { NextRequest, NextResponse } from "next/server";
import { getSnapshotById } from "@/lib/services/checkin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const data = getSnapshotById(id);
    if (!data) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[GET /api/snapshots/${id}]`, err);
    return NextResponse.json(
      { error: "Failed to fetch snapshot" },
      { status: 500 }
    );
  }
}
