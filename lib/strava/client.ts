import fs from "fs";
import path from "path";
import { addDays, londonToday } from "@/lib/training/dates";
import { summarizeCardio, isTimeTrialDistance, MIN_EFFORT_DISTANCE_METERS } from "./metrics";
import { readTokenFile, writeTokenFile, type TokenSet } from "./token-file";
import { activeDataDir, currentScope } from "@/lib/users/context";
import { registerStravaGatewayReset, stravaEnvForUser, stravaTokenPathFor } from "@/lib/users/secrets";
import { normalizeStravaRun, type NormalizedRun, type RawStravaActivity } from "./normalize";
import type { CardioSummary } from "@/lib/training/types";

const TOKEN_URL = "https://www.strava.com/oauth/token";
const API_URL = "https://www.strava.com/api/v3";
const DETAIL_CAP = 40;
/** Covers the 12-month distance chart, including the first day of the oldest month. */
const ACTIVITY_LOOKBACK_SECONDS = 400 * 24 * 60 * 60;
const ACTIVITY_PAGES = 6;
const EFFORT_LOOKBACK_DAYS = 180;
const DETAIL_CONCURRENCY = 4;
const CACHE_MS = 10 * 60 * 1000;
const REFRESH_LEEWAY_SECONDS = 3600;

export class StravaApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "StravaApiError";
  }
}

export type { TokenSet };

export interface StravaEnv {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface StravaGateway {
  isConfigured(): boolean;
  getSummary(): Promise<CardioSummary>;
  clearCache(): void;
}

interface GatewayDeps {
  fetchImpl?: typeof fetch;
  tokenPath: string;
  readEnv: () => StravaEnv;
  now?: () => Date;
  cacheMs?: number;
}

function tokenError(status: number): string {
  if (status === 400 || status === 401) {
    return "Strava rejected the refresh token. Set a new STRAVA_REFRESH_TOKEN with the activity:read_all scope.";
  }
  if (status === 429) return "Strava rate limit reached. Try again in a few minutes.";
  return "Could not refresh the Strava access token.";
}

function apiError(status: number): string {
  if (status === 401) {
    return "Strava rejected the access token. Set a new STRAVA_REFRESH_TOKEN with the activity:read_all scope.";
  }
  if (status === 429) return "Strava rate limit reached. Try again in a few minutes.";
  return "Could not load runs from Strava.";
}

export { readTokenFile, writeTokenFile };

export function defaultStravaTokenPath(): string {
  return path.join(activeDataDir(), "strava-oauth.json");
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function detailIds(runs: NormalizedRun[]): number[] {
  const eligible = runs
    .filter((run) => run.sport !== "trail" && run.distanceMeters >= MIN_EFFORT_DISTANCE_METERS)
    .sort((a, b) => (a.startLocal < b.startLocal ? 1 : -1));
  const ids = new Set<number>(eligible.slice(0, DETAIL_CAP).map((run) => run.id));
  for (const run of eligible) {
    if (isTimeTrialDistance(run.distanceMeters)) ids.add(run.id);
  }
  return [...ids];
}

export function createStravaGateway(deps: GatewayDeps): StravaGateway {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());
  const cacheMs = deps.cacheMs ?? CACHE_MS;
  let memory: TokenSet | null = null;
  let refreshing: Promise<TokenSet> | null = null;
  let cache: { at: number; summary: CardioSummary } | null = null;
  let summaryInflight: Promise<CardioSummary> | null = null;

  async function postToken(refreshToken: string, env: StravaEnv): Promise<TokenSet> {
    const response = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.clientId,
        client_secret: env.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
      cache: "no-store",
    });
    if (!response.ok) {
      await response.text().catch(() => "");
      throw new StravaApiError(response.status, tokenError(response.status));
    }
    const json = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
      expires_in?: number;
    };
    if (!json.access_token) {
      throw new StravaApiError(502, "Could not refresh the Strava access token.");
    }
    const nowSec = Math.floor(now().getTime() / 1000);
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token || refreshToken,
      expiresAt: json.expires_at ?? nowSec + (json.expires_in ?? 3600),
    };
  }

  function stamp(tokens: TokenSet, env: StravaEnv): TokenSet {
    return { ...tokens, envRefreshToken: env.refreshToken };
  }

  function persist(tokens: TokenSet) {
    memory = tokens;
    try {
      writeTokenFile(deps.tokenPath, tokens);
    } catch {
      console.error("[strava] could not persist the rotated refresh token");
    }
  }

  function discardTokens() {
    memory = null;
    cache = null;
    try {
      fs.unlinkSync(deps.tokenPath);
    } catch {
      // The file may already be missing. The next refresh uses the env token.
    }
  }

  /** Stored tokens are only reusable when they were minted from the current env token. */
  function usableStored(env: StravaEnv): TokenSet | null {
    const stored = readTokenFile(deps.tokenPath);
    if (!stored) return null;
    if (stored.envRefreshToken == null) return stored;
    if (stored.envRefreshToken !== env.refreshToken) return null;
    return stored;
  }

  async function refresh(): Promise<TokenSet> {
    const env = deps.readEnv();
    const stored = usableStored(env);
    const primary = stored?.refreshToken || env.refreshToken;
    try {
      const tokens = stamp(await postToken(primary, env), env);
      persist(tokens);
      return tokens;
    } catch (err) {
      if (stored && stored.refreshToken !== env.refreshToken && env.refreshToken) {
        const tokens = stamp(await postToken(env.refreshToken, env), env);
        persist(tokens);
        return tokens;
      }
      throw err;
    }
  }

  async function accessToken(): Promise<string> {
    const env = deps.readEnv();
    const nowSec = Math.floor(now().getTime() / 1000);
    if (
      memory &&
      memory.envRefreshToken === env.refreshToken &&
      memory.expiresAt - nowSec > REFRESH_LEEWAY_SECONDS
    ) {
      return memory.accessToken;
    }
    if (!refreshing) {
      refreshing = refresh().finally(() => {
        refreshing = null;
      });
    }
    return (await refreshing).accessToken;
  }

  async function getJson<T>(token: string, url: string): Promise<T> {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      await response.text().catch(() => "");
      throw new StravaApiError(response.status, apiError(response.status));
    }
    return (await response.json()) as T;
  }

  async function listActivities(token: string, after: number): Promise<RawStravaActivity[]> {
    const all: RawStravaActivity[] = [];
    for (let page = 1; page <= ACTIVITY_PAGES; page++) {
      const batch = await getJson<RawStravaActivity[]>(
        token,
        `${API_URL}/athlete/activities?after=${after}&page=${page}&per_page=200`,
      );
      if (!Array.isArray(batch) || batch.length === 0) break;
      all.push(...batch);
      if (batch.length < 200) break;
    }
    return all;
  }

  async function loadSummary(token: string): Promise<CardioSummary> {
    const current = now();
    const after = Math.floor(current.getTime() / 1000) - ACTIVITY_LOOKBACK_SECONDS;
    const listed = await listActivities(token, after);
    const summaries = listed
      .map((activity) => normalizeStravaRun(activity))
      .filter((run): run is NormalizedRun => run != null);
    const effortStart = addDays(londonToday(current), -EFFORT_LOOKBACK_DAYS);
    const ids = detailIds(summaries.filter((run) => run.date >= effortStart));
    const details = await mapPool(ids, DETAIL_CONCURRENCY, async (id) => {
      try {
        return await getJson<RawStravaActivity>(token, `${API_URL}/activities/${id}`);
      } catch (err) {
        if (err instanceof StravaApiError && (err.status === 401 || err.status === 429)) throw err;
        return null;
      }
    });
    const byId = new Map<number, RawStravaActivity>();
    for (const detail of details) {
      if (detail?.id != null) byId.set(detail.id, detail);
    }
    const runs = listed
      .map((activity) => normalizeStravaRun((activity.id != null && byId.get(activity.id)) || activity))
      .filter((run): run is NormalizedRun => run != null);
    const summary = summarizeCardio(runs, current);
    cache = { at: current.getTime(), summary };
    return summary;
  }

  async function compute(): Promise<CardioSummary> {
    try {
      return await loadSummary(await accessToken());
    } catch (err) {
      if (!(err instanceof StravaApiError) || err.status !== 401) throw err;
    }
    // The stored access token was rejected. Drop it and try the env refresh token once.
    discardTokens();
    const tokens = await refresh();
    return loadSummary(tokens.accessToken);
  }

  return {
    isConfigured() {
      const env = deps.readEnv();
      if (env.clientId && env.clientSecret && env.refreshToken) return true;
      if (!env.clientId || !env.clientSecret) return false;
      return Boolean(readTokenFile(deps.tokenPath)?.refreshToken);
    },
    clearCache() {
      cache = null;
      memory = null;
      summaryInflight = null;
    },
    async getSummary() {
      const current = now().getTime();
      if (cache && current - cache.at < cacheMs) return cache.summary;
      if (!summaryInflight) {
        summaryInflight = compute().finally(() => {
          summaryInflight = null;
        });
      }
      return summaryInflight;
    },
  };
}

const gateways = new Map<string, StravaGateway>();

function gatewayFor(userId: string | null): StravaGateway {
  const key = userId ?? "__legacy__";
  const existing = gateways.get(key);
  if (existing) return existing;
  const created = createStravaGateway({
    tokenPath: userId ? stravaTokenPathFor(userId) : defaultStravaTokenPath(),
    readEnv: () => stravaEnvForUser(userId),
  });
  gateways.set(key, created);
  return created;
}

function currentGateway(): StravaGateway {
  return gatewayFor(currentScope()?.userId ?? null);
}

export function dropStravaGateway(userId: string): void {
  gateways.delete(userId);
}

registerStravaGatewayReset(dropStravaGateway);

export const stravaGateway: StravaGateway = {
  isConfigured() {
    return currentGateway().isConfigured();
  },
  clearCache() {
    currentGateway().clearCache();
  },
  getSummary() {
    return currentGateway().getSummary();
  },
};
