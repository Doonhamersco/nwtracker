import { sqliteTable, text, integer, real, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { snapshots } from "./snapshots";

export const lifeMetricDefinitions = sqliteTable("life_metric_definitions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(), // e.g. "kg", "GBP", "%", "sessions"
  displayColor: text("display_color").notNull().default("#6366f1"),
  // true = shipped with the app (weight, income, spend, savings_rate)
  isBuiltin: integer("is_builtin", { mode: "boolean" }).notNull().default(false),
  // true = sourced from Hevy API automatically
  isHevyMetric: integer("is_hevy_metric", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const lifeMetricReadings = sqliteTable(
  "life_metric_readings",
  {
    id: text("id").primaryKey(),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    metricId: text("metric_id")
      .notNull()
      .references(() => lifeMetricDefinitions.id, { onDelete: "restrict" }),
    value: real("value").notNull(),
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    // One reading per metric per snapshot
    unique("uq_reading_snapshot_metric").on(t.snapshotId, t.metricId),
  ]
);

export const hevySyncLogs = sqliteTable("hevy_sync_logs", {
  id: text("id").primaryKey(),
  snapshotId: text("snapshot_id")
    .notNull()
    .references(() => snapshots.id, { onDelete: "cascade" }),
  syncedAt: text("synced_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  workoutsLast30d: integer("workouts_last_30d"),
  totalVolumeKg: real("total_volume_kg"),
  personalRecordsCount: integer("personal_records_count"),
  // Raw JSON stored for auditability
  rawJson: text("raw_json"),
});
