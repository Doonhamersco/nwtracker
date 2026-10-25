import fs from "fs";
import path from "path";
import { currentScope, requireUser } from "@/lib/users/context";
import {
  isEmailAllowed,
  isOwnerEmail,
  ownerEmail,
  scopeFromEmail,
  type UserScope,
} from "@/lib/users/identity";
import { ensureUserMarker } from "@/lib/users/marker";
import { readTokenFile, writeTokenFile } from "@/lib/strava/token-file";
import {
  dataRoot,
  EMAIL_FILE,
  HEVY_KEY_FILE,
  STRAVA_TOKEN_FILE,
  userDir,
} from "@/lib/users/paths";

function ensureUserDir(scope: UserScope): string {
  return ensureUserMarker(scope);
}

export function readStoredEmail(userId: string): string | null {
  try {
    const raw = fs.readFileSync(path.join(userDir(userId), EMAIL_FILE), "utf8");
    const scope = scopeFromEmail(raw);
    return scope?.email ?? null;
  } catch {
    return null;
  }
}

export function hevyKeyPath(userId: string): string {
  return path.join(userDir(userId), HEVY_KEY_FILE);
}

export function readHevyApiKey(userId: string): string | null {
  try {
    const key = fs.readFileSync(hevyKeyPath(userId), "utf8").trim();
    if (!key || /[\r\n]/.test(key)) return null;
    return key;
  } catch {
    return null;
  }
}

function assertSecret(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500 || /[\r\n]/.test(trimmed)) {
    throw new Error(`Invalid ${label}`);
  }
  return trimmed;
}

export function saveHevyApiKey(apiKey: string): void {
  const scope = requireUser();
  const key = assertSecret(apiKey, "Hevy API key");
  ensureUserDir(scope);
  fs.writeFileSync(hevyKeyPath(scope.userId), key, { mode: 0o600 });
}

export function clearHevyApiKey(): void {
  const scope = requireUser();
  const file = hevyKeyPath(scope.userId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function hevyApiKeyForScope(scope: UserScope | null): string {
  if (scope) {
    const stored = readHevyApiKey(scope.userId);
    if (stored) return stored;
    if (isOwnerEmail(scope.email)) {
      const env = process.env.HEVY_API_KEY?.trim();
      if (env) return env;
    }
    throw new Error("HEVY_API_KEY environment variable is not set.");
  }
  const env = process.env.HEVY_API_KEY?.trim();
  if (!env) throw new Error("HEVY_API_KEY environment variable is not set.");
  return env;
}

export function hevyConfigured(): boolean {
  try {
    hevyApiKeyForScope(currentScope());
    return true;
  } catch (err) {
    if (err instanceof Error && err.message.includes("required to access data")) throw err;
    if (err instanceof Error && err.message.includes("invite list")) throw err;
    return false;
  }
}

/** Cron syncs the owner when the env key is set, plus anyone who saved their own key. */
export function hevySyncTargets(): string[] {
  const found = new Set<string>();
  const owner = ownerEmail();
  if (owner && (process.env.HEVY_API_KEY?.trim() || readHevyApiKey(userIdOf(owner)))) {
    found.add(owner);
  }
  const root = path.join(dataRoot(), "users");
  if (!fs.existsSync(root)) return [...found];
  for (const entry of fs.readdirSync(root)) {
    if (!/^[0-9a-f]{64}$/.test(entry)) continue;
    if (!readHevyApiKey(entry)) continue;
    const email = readStoredEmail(entry);
    if (email && isEmailAllowed(email)) found.add(email);
  }
  return [...found];
}

function userIdOf(email: string): string {
  const scope = scopeFromEmail(email);
  if (!scope) throw new Error("User is not on the invite list");
  return scope.userId;
}

export function stravaTokenPathFor(userId: string): string {
  return path.join(userDir(userId), STRAVA_TOKEN_FILE);
}

export function stravaEnvForUser(userId: string | null): {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
} {
  const env = {
    clientId: process.env.STRAVA_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.STRAVA_CLIENT_SECRET?.trim() ?? "",
    refreshToken: process.env.STRAVA_REFRESH_TOKEN?.trim() ?? "",
  };
  if (!userId) return env;
  const owner = ownerEmail();
  if (owner && userIdOf(owner) === userId) return env;
  return { clientId: env.clientId, clientSecret: env.clientSecret, refreshToken: "" };
}

export function saveStravaRefreshToken(refreshToken: string): void {
  const scope = requireUser();
  const token = assertSecret(refreshToken, "Strava refresh token");
  ensureUserDir(scope);
  const env = stravaEnvForUser(scope.userId);
  writeTokenFile(stravaTokenPathFor(scope.userId), {
    accessToken: "",
    refreshToken: token,
    expiresAt: 0,
    envRefreshToken: env.refreshToken,
  });
  forgetStravaGateway(scope.userId);
}

export function clearStravaRefreshToken(): void {
  const scope = requireUser();
  const file = stravaTokenPathFor(scope.userId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  forgetStravaGateway(scope.userId);
}

export function hasStravaRefreshToken(userId: string): boolean {
  return Boolean(readTokenFile(stravaTokenPathFor(userId))?.refreshToken);
}

let forgetStravaGateway: (userId: string) => void = () => {};

export function registerStravaGatewayReset(reset: (userId: string) => void): void {
  forgetStravaGateway = reset;
}
