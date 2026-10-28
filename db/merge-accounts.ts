/**
 * One-off merge for the owner database only.
 *
 *   npx tsx db/merge-accounts.ts --dry-run
 *
 * Defaults move "Chase Bank Account" into "Chase UK". Prints the plan and
 * writes nothing when --dry-run is set. Refuses any database that is not
 * DATA_DIR/users/<owner-id>/nwtracker.db.
 */
import path from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import type { DB } from "./client";
import { mergeAccounts, type MergeReport } from "@/lib/services/account-merge";
import { resolveOwnerDatabaseFile } from "@/lib/users/owner-db";

const DEFAULT_SOURCE = "Chase Bank Account";
const DEFAULT_TARGET = "Chase UK";

export function parseMergeArgs(argv: string[]): {
  dryRun: boolean;
  sourceName: string;
  targetName: string;
} {
  let dryRun = false;
  let sourceName = DEFAULT_SOURCE;
  let targetName = DEFAULT_TARGET;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--source") {
      sourceName = requiredValue(argv, ++i, "--source");
      continue;
    }
    if (arg === "--target") {
      targetName = requiredValue(argv, ++i, "--target");
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      throw new Error(
        "Usage: npx tsx db/merge-accounts.ts [--dry-run] [--source name] [--target name]"
      );
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { dryRun, sourceName, targetName };
}

function requiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} needs a value`);
  return value;
}

export function printMergeReport(dbPath: string, report: MergeReport): void {
  console.log(`Owner database: ${dbPath}`);
  console.log(report.dryRun ? "Dry run: no changes written." : "Merge applied.");
  if (report.source) console.log(`Source: ${report.source.name} (${report.source.id})`);
  if (report.target) console.log(`Target: ${report.target.name} (${report.target.id})`);
  console.log(`Balances moved: ${report.valuationsMoved}`);
  console.log(`Balances deduped: ${report.valuationsDeduped}`);
  console.log(`Carried-forward balances replaced with imported values: ${report.carriedForwardReplaced}`);
  console.log(`Transactions moved: ${report.transactionsMoved}`);
  console.log(`Duplicate transactions dropped: ${report.transactionsDeduped}`);
  console.log(`Goals relinked: ${report.goalsRelinked}`);
  console.log(`Snapshots recomputed: ${report.snapshotsRecomputed}`);
  console.log(report.sourceDeleted ? "Source account deleted." : "Source account kept.");
  for (const line of report.lines) console.log(`  ${line}`);
  if (report.reason) console.log(report.reason);
}

function main(): void {
  let args;
  try {
    args = parseMergeArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  let dbPath: string;
  try {
    dbPath = resolveOwnerDatabaseFile();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const sqlite = new Database(dbPath, {
    readonly: args.dryRun,
    fileMustExist: true,
  });
  sqlite.pragma("foreign_keys = ON");
  const database = drizzle(sqlite, { schema }) as DB;

  try {
    const report = mergeAccounts(
      { sourceName: args.sourceName, targetName: args.targetName, dryRun: args.dryRun },
      database
    );
    printMergeReport(dbPath, report);
    if (report.status === "refused") process.exit(1);
  } finally {
    sqlite.close();
  }
}

const entry = process.argv[1] ?? "";
if (!process.env.VITEST && (path.basename(entry) === "merge-accounts.ts" || entry.endsWith(`${path.sep}merge-accounts.ts`))) {
  main();
}
