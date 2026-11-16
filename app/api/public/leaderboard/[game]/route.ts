import { NextRequest, NextResponse } from "next/server";
import {
  isLeaderboardGame,
  leaderboardValidationError,
  parseLeaderboardTimeMs,
  sanitizeLeaderboardName,
} from "@/lib/leaderboard/contract";
import { allowLeaderboardPost, clientIpFromHeaders } from "@/lib/leaderboard/rate-limit";
import {
  readLeaderboard,
  submitLeaderboardScore,
  topLeaderboardEntries,
  withLeaderboardLock,
} from "@/lib/leaderboard/store";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ game: string }> }
) {
  const { game } = await params;
  if (!isLeaderboardGame(game)) return json({ error: "Unknown game" }, 404);
  try {
    const entries = topLeaderboardEntries(readLeaderboard(game));
    return json({ game, entries }, 200);
  } catch (err) {
    console.error("[GET /api/public/leaderboard]", err);
    return json({ error: "Leaderboard unavailable" }, 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ game: string }> }
) {
  const { game } = await params;
  if (!isLeaderboardGame(game)) return json({ error: "Unknown game" }, 404);

  if (!allowLeaderboardPost(clientIpFromHeaders(req.headers))) {
    return json({ error: "Too many scores. Try again in a minute." }, 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "Invalid JSON" }, 400);

  const record = body as { name?: unknown; timeMs?: unknown };
  const message = leaderboardValidationError(record);
  if (message) return json({ error: message }, 400);

  const name = sanitizeLeaderboardName(record.name);
  const timeMs = parseLeaderboardTimeMs(record.timeMs);
  if (name === null || timeMs === null) return json({ error: "Invalid score" }, 400);

  try {
    const result = await withLeaderboardLock(game, () =>
      submitLeaderboardScore(game, name, timeMs, new Date().toISOString())
    );
    return json({ ok: true, rank: result.rank, entries: result.entries }, 201);
  } catch (err) {
    console.error("[POST /api/public/leaderboard]", err);
    return json({ error: "Leaderboard unavailable" }, 500);
  }
}
