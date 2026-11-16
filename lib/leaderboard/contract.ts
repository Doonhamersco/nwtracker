export const LEADERBOARD_GAMES = ["legislation", "elements"] as const;

export type LeaderboardGame = (typeof LEADERBOARD_GAMES)[number];

export interface LeaderboardEntry {
  name: string;
  timeMs: number;
  at: string;
}

const MIN_TIME_MS = 5000;
const MAX_TIME_MS = 7_200_000;
const MAX_NAME = 20;

export function isLeaderboardGame(value: string): value is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(value);
}

/** Strip control characters and angle brackets, then trim. */
export function sanitizeLeaderboardName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/[\u0000-\u001F\u007F-\u009F<>]/g, "").trim();
  if (name.length < 1 || name.length > MAX_NAME) return null;
  return name;
}

export function parseLeaderboardTimeMs(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw)) return null;
  if (raw < MIN_TIME_MS || raw > MAX_TIME_MS) return null;
  return raw;
}

/** Fastest first. Equal times keep the earlier timestamp ahead. */
export function sortLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => a.timeMs - b.timeMs || a.at.localeCompare(b.at));
}

export function leaderboardValidationError(body: {
  name?: unknown;
  timeMs?: unknown;
}): string | null {
  if (sanitizeLeaderboardName(body.name) === null) {
    return "Name must be 1–20 characters";
  }
  if (parseLeaderboardTimeMs(body.timeMs) === null) {
    return "timeMs must be an integer between 5000 and 7200000";
  }
  return null;
}
