import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeAllDatabases, db } from "@/db/client";
import { goals, transactionCategoryRules } from "@/db/schema";
import { createAccount, listAccounts } from "@/lib/services/accounts";
import { createGoal, listGoals } from "@/lib/services/goals";
import { getFile, saveFile } from "@/lib/services/files";
import { readAvatar, saveAvatar } from "@/lib/services/profile";
import { createCategoryRule } from "@/lib/services/transactions";
import { defaultStravaTokenPath, stravaGateway } from "@/lib/strava/client";
import { canonicalDiaryKey } from "@/lib/r2-keys";
import { runAsUser } from "@/lib/users/context";
import { userIdFromEmail } from "@/lib/users/identity";
import {
  hevyApiKeyForScope,
  hevySyncTargets,
  saveHevyApiKey,
  saveStravaRefreshToken,
  stravaEnvForUser,
} from "@/lib/users/secrets";
import { requireUser } from "@/lib/users/context";

const OWNER = "owner@example.com";
const DAD = "dad@example.com";

let tmp = "";
const previous = {
  DATA_DIR: process.env.DATA_DIR,
  DB_PATH: process.env.DB_PATH,
  ALLOWED_EMAIL: process.env.ALLOWED_EMAIL,
  ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
  HEVY_API_KEY: process.env.HEVY_API_KEY,
  STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET: process.env.STRAVA_CLIENT_SECRET,
  STRAVA_REFRESH_TOKEN: process.env.STRAVA_REFRESH_TOKEN,
};

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nw-users-"));
  process.env.DATA_DIR = tmp;
  process.env.DB_PATH = path.join(tmp, "nwtracker.db");
  delete process.env.ALLOWED_EMAIL;
  process.env.ALLOWED_EMAILS = `${OWNER},${DAD}`;
  delete process.env.HEVY_API_KEY;
  process.env.STRAVA_CLIENT_ID = "client";
  process.env.STRAVA_CLIENT_SECRET = "secret";
  delete process.env.STRAVA_REFRESH_TOKEN;
});

afterEach(() => {
  closeAllDatabases();
  fs.rmSync(tmp, { recursive: true, force: true });
  restore("DATA_DIR", previous.DATA_DIR);
  restore("DB_PATH", previous.DB_PATH);
  restore("ALLOWED_EMAIL", previous.ALLOWED_EMAIL);
  restore("ALLOWED_EMAILS", previous.ALLOWED_EMAILS);
  restore("HEVY_API_KEY", previous.HEVY_API_KEY);
  restore("STRAVA_CLIENT_ID", previous.STRAVA_CLIENT_ID);
  restore("STRAVA_CLIENT_SECRET", previous.STRAVA_CLIENT_SECRET);
  restore("STRAVA_REFRESH_TOKEN", previous.STRAVA_REFRESH_TOKEN);
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("per-user data isolation", () => {
  it("keeps accounts, goals, rules, files, and avatars in separate stores", () => {
    const account = runAsUser(OWNER, () =>
      createAccount({ name: "Owner wallet", type: "ASSET", category: "CASH" })
    );
    runAsUser(OWNER, () =>
      createGoal({
        name: "House",
        targetValue: 1000,
        targetDate: "2030-01-01",
        metricType: "NET_WORTH",
      })
    );
    runAsUser(OWNER, () =>
      createCategoryRule({ pattern: "tesco", matchType: "contains", category: "Groceries" })
    );
    const file = runAsUser(OWNER, () =>
      saveFile({
        displayName: "note.txt",
        mimeType: "text/plain",
        data: Buffer.from("owner-only"),
        linkedToType: "ACCOUNT",
        linkedToId: account.id,
      })
    );
    runAsUser(OWNER, () => saveAvatar(Buffer.from("owner-face"), "image/png"));

    expect(runAsUser(DAD, () => listAccounts(true))).toEqual([]);
    expect(runAsUser(DAD, () => listGoals())).toEqual([]);
    expect(runAsUser(DAD, () => db.select().from(goals).all())).toEqual([]);
    expect(runAsUser(DAD, () => db.select().from(transactionCategoryRules).all())).toEqual([]);
    expect(runAsUser(DAD, () => getFile(file.id))).toBeNull();
    expect(runAsUser(DAD, () => readAvatar())).toBeNull();

    expect(runAsUser(OWNER, () => listAccounts(true).map((row) => row.name))).toEqual([
      "Owner wallet",
    ]);
    expect(runAsUser(DAD, () => createAccount({ name: "Dad wallet", type: "ASSET", category: "CASH" })).name).toBe(
      "Dad wallet"
    );
    expect(runAsUser(OWNER, () => listAccounts(true).map((row) => row.name))).toEqual([
      "Owner wallet",
    ]);

    const ownerDir = path.join(tmp, "users", userIdFromEmail(OWNER));
    const dadDir = path.join(tmp, "users", userIdFromEmail(DAD));
    expect(fs.readFileSync(path.join(ownerDir, file.storagePath), "utf8")).toBe("owner-only");
    expect(fs.existsSync(path.join(dadDir, file.storagePath))).toBe(false);
    expect(fs.readFileSync(path.join(ownerDir, "profile", "avatar"), "utf8")).toBe("owner-face");
    expect(fs.existsSync(path.join(dadDir, "profile", "avatar"))).toBe(false);
    expect(fs.existsSync(path.join(ownerDir, "nwtracker.db"))).toBe(true);
    expect(fs.existsSync(path.join(dadDir, "nwtracker.db"))).toBe(true);

    expect(() =>
      runAsUser(OWNER, () =>
        saveFile({
          displayName: "../../outside.txt",
          mimeType: "text/plain",
          data: Buffer.from("nope"),
          linkedToType: "GOAL",
          linkedToId: randomUUID(),
        })
      )
    ).toThrow(/Invalid storage path/);
    expect(fs.existsSync(path.join(tmp, "outside.txt"))).toBe(false);
  });

  it("keeps Strava and Hevy tokens on the signed-in user", () => {
    process.env.STRAVA_REFRESH_TOKEN = "owner-env-token";
    process.env.HEVY_API_KEY = "owner-env-key";
    const ownerId = userIdFromEmail(OWNER);
    const dadId = userIdFromEmail(DAD);

    expect(stravaEnvForUser(ownerId).refreshToken).toBe("owner-env-token");
    expect(stravaEnvForUser(dadId).refreshToken).toBe("");
    expect(runAsUser(OWNER, () => defaultStravaTokenPath())).toBe(
      path.join(tmp, "users", ownerId, "strava-oauth.json")
    );
    expect(runAsUser(DAD, () => defaultStravaTokenPath())).toBe(
      path.join(tmp, "users", dadId, "strava-oauth.json")
    );

    expect(runAsUser(OWNER, () => hevyApiKeyForScope(requireUser()))).toBe("owner-env-key");
    expect(() => runAsUser(DAD, () => hevyApiKeyForScope(requireUser()))).toThrow(/HEVY_API_KEY/);

    runAsUser(DAD, () => saveHevyApiKey("dad-key"));
    expect(runAsUser(DAD, () => hevyApiKeyForScope(requireUser()))).toBe("dad-key");
    expect(runAsUser(OWNER, () => hevyApiKeyForScope(requireUser()))).toBe("owner-env-key");
    expect(hevySyncTargets().sort()).toEqual([DAD, OWNER].sort());

    runAsUser(DAD, () => {
      saveStravaRefreshToken("dad-refresh");
      expect(stravaGateway.isConfigured()).toBe(true);
    });
    expect(runAsUser(OWNER, () => stravaGateway.isConfigured())).toBe(true);
    delete process.env.STRAVA_REFRESH_TOKEN;
    expect(runAsUser(OWNER, () => stravaGateway.isConfigured())).toBe(false);
    expect(runAsUser(DAD, () => stravaGateway.isConfigured())).toBe(true);
  });

  it("rejects another user's diary object key and keeps legacy keys for the owner", () => {
    const diaryId = randomUUID();
    const legacy = `diaries/${diaryId}/video.enc`;
    const ownerId = userIdFromEmail(OWNER);
    const dadId = userIdFromEmail(DAD);
    expect(canonicalDiaryKey(legacy, dadId, "write", ownerId)).toBe(
      `users/${dadId}/diaries/${diaryId}/video.enc`
    );
    expect(canonicalDiaryKey(legacy, ownerId, "read", ownerId)).toBe(legacy);
    expect(() => canonicalDiaryKey(legacy, dadId, "read", ownerId)).toThrow(/Invalid object key/);
    expect(() =>
      canonicalDiaryKey(`users/${ownerId}/diaries/${diaryId}/thumb.enc`, dadId, "read", ownerId)
    ).toThrow(/Invalid object key/);
  });
});
