import { NextResponse } from "next/server";
import { hevyClient, HevyApiError } from "@/lib/hevy/client";
import { fillMissingHevyReadingsForLatestSnapshot } from "@/lib/services/checkin";

export const dynamic = "force-dynamic";

/**
 * POST /api/hevy/sync
 *
 * Verifies the API key, fetches a summary, and attaches Hevy life-metric
 * readings to the latest snapshot when they are missing.
 */
export async function POST() {
  try {
    const [userInfo, count, stats] = await Promise.all([
      hevyClient.getUserInfo(),
      hevyClient.getWorkoutCount(),
      hevyClient.getStats(),
    ]);

    const repaired = await fillMissingHevyReadingsForLatestSnapshot();

    return NextResponse.json({
      ok: true,
      user: userInfo.user,
      total_workouts: count,
      stats,
      repaired,
      synced_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof HevyApiError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.status === 401 ? 401 : 502 },
      );
    }
    if (err instanceof Error && err.message.includes("HEVY_API_KEY")) {
      return NextResponse.json(
        { ok: false, error: "HEVY_API_KEY not configured" },
        { status: 500 },
      );
    }
    console.error("[hevy/sync]", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
