import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const accountTypeEnum = ["ASSET", "LIABILITY"] as const;
export const accountCategoryEnum = [
  "CASH",
  "ISA",
  "CRYPTO",
  "VEHICLE",
  "STUDENT_LOAN",
  "PENSION",
  "PROPERTY",
  "STOCKS",
  "OTHER_ASSET",
  "OTHER_LIABILITY",
] as const;

export const accountWrapperEnum = [
  "NONE",
  "STOCKS_ISA",
  "SIPP",
  "CASH_ISA",
] as const;

export type AccountType = (typeof accountTypeEnum)[number];
export type AccountCategory = (typeof accountCategoryEnum)[number];
export type AccountWrapper = (typeof accountWrapperEnum)[number];

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: accountTypeEnum }).notNull(),
  category: text("category", { enum: accountCategoryEnum }).notNull(),
  wrapper: text("wrapper", { enum: accountWrapperEnum })
    .notNull()
    .default("NONE"),
  currencyCode: text("currency_code").notNull().default("GBP"),
  institution: text("institution"),
  notes: text("notes"),
  // For CRYPTO accounts: CoinGecko coin ID (e.g. "bitcoin", "ethereum")
  // Used to auto-fetch GBP spot price at check-in time
  coingeckoId: text("coingecko_id"),
  // For non-GBP fiat accounts: ISO 4217 code (e.g. "USD", "EUR")
  // If currencyCode = "GBP" this is ignored
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
