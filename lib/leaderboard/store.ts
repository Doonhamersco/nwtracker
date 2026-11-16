import fs from "fs";
import path from "path";
import {
  sortLeaderboardEntries,
  type LeaderboardEntry,
  type LeaderboardGame,
} from "@/lib/leaderboard/contract";

const TOP_RESPONSE = 20;
const MAX_STORED = 500;

const writeChain = new Map<string, Promise<unknown>>();

export function leaderboardDirectory(): string {
  const root = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : "/data";
  return path.join(root, "leaderboard");
}

export function leaderboardFile(game: LeaderboardGame): string {
  return path.join(leaderboardDirectory(), `${game}.json`);
}

export function readLeaderboard(game: LeaderboardGame): LeaderboardEntry[] {
  const file = leaderboardFile(game);
  if (!fs.existsSync(file)) return [];
  const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("Leaderboard file is not a list");
  return sortLeaderboardEntries(parsed.filter(isStoredEntry));
}

export function topLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries.slice(0, TOP_RESPONSE);
}

export interface SubmittedScore {
  rank: number;
  entries: LeaderboardEntry[];
}

export function submitLeaderboardScore(
  game: LeaderboardGame,
  name: string,
  timeMs: number,
  at: string
): SubmittedScore {
  const existing = readLeaderboard(game);
  const entry: LeaderboardEntry = { name, timeMs, at };
  const combined = sortLeaderboardEntries([...existing, entry]);
  const rank = combined.indexOf(entry) + 1;
  const stored = combined.slice(0, MAX_STORED);
  writeLeaderboard(game, stored);
  return { rank, entries: topLeaderboardEntries(stored) };
}

export function withLeaderboardLock<T>(game: LeaderboardGame, fn: () => T): Promise<T> {
  const previous = writeChain.get(game) ?? Promise.resolve();
  const run = previous.then(() => fn(), () => fn());
  writeChain.set(
    game,
    run.then(
      () => undefined,
      () => undefined
    )
  );
  return run;
}

function writeLeaderboard(game: LeaderboardGame, entries: LeaderboardEntry[]): void {
  const dir = leaderboardDirectory();
  fs.mkdirSync(dir, { recursive: true });
  const target = leaderboardFile(game);
  const temporary = path.join(dir, `.${game}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(temporary, `${JSON.stringify(entries)}\n`, { mode: 0o644 });
  fs.renameSync(temporary, target);
}

function isStoredEntry(value: unknown): value is LeaderboardEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<LeaderboardEntry>;
  return (
    typeof row.name === "string" &&
    typeof row.timeMs === "number" &&
    Number.isInteger(row.timeMs) &&
    typeof row.at === "string"
  );
}
