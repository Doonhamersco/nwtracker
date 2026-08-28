import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userSettings, USER_SETTINGS_ID } from "@/db/schema";
import {
  AVATAR_MAX_BYTES,
  DEFAULT_ACCENT_COLOR,
  isAvatarMimeType,
  isHexColor,
} from "@/lib/profile-theme";

export type ProfileSettings = {
  accentColor: string;
  hasAvatar: boolean;
  updatedAt: string | null;
};

function getDataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  const dbPath =
    process.env.DB_PATH ?? path.join(process.cwd(), "data", "nwtracker.db");
  return path.dirname(dbPath);
}

function avatarAbsolutePath(): string {
  return path.join(getDataDir(), "profile", "avatar");
}

function nowIso(): string {
  return new Date().toISOString();
}

function getRow() {
  const [row] = db
    .select()
    .from(userSettings)
    .where(eq(userSettings.id, USER_SETTINGS_ID))
    .all();
  return row ?? null;
}

function avatarExistsOnDisk(): boolean {
  return fs.existsSync(avatarAbsolutePath());
}

export function getSettings(): ProfileSettings {
  try {
    const row = getRow();
    if (!row) {
      return {
        accentColor: DEFAULT_ACCENT_COLOR,
        hasAvatar: false,
        updatedAt: null,
      };
    }
    return {
      accentColor: row.accentColor,
      hasAvatar: row.avatarMimeType != null && avatarExistsOnDisk(),
      updatedAt: row.updatedAt,
    };
  } catch (err) {
    console.error("[profile] getSettings", err);
    return {
      accentColor: DEFAULT_ACCENT_COLOR,
      hasAvatar: false,
      updatedAt: null,
    };
  }
}

function upsert(values: {
  accentColor?: string;
  avatarMimeType?: string | null;
}): ProfileSettings {
  const existing = getRow();
  const updatedAt = nowIso();
  const accentColor = values.accentColor ?? existing?.accentColor ?? DEFAULT_ACCENT_COLOR;
  const avatarMimeType =
    values.avatarMimeType !== undefined
      ? values.avatarMimeType
      : (existing?.avatarMimeType ?? null);

  if (!existing) {
    db.insert(userSettings)
      .values({
        id: USER_SETTINGS_ID,
        accentColor,
        avatarMimeType,
        updatedAt,
      })
      .run();
  } else {
    db.update(userSettings)
      .set({ accentColor, avatarMimeType, updatedAt })
      .where(eq(userSettings.id, USER_SETTINGS_ID))
      .run();
  }

  return getSettings();
}

export function updateAccentColor(accentColor: string): ProfileSettings {
  if (!isHexColor(accentColor)) {
    throw new Error("accentColor must be a 6-digit hex color (#rrggbb)");
  }
  return upsert({ accentColor: accentColor.toLowerCase() });
}

export function saveAvatar(data: Buffer, mimeType: string): ProfileSettings {
  if (!isAvatarMimeType(mimeType)) {
    throw new Error("Avatar must be a JPEG, PNG, or WebP image");
  }
  if (data.length > AVATAR_MAX_BYTES) {
    throw new Error("Avatar must be 2MB or smaller");
  }

  const dest = avatarAbsolutePath();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, data);

  return upsert({ avatarMimeType: mimeType });
}

export function readAvatar(): { data: Buffer; mimeType: string } | null {
  const row = getRow();
  if (!row?.avatarMimeType) return null;

  const dest = avatarAbsolutePath();
  if (!fs.existsSync(dest)) return null;

  return { data: fs.readFileSync(dest), mimeType: row.avatarMimeType };
}

export function clearAvatar(): ProfileSettings {
  const dest = avatarAbsolutePath();
  if (fs.existsSync(dest)) {
    fs.unlinkSync(dest);
  }
  return upsert({ avatarMimeType: null });
}
