/**
 * Applies all pending migrations and seeds builtin data.
 * Safe to re-run — inserts are skipped if name already exists.
 *
 * Usage: npx tsx db/migrate.ts
 */
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client";
import { lifeMetricDefinitions } from "./schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import path from "path";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "db", "migrations");

migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
console.log("✓ Migrations applied");

const builtins: Array<{
  name: string;
  unit: string;
  displayColor: string;
  isBuiltin: boolean;
  isHevyMetric: boolean;
  sortOrder: number;
}> = [
  { name: "Body Weight",            unit: "kg",       displayColor: "#6366f1", isBuiltin: true, isHevyMetric: false, sortOrder: 0 },
  { name: "Monthly Income",         unit: "GBP",      displayColor: "#22c55e", isBuiltin: true, isHevyMetric: false, sortOrder: 1 },
  { name: "Monthly Spend",          unit: "GBP",      displayColor: "#ef4444", isBuiltin: true, isHevyMetric: false, sortOrder: 2 },
  { name: "Savings Rate",           unit: "%",        displayColor: "#f59e0b", isBuiltin: true, isHevyMetric: false, sortOrder: 3 },
  { name: "Workout Sessions (30d)", unit: "sessions", displayColor: "#0ea5e9", isBuiltin: true, isHevyMetric: true,  sortOrder: 4 },
  { name: "Training Volume (30d)",  unit: "kg",       displayColor: "#8b5cf6", isBuiltin: true, isHevyMetric: true,  sortOrder: 5 },
  { name: "Personal Records (30d)", unit: "PRs",      displayColor: "#ec4899", isBuiltin: true, isHevyMetric: true,  sortOrder: 6 },
];

for (const metric of builtins) {
  const existing = db
    .select({ id: lifeMetricDefinitions.id })
    .from(lifeMetricDefinitions)
    .where(eq(lifeMetricDefinitions.name, metric.name))
    .all();

  if (existing.length === 0) {
    db.insert(lifeMetricDefinitions)
      .values({ id: randomUUID(), ...metric })
      .run();
    console.log(`  ✓ Seeded metric: ${metric.name}`);
  } else {
    console.log(`  – Skipped (exists): ${metric.name}`);
  }
}

console.log("✓ Seed complete");
