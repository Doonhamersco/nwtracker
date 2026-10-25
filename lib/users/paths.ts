import path from "path";
import { userIdFromEmail } from "@/lib/users/identity";

/** Volume root. Fly sets DATA_DIR=/data and DB_PATH=/data/nwtracker.db. */
export function dataRoot(): string {
  if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR);
  return path.dirname(legacyDbPath());
}

export function legacyDbPath(): string {
  if (process.env.DB_PATH) return path.resolve(process.env.DB_PATH);
  return path.resolve(process.cwd(), "data", "nwtracker.db");
}

export function usersRoot(): string {
  return path.join(dataRoot(), "users");
}

export function userDir(userId: string): string {
  if (!/^[0-9a-f]{64}$/.test(userId)) {
    throw new Error("Invalid user id");
  }
  return path.join(usersRoot(), userId);
}

export function userDbPath(userId: string): string {
  return path.join(userDir(userId), "nwtracker.db");
}

export function userDbPathForEmail(email: string): string {
  return userDbPath(userIdFromEmail(email));
}

export function migrationMarkerPath(): string {
  return path.join(usersRoot(), ".migration-complete");
}

export const HEVY_KEY_FILE = "hevy-api-key";
export const STRAVA_TOKEN_FILE = "strava-oauth.json";
export const EMAIL_FILE = "email";
