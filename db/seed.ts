import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { lifeMetricDefinitions } from "./schema";

type DB = BetterSQLite3Database<typeof schema>;

const BUILTINS: Array<{
  name: string;
  unit: string;
  displayColor: string;
  isBuiltin: boolean;
  isHevyMetric: boolean;
  sortOrder: number;
}> = [
  { name: "Body Weight", unit: "kg", displayColor: "#6366f1", isBuiltin: true, isHevyMetric: false, sortOrder: 0 },
  { name: "Monthly Income", unit: "GBP", displayColor: "#22c55e", isBuiltin: true, isHevyMetric: false, sortOrder: 1 },
  { name: "Monthly Spend", unit: "GBP", displayColor: "#ef4444", isBuiltin: true, isHevyMetric: false, sortOrder: 2 },
  { name: "Savings Rate", unit: "%", displayColor: "#f59e0b", isBuiltin: true, isHevyMetric: false, sortOrder: 3 },
  { name: "Workout Sessions (30d)", unit: "sessions", displayColor: "#0ea5e9", isBuiltin: true, isHevyMetric: true, sortOrder: 4 },
  { name: "Training Volume (30d)", unit: "kg", displayColor: "#8b5cf6", isBuiltin: true, isHevyMetric: true, sortOrder: 5 },
  { name: "Personal Records (30d)", unit: "PRs", displayColor: "#ec4899", isBuiltin: true, isHevyMetric: true, sortOrder: 6 },
];

export function seedBuiltins(db: DB, log = false): void {
  for (const metric of BUILTINS) {
    const existing = db
      .select({ id: lifeMetricDefinitions.id })
      .from(lifeMetricDefinitions)
      .where(eq(lifeMetricDefinitions.name, metric.name))
      .all();

    if (existing.length === 0) {
      db.insert(lifeMetricDefinitions)
        .values({ id: randomUUID(), ...metric })
        .run();
      if (log) console.log(`  ✓ Seeded metric: ${metric.name}`);
    } else if (log) {
      console.log(`  – Skipped (exists): ${metric.name}`);
    }
  }
}
