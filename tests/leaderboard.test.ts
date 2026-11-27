import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  leaderboardValidationError,
  parseLeaderboardTimeMs,
  sanitizeLeaderboardName,
  sortLeaderboardEntries,
} from "@/lib/leaderboard/contract";
import {
  allowLeaderboardPost,
  clientIpFromHeaders,
  resetLeaderboardRateLimit,
} from "@/lib/leaderboard/rate-limit";
import {
  leaderboardFile,
  readLeaderboard,
  submitLeaderboardScore,
} from "@/lib/leaderboard/store";
import { GET, OPTIONS, POST } from "@/app/api/public/leaderboard/[game]/route";

let tmp = "";
const previousDataDir = process.env.DATA_DIR;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nw-leaderboard-"));
  process.env.DATA_DIR = tmp;
  resetLeaderboardRateLimit();
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  resetLeaderboardRateLimit();
});

function post(game: string, body: unknown, ip = "203.0.113.8") {
  return POST(
    new NextRequest(`http://localhost/api/public/leaderboard/${game}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "fly-client-ip": ip,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ game }) }
  );
}

describe("leaderboard validation", () => {
  it("trims the name and strips control characters and angle brackets", () => {
    expect(sanitizeLeaderboardName("  Eu\nan<script>  ")).toBe("Euanscript");
    expect(sanitizeLeaderboardName("   ")).toBeNull();
    expect(sanitizeLeaderboardName("a".repeat(21))).toBeNull();
    expect(sanitizeLeaderboardName(12)).toBeNull();
  });

  it("accepts only integer times inside the quiz window", () => {
    expect(parseLeaderboardTimeMs(5000)).toBe(5000);
    expect(parseLeaderboardTimeMs(7_200_000)).toBe(7_200_000);
    expect(parseLeaderboardTimeMs(4999)).toBeNull();
    expect(parseLeaderboardTimeMs(7_200_001)).toBeNull();
    expect(parseLeaderboardTimeMs(12_000.5)).toBeNull();
    expect(parseLeaderboardTimeMs("123456")).toBeNull();
    expect(leaderboardValidationError({ name: "Euan", timeMs: 123456 })).toBeNull();
  });
});

describe("leaderboard store", () => {
  it("ranks fastest first, breaks ties by earlier timestamp, and returns the top 20", () => {
    submitLeaderboardScore("legislation", "Later", 10000, "2026-11-16T16:00:02.000Z");
    const second = submitLeaderboardScore("legislation", "Euan", 10000, "2026-11-16T16:00:01.000Z");
    expect(second.rank).toBe(1);
    expect(second.entries.map((entry) => entry.name)).toEqual(["Euan", "Later"]);

    for (let index = 0; index < 25; index += 1) {
      submitLeaderboardScore("legislation", `P${index}`, 20000 + index, `2026-11-16T17:00:${String(index).padStart(2, "0")}.000Z`);
    }
    const listed = readLeaderboard("legislation");
    expect(listed[0]).toMatchObject({ name: "Euan", timeMs: 10000, at: "2026-11-16T16:00:01.000Z" });
    const view = submitLeaderboardScore("legislation", "Slow", 90_000, "2026-11-16T18:00:00.000Z");
    expect(view.entries).toHaveLength(20);
    expect(view.entries[0].name).toBe("Euan");
    expect(view.rank).toBe(listed.length + 1);
  });

  it("keeps only the best 500 scores and writes the file beside the volume root", () => {
    for (let index = 0; index < 500; index += 1) {
      submitLeaderboardScore("elements", `N${index}`, 10_000 + index, `2026-11-16T16:00:${String(index).padStart(2, "0")}.000Z`.replace(
        /T16:00:\d\d/,
        `T16:${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}`
      ));
    }
    const slow = submitLeaderboardScore("elements", "Too slow", 9_000_000 > 7_200_000 ? 80_000 : 80_000, "2026-11-16T20:00:00.000Z");
    expect(slow.rank).toBe(501);
    expect(readLeaderboard("elements")).toHaveLength(500);
    expect(readLeaderboard("elements").some((entry) => entry.name === "Too slow")).toBe(false);

    const fast = submitLeaderboardScore("elements", "Fast", 6000, "2026-11-16T20:01:00.000Z");
    expect(fast.rank).toBe(1);
    expect(readLeaderboard("elements")).toHaveLength(500);
    expect(readLeaderboard("elements")[0].name).toBe("Fast");

    const file = leaderboardFile("elements");
    expect(file).toBe(path.join(tmp, "leaderboard", "elements.json"));
    expect(file.includes(`${path.sep}users${path.sep}`)).toBe(false);
    expect(fs.readdirSync(path.join(tmp, "leaderboard")).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });
});

describe("leaderboard HTTP contract", () => {
  it("answers the preflight and rejects unknown games", async () => {
    const preflight = OPTIONS();
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
    expect(preflight.headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
    expect(preflight.headers.get("access-control-allow-headers")).toBe("Content-Type");

    const missing = await GET(
      new NextRequest("http://localhost/api/public/leaderboard/chess"),
      { params: Promise.resolve({ game: "chess" }) }
    );
    expect(missing.status).toBe(404);
    expect(missing.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("returns the posted score shape and prefers Fly-Client-IP for the rate limit", async () => {
    const created = await post("legislation", { name: "  Euan<>  ", timeMs: 123456 });
    expect(created.status).toBe(201);
    expect(created.headers.get("access-control-allow-origin")).toBe("*");
    const body = await created.json();
    expect(body).toEqual({
      ok: true,
      rank: 1,
      entries: [{ name: "Euan", timeMs: 123456, at: body.entries[0].at }],
    });
    expect(body.entries[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const listed = await GET(
      new NextRequest("http://localhost/api/public/leaderboard/legislation"),
      { params: Promise.resolve({ game: "legislation" }) }
    );
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({ game: "legislation", entries: body.entries });

    const bad = await post("legislation", { name: "", timeMs: 100 });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "Name must be 1–20 characters" });

    const headers = new Headers({
      "fly-client-ip": "198.51.100.10",
      "x-forwarded-for": "203.0.113.9, 10.0.0.1",
    });
    expect(clientIpFromHeaders(headers)).toBe("198.51.100.10");
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe(
      "203.0.113.9"
    );

    resetLeaderboardRateLimit();
    for (let index = 0; index < 10; index += 1) {
      expect(allowLeaderboardPost("198.51.100.10", 1_000 + index)).toBe(true);
    }
    expect(allowLeaderboardPost("198.51.100.10", 1_010)).toBe(false);
    expect(allowLeaderboardPost("198.51.100.10", 61_010)).toBe(true);

    const limited = await post("elements", { name: "Euan", timeMs: 8000 }, "198.51.100.77");
    expect(limited.status).toBe(201);
    for (let index = 0; index < 9; index += 1) {
      expect((await post("elements", { name: "Euan", timeMs: 8000 + index }, "198.51.100.77")).status).toBe(
        201
      );
    }
    const blocked = await post("elements", { name: "Euan", timeMs: 9000 }, "198.51.100.77");
    expect(blocked.status).toBe(429);
    expect(sortLeaderboardEntries([{ name: "b", timeMs: 2, at: "a" }, { name: "a", timeMs: 1, at: "b" }])[0].name).toBe(
      "a"
    );
  });
});
