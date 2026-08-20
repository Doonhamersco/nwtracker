import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { lifeMetricDefinitions } from "./life-metrics";
import { accountCategoryEnum } from "./accounts";

export const goalMetricTypeEnum = [
  "NET_WORTH",
  "LIFE_METRIC",
  "ACCOUNT_CATEGORY",
] as const;

export type GoalMetricType = (typeof goalMetricTypeEnum)[number];

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  targetValue: real("target_value").notNull(),
  targetDate: text("target_date").notNull(), // ISO date string YYYY-MM-DD
  metricType: text("metric_type", { enum: goalMetricTypeEnum }).notNull(),
  // Set when metricType = LIFE_METRIC
  linkedMetricId: text("linked_metric_id").references(
    () => lifeMetricDefinitions.id,
    { onDelete: "set null" }
  ),
  // Set when metricType = ACCOUNT_CATEGORY
  linkedCategory: text("linked_category", { enum: accountCategoryEnum }),
  // Baseline value at goal creation — progress % computed against this
  baselineValue: real("baseline_value"),
  baselineDate: text("baseline_date"), // ISO date string
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
