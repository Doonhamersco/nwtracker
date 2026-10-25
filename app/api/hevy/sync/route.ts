import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bearerMatches } from "@/lib/auth/bearer";
import { hevyClient, HevyApiError } from "@/lib/hevy/client";
import { fillMissingHevyReadingsForLatestSnapshot } from "@/lib/services/checkin";
import { isEmailAllowed } from "@/lib/users/identity";
import { runAsUser } from "@/lib/users/context";
import { hevySyncTargets } from "@/lib/users/secrets";

export const dynamic = "force-dynamic";

/**
 * POST /api/hevy/sync
 *
 * Verifies the API key, fetches a summary, and attaches Hevy life-metric
 * readings to the latest snapshot when they are missing.
 * Requires a logged-in session, or Authorization: Bearer HEVY_SYNC_TOKEN
 * for cron. The token is disabled when that env var is unset.
 */
async function syncCurrentUser() {
  const [userInfo, count, stats] = await Promise.all([
    hevyClient.getUserInfo(),
    hevyClient.getWorkoutCount(),
    hevyClient.getStats(),
  ]);
  const repaired = await fillMissingHevyReadingsForLatestSnapshot();
  return {
    ok: true as const,
    user: userInfo.user,
    total_workouts: count,
    stats,
    repaired,
    synced_at: new Date().toISOString(),
  };
}

function syncError(err: unknown) {
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

export async function POST(req: Request) {
  const session = await auth();
  const cronAuthorised = bearerMatches(
    req.headers.get("authorization"),
    process.env.HEVY_SYNC_TOKEN
  );
  if (!session?.user && !cronAuthorised) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (session?.user?.email) {
    if (!isEmailAllowed(session.user.email)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    try {
      return NextResponse.json(await runAsUser(session.user.email, () => syncCurrentUser()));
    } catch (err) {
      return syncError(err);
    }
  }

  const targets = hevySyncTargets();
  const results: Array<{ ok: boolean }> = [];
  for (const email of targets) {
    try {
      await runAsUser(email, () => syncCurrentUser());
      results.push({ ok: true });
    } catch (err) {
      console.error("[hevy/sync] user sync failed");
      results.push({ ok: false });
      if (targets.length === 1) return syncError(err);
    }
  }
  return NextResponse.json({
    ok: results.every((result) => result.ok),
    users: results.length,
    synced_at: new Date().toISOString(),
  });
}
