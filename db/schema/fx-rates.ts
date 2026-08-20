import { sqliteTable, text, real, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { snapshots } from "./snapshots";

export const fxRateSourceEnum = [
  "frankfurter",
  "coingecko",
  "manual",
] as const;

export const fxRates = sqliteTable(
  "fx_rates",
  {
    id: text("id").primaryKey(),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    fromCurrency: text("from_currency").notNull(),
    // Always GBP — base currency is fixed
    toCurrency: text("to_currency").notNull().default("GBP"),
    rate: real("rate").notNull(),
    source: text("source", { enum: fxRateSourceEnum }).notNull(),
    fetchedAt: text("fetched_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    // One rate per currency pair per snapshot
    unique("uq_fx_snapshot_pair").on(t.snapshotId, t.fromCurrency, t.toCurrency),
  ]
);
