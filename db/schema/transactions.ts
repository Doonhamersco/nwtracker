import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { accounts } from "./accounts";
import { subscriptions } from "./subscriptions";

export const transactionDirectionEnum = ["in", "out"] as const;
export const transactionCategorySourceEnum = ["rule", "manual", "import"] as const;
export const categoryRuleMatchTypeEnum = ["contains", "exact", "regex"] as const;

export type TransactionDirection = (typeof transactionDirectionEnum)[number];
export type TransactionCategorySource =
  (typeof transactionCategorySourceEnum)[number];
export type CategoryRuleMatchType = (typeof categoryRuleMatchTypeEnum)[number];

export const transactions = sqliteTable(
  "transactions",
  {
    // sha256 of account_id + date + amount + direction + description_raw + balance_after
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    date: text("date").notNull(),
    descriptionRaw: text("description_raw").notNull(),
    merchant: text("merchant").notNull(),
    // Signed GBP. Outflows are negative.
    amountGbp: real("amount_gbp").notNull(),
    direction: text("direction", { enum: transactionDirectionEnum }).notNull(),
    type: text("type").notNull(),
    balanceAfterGbp: real("balance_after_gbp").notNull(),
    category: text("category"),
    categorySource: text("category_source", {
      enum: transactionCategorySourceEnum,
    }),
    // Savings pots, round-ups, and own-account moves are excluded from spend.
    isTransfer: integer("is_transfer", { mode: "boolean" })
      .notNull()
      .default(false),
    subscriptionId: text("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    statementMonth: text("statement_month").notNull(),
    importBatchId: text("import_batch_id").notNull(),
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index("transactions_account_date_idx").on(t.accountId, t.date),
    index("transactions_category_idx").on(t.category),
  ]
);

export const transactionCategoryRules = sqliteTable(
  "transaction_category_rules",
  {
    id: text("id").primaryKey(),
    pattern: text("pattern").notNull(),
    matchType: text("match_type", { enum: categoryRuleMatchTypeEnum }).notNull(),
    category: text("category").notNull(),
    isTransfer: integer("is_transfer", { mode: "boolean" })
      .notNull()
      .default(false),
    priority: integer("priority").notNull().default(100),
  }
);
