/**
 * Applies migrations to the legacy database, moves that data into the owner's
 * folder once, then migrates every per-user database.
 *
 * Safe to re-run. Usage: npx tsx db/migrate.ts
 */
import fs from "fs";
import { closeAllDatabases, openDatabase } from "./client";
import { ownerEmail } from "@/lib/users/identity";
import { migrateLegacyData, listUserDbPaths } from "@/lib/users/migrate";
import { dataRoot, legacyDbPath, migrationMarkerPath } from "@/lib/users/paths";

const root = dataRoot();
const legacy = legacyDbPath();
const marker = migrationMarkerPath();

if (!fs.existsSync(marker)) {
  const owner = ownerEmail();
  if (fs.existsSync(legacy) || owner) {
    openDatabase(legacy, { logSeed: true });
    closeAllDatabases();
  }

  const result = migrateLegacyData({
    dataRoot: root,
    legacyDbPath: legacy,
    ownerEmail: owner,
  });
  console.log(`✓ User data migration: ${result.status}`);
  if (result.backupDir) console.log(`  backup: ${result.backupDir}`);
  if (result.detail) console.log(`  ${result.detail}`);
  if (result.status === "conflict") {
    console.error("Refusing to start with two copies of user data. Nothing was overwritten.");
    process.exit(1);
  }
}

for (const dbPath of listUserDbPaths(root)) {
  openDatabase(dbPath, { logSeed: true });
  closeAllDatabases();
}

console.log("✓ Migrations applied");
console.log("✓ Seed complete");
