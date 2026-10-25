import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { normalizeEmail, userIdFromEmail } from "@/lib/users/identity";
import { dataRoot as envDataRoot, STRAVA_TOKEN_FILE } from "@/lib/users/paths";

const USER_DATA_TABLES = [
  "accounts",
  "snapshots",
  "account_valuations",
  "goals",
  "subscriptions",
  "transactions",
  "transaction_category_rules",
  "video_diaries",
  "diary_crypto",
  "notable_events",
  "physical_assets",
  "files",
  "user_settings",
  "career_plans",
  "life_metric_readings",
  "fx_rates",
  "hevy_sync_logs",
];

export type MigrationStatus =
  | "moved"
  | "already-complete"
  | "nothing-to-move"
  | "skipped-no-owner"
  | "conflict";

export type MigrationResult = {
  status: MigrationStatus;
  backupDir?: string;
  ownerUserId?: string;
  detail?: string;
};

type ArtifactName = "db" | "wal" | "shm" | "files" | "profile" | "strava";

type Artifacts = Record<ArtifactName, string>;

function exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function legacyArtifacts(dataRoot: string, legacyDb: string): Artifacts {
  const besideDb = path.join(path.dirname(legacyDb), STRAVA_TOKEN_FILE);
  const inRoot = path.join(dataRoot, STRAVA_TOKEN_FILE);
  return {
    db: legacyDb,
    wal: `${legacyDb}-wal`,
    shm: `${legacyDb}-shm`,
    files: path.join(dataRoot, "files"),
    profile: path.join(dataRoot, "profile"),
    strava: exists(inRoot) ? inRoot : besideDb,
  };
}

function destArtifacts(ownerDir: string): Artifacts {
  const db = path.join(ownerDir, "nwtracker.db");
  return {
    db,
    wal: `${db}-wal`,
    shm: `${db}-shm`,
    files: path.join(ownerDir, "files"),
    profile: path.join(ownerDir, "profile"),
    strava: path.join(ownerDir, STRAVA_TOKEN_FILE),
  };
}

function userDataRows(dbPath: string): number {
  if (!exists(dbPath)) return 0;
  let sqlite: Database.Database | null = null;
  try {
    sqlite = new Database(dbPath, { readonly: true, fileMustExist: true });
    let total = 0;
    for (const table of USER_DATA_TABLES) {
      const found = sqlite
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(table);
      if (!found) continue;
      const row = sqlite.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number };
      total += row.n;
    }
    return total;
  } catch {
    return Number.POSITIVE_INFINITY;
  } finally {
    sqlite?.close();
  }
}

function copyArtifact(from: string, to: string): void {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.cpSync(from, to, { recursive: true });
    return;
  }
  fs.copyFileSync(from, to);
}

function moveArtifact(from: string, to: string): void {
  if (path.resolve(from) === path.resolve(to)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    fs.renameSync(from, to);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EXDEV") throw err;
    copyArtifact(from, to);
    fs.rmSync(from, { recursive: true, force: true });
  }
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function writeMarker(dataRoot: string, ownerUserId: string, at: Date): void {
  const marker = migrationMarkerPathFor(dataRoot);
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(
    marker,
    JSON.stringify({ version: 1, ownerUserId, migratedAt: at.toISOString() }, null, 2),
    { mode: 0o600 }
  );
}

function migrationMarkerPathFor(root: string): string {
  return path.join(root, "users", ".migration-complete");
}

/**
 * Move the single-user data directory into the owner's user folder.
 * Copies a backup first. A second call is a no-op once the marker exists.
 * Builtin-only databases created by an early sign-in are replaced by the
 * legacy file. Two databases that both contain user rows are left untouched.
 */
export function migrateLegacyData(options: {
  dataRoot: string;
  legacyDbPath: string;
  ownerEmail: string | null;
  now?: Date;
}): MigrationResult {
  const root = path.resolve(options.dataRoot);
  const legacyDb = path.resolve(options.legacyDbPath);
  const now = options.now ?? new Date();
  const marker = migrationMarkerPathFor(root);

  if (exists(marker)) return { status: "already-complete" };
  const ownerEmail = normalizeEmail(options.ownerEmail);
  if (!ownerEmail) return { status: "skipped-no-owner" };

  const ownerUserId = userIdFromEmail(ownerEmail);
  const owner = userDirFor(root, ownerUserId);
  const source = legacyArtifacts(root, legacyDb);
  const dest = destArtifacts(owner);
  const present = (Object.keys(source) as ArtifactName[]).filter((name) => exists(source[name]));

  if (present.length === 0) {
    writeMarker(root, ownerUserId, now);
    return { status: "nothing-to-move", ownerUserId };
  }

  const sourceRows = exists(source.db) ? userDataRows(source.db) : 0;
  const destRows = exists(dest.db) ? userDataRows(dest.db) : 0;
  const replaceEmptyShell = exists(dest.db) && destRows === 0 && exists(source.db);

  for (const name of present) {
    if (name === "wal" || name === "shm") continue;
    if (!exists(dest[name])) continue;
    if (name === "db" && replaceEmptyShell) continue;
    return {
      status: "conflict",
      ownerUserId,
      detail: `Both the legacy store and the owner folder already have ${name}. Nothing was moved.`,
    };
  }

  const backupDir = path.join(root, "backups", stamp(now));
  fs.mkdirSync(backupDir, { recursive: true });
  for (const name of present) {
    const backupName = name === "db" ? "nwtracker.db" : name === "wal" ? "nwtracker.db-wal" : name === "shm" ? "nwtracker.db-shm" : name === "strava" ? STRAVA_TOKEN_FILE : name;
    copyArtifact(source[name], path.join(backupDir, backupName));
  }
  if (replaceEmptyShell) {
    copyArtifact(dest.db, path.join(backupDir, "empty-owner-nwtracker.db"));
    fs.rmSync(dest.db, { force: true });
    fs.rmSync(dest.wal, { force: true });
    fs.rmSync(dest.shm, { force: true });
  }

  fs.mkdirSync(owner, { recursive: true });
  for (const name of present) {
    if ((name === "wal" || name === "shm") && !exists(source.db) && !exists(source[name])) continue;
    moveArtifact(source[name], dest[name]);
  }

  const emailPath = path.join(owner, "email");
  if (!exists(emailPath)) {
    fs.writeFileSync(emailPath, `${ownerEmail}\n`, { mode: 0o600 });
  }
  writeMarker(root, ownerUserId, now);
  return {
    status: "moved",
    backupDir,
    ownerUserId,
    detail: sourceRows > 0 ? undefined : "Moved the legacy files. The database had no user rows.",
  };
}

function userDirFor(root: string, userId: string): string {
  return path.join(root, "users", userId);
}

export function listUserDbPaths(root = envDataRoot()): string[] {
  const users = path.join(path.resolve(root), "users");
  if (!exists(users)) return [];
  const paths: string[] = [];
  for (const entry of fs.readdirSync(users)) {
    if (!/^[0-9a-f]{64}$/.test(entry)) continue;
    const dbPath = path.join(users, entry, "nwtracker.db");
    if (exists(dbPath)) paths.push(dbPath);
  }
  return paths;
}
