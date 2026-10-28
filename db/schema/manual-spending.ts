import { sql } from "drizzle-orm";
import { real, sqliteTable, text, unique, index } from "drizzle-orm/sqlite-core";

/** Chase tracker totals typed in for one calendar month and category. */
export const manualSpendingTotals = sqliteTable(
  "manual_spending_totals",
  {
    id: text("id").primaryKey(),
    month: text("month").notNull(),
    category: text("category").notNull(),
    amountGbp: real("amount_gbp").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [unique("uq_manual_spending_month_category").on(t.month, t.category)]
);

/** Optional individual expenses. They roll into the month of `date`. */
export const manualSpendingLines = sqliteTable(
  "manual_spending_lines",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    category: text("category").notNull(),
    amountGbp: real("amount_gbp").notNull(),
    note: text("note"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("manual_spending_lines_date_idx").on(t.date)]
);
