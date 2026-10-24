import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createStravaGateway,
  readTokenFile,
  writeTokenFile,
  type StravaEnv,
  type TokenSet,
} from "@/lib/strava/client";

const ENV: StravaEnv = {
  clientId: "client",
  clientSecret: "secret",
  refreshToken: "env-refresh",
};

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "strava-"));
}

describe("token file", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
  });

  it("round-trips the latest refresh token and keeps the file private", () => {
    const dir = tempDir();
    dirs.push(dir);
    const file = path.join(dir, "strava-oauth.json");
    const tokens: TokenSet = {
      accessToken: "access",
      refreshToken: "rotated",
      expiresAt: 1_800_000_000,
    };
    writeTokenFile(file, tokens);
    expect(readTokenFile(file)).toEqual(tokens);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(readTokenFile(path.join(dir, "missing.json"))).toBeNull();
  });
});

describe("createStravaGateway", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
  });

  it("does not call Strava when credentials are missing", async () => {
    let calls = 0;
    const gateway = createStravaGateway({
      tokenPath: path.join(tempDir(), "missing.json"),
      readEnv: () => ({ clientId: "id", clientSecret: "", refreshToken: "refresh" }),
      fetchImpl: async () => {
        calls += 1;
        throw new Error("should not fetch");
      },
    });
    expect(gateway.isConfigured()).toBe(false);
    expect(calls).toBe(0);
  });

  it("refreshes with the stored token, persists the rotation, and summarises runs", async () => {
    const dir = tempDir();
    dirs.push(dir);
    const file = path.join(dir, "strava-oauth.json");
    writeTokenFile(file, { accessToken: "stale", refreshToken: "stored-refresh", expiresAt: 0 });

    const calls: { url: string; body: string; auth: string }[] = [];
    const now = new Date("2026-10-24T12:00:00Z");
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const auth = new Headers(init?.headers).get("authorization") ?? "";
      const body = typeof init?.body === "string" ? init.body : "";
      calls.push({ url, body, auth });
      if (url.endsWith("/oauth/token")) {
        const refresh = new URLSearchParams(body).get("refresh_token");
        if (refresh === "stored-refresh") {
          return Response.json({
            access_token: "access-1",
            refresh_token: "rotated-refresh",
            expires_at: Math.floor(now.getTime() / 1000) + 20_000,
          });
        }
        return new Response("no", { status: 400 });
      }
      if (url.includes("/athlete/activities")) {
        return Response.json([
          {
            id: 42,
            name: "Park 5k",
            sport_type: "Run",
            start_date_local: "2026-10-22T07:30:00",
            distance: 5000,
            moving_time: 1500,
          },
          {
            id: 7,
            name: "Commute",
            sport_type: "Ride",
            start_date_local: "2026-10-22T08:30:00",
            distance: 12000,
            moving_time: 2400,
          },
        ]);
      }
      if (url.endsWith("/activities/42")) {
        return Response.json({
          id: 42,
          name: "Park 5k",
          sport_type: "Run",
          start_date_local: "2026-10-22T07:30:00",
          distance: 5000,
          moving_time: 1500,
          best_efforts: [{ name: "5k", distance: 5000, elapsed_time: 1488 }],
        });
      }
      return new Response("missing", { status: 404 });
    };

    const gateway = createStravaGateway({
      tokenPath: file,
      readEnv: () => ENV,
      fetchImpl,
      now: () => now,
    });

    const summary = await gateway.getSummary();
    expect(summary.recentRuns.map((run) => run.name)).toEqual(["Park 5k"]);
    expect(summary.bestFiveK).toMatchObject({ timeSeconds: 1488, source: "best_effort" });
    expect(readTokenFile(file)?.refreshToken).toBe("rotated-refresh");
    expect(calls[0]?.body).toContain("refresh_token=stored-refresh");
    expect(calls[0]?.body).not.toContain("env-refresh");
    expect(calls.some((call) => call.auth === "Bearer access-1")).toBe(true);

    calls.length = 0;
    await gateway.getSummary();
    expect(calls).toHaveLength(0);
  });

  it("falls back to the env refresh token when the stored token is rejected", async () => {
    const dir = tempDir();
    dirs.push(dir);
    const file = path.join(dir, "strava-oauth.json");
    writeTokenFile(file, { accessToken: "stale", refreshToken: "stored-old", expiresAt: 0 });

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/oauth/token")) {
        const refresh = new URLSearchParams(String(init?.body)).get("refresh_token");
        if (refresh === "stored-old") return new Response("invalid", { status: 401 });
        if (refresh === "env-refresh") {
          return Response.json({
            access_token: "access-2",
            refresh_token: "fresh",
            expires_at: 2_000_000_000,
          });
        }
      }
      if (url.includes("/athlete/activities")) return Response.json([]);
      return new Response("missing", { status: 404 });
    };

    const gateway = createStravaGateway({
      tokenPath: file,
      readEnv: () => ENV,
      fetchImpl,
      now: () => new Date("2026-10-24T12:00:00Z"),
    });

    const summary = await gateway.getSummary();
    expect(summary.recentRuns).toEqual([]);
    expect(summary.onTrack).toBe("off_track");
    expect(readTokenFile(file)?.refreshToken).toBe("fresh");
  });
});
