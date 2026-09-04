import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const CAREER_PLAN_ID = "default";

export const careerPlans = sqliteTable("career_plans", {
  id: text("id").primaryKey(),
  startDate: text("start_date").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  npa: integer("npa").notNull().default(60),
  sippAccessAge: integer("sipp_access_age").notNull().default(57),
  policeContributionRate: real("police_contribution_rate").notNull().default(0.1344),
  accrualDivisor: real("accrual_divisor").notNull().default(55.3),
  scottishHigherRateThreshold: real("scottish_higher_rate_threshold")
    .notNull()
    .default(43663),
  isaMonthlyGbp: real("isa_monthly_gbp").notNull().default(300),
  expectedRealReturn: real("expected_real_return").notNull().default(0.07),
  commutationFactor: real("commutation_factor").notNull().default(12),
  commuteFraction: real("commute_fraction").notNull().default(0.25),
  payScaleJson: text("pay_scale_json").notNull(),
  projectionYears: integer("projection_years").notNull().default(30),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
