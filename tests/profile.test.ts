import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetAllTables } from "./helpers/test-db";
import os from "os";
import path from "path";
import fs from "fs";
import { DEFAULT_ACCENT_COLOR, darkenHex, isHexColor, paletteFromAccent, themeStyleText } from "@/lib/profile-theme";

vi.mock("@/db/client", async () => {
  const { createTestDb } = await import("./helpers/test-db");
  const { db, sqlite } = createTestDb();
  return { db, _sqlite: sqlite };
});

const clientModule = await import("@/db/client");
const sqlite = (clientModule as unknown as { _sqlite: import("better-sqlite3").Database })._sqlite;

let tmpDir: string;

beforeEach(() => {
  resetAllTables(sqlite);
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nwtracker-profile-"));
  process.env.DATA_DIR = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
  delete process.env.DB_PATH;
});

const {
  getSettings,
  updateAccentColor,
  saveAvatar,
  readAvatar,
  clearAvatar,
} = await import("@/lib/services/profile");

describe("profile theme helpers", () => {
  it("accepts 6-digit hex colors", () => {
    expect(isHexColor("#c5a059")).toBe(true);
    expect(isHexColor("#C5A059")).toBe(true);
    expect(isHexColor("#fff")).toBe(false);
    expect(isHexColor("c5a059")).toBe(false);
  });

  it("darkens hex toward black", () => {
    expect(darkenHex("#ffffff", 0.5)).toBe("#808080");
    expect(darkenHex("#c5a059")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("keeps the original gold palette when the accent is default", () => {
    const palette = paletteFromAccent(DEFAULT_ACCENT_COLOR);
    expect(palette.accent).toBe(DEFAULT_ACCENT_COLOR);
    expect(palette.muted).toBe("#9a8d7a");
    expect(palette.border).toBe("#2a261f");
    expect(palette.bgCard).toBe("#141210");
  });

  it("tints chrome away from gold when the accent changes", () => {
    const palette = paletteFromAccent("#6b8cae");
    expect(palette.accent).toBe("#6b8cae");
    expect(palette.positive).toBe("#6b8cae");
    expect(palette.muted).not.toBe("#9a8d7a");
    expect(palette.border).not.toBe("#2a261f");
    expect(themeStyleText("#6b8cae")).toContain("--nw-accent:#6b8cae");
    expect(themeStyleText("#6b8cae")).toContain("--nw-muted:");
  });
});

describe("getSettings", () => {
  it("returns defaults when no row exists", () => {
    const settings = getSettings();
    expect(settings.accentColor).toBe(DEFAULT_ACCENT_COLOR);
    expect(settings.hasAvatar).toBe(false);
    expect(settings.updatedAt).toBeNull();
  });
});

describe("updateAccentColor", () => {
  it("persists a custom accent and survives a subsequent read", () => {
    const saved = updateAccentColor("#6b8cae");
    expect(saved.accentColor).toBe("#6b8cae");
    expect(saved.updatedAt).toBeTruthy();
    expect(getSettings().accentColor).toBe("#6b8cae");
  });

  it("normalizes hex to lowercase", () => {
    expect(updateAccentColor("#6B8CAE").accentColor).toBe("#6b8cae");
  });

  it("rejects invalid hex", () => {
    expect(() => updateAccentColor("gold")).toThrow(/hex color/);
    expect(() => updateAccentColor("#fff")).toThrow(/hex color/);
  });
});

describe("avatar", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it("saves and reads an avatar from disk", () => {
    const saved = saveAvatar(png, "image/png");
    expect(saved.hasAvatar).toBe(true);

    const avatar = readAvatar();
    expect(avatar).not.toBeNull();
    expect(avatar?.mimeType).toBe("image/png");
    expect(avatar?.data.equals(png)).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "profile", "avatar"))).toBe(true);
  });

  it("clears the avatar and reverts to the letter mark", () => {
    saveAvatar(png, "image/png");
    const cleared = clearAvatar();
    expect(cleared.hasAvatar).toBe(false);
    expect(readAvatar()).toBeNull();
    expect(fs.existsSync(path.join(tmpDir, "profile", "avatar"))).toBe(false);
  });

  it("rejects unsupported types and oversized files", () => {
    expect(() => saveAvatar(png, "image/gif")).toThrow(/JPEG, PNG, or WebP/);
    const tooBig = Buffer.alloc(2 * 1024 * 1024 + 1);
    expect(() => saveAvatar(tooBig, "image/jpeg")).toThrow(/2MB/);
  });

  it("keeps accent color when uploading an avatar", () => {
    updateAccentColor("#c47a8a");
    const saved = saveAvatar(png, "image/webp");
    expect(saved.accentColor).toBe("#c47a8a");
    expect(saved.hasAvatar).toBe(true);
  });
});
