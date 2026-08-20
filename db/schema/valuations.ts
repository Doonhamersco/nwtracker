import { sqliteTable, text, integer, real, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { accounts } from "./accounts";
import { snapshots } from "./snapshots";

export const accountValuations = sqliteTable(
  "account_valuations",
  {
    id: text("id").primaryKey(),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    // Value in the account's native currency (e.g. BTC amount, USD amount)
    valueNative: real("value_native").notNull(),
    // Value converted to GBP at the FX rate stored for THIS snapshot — never recomputed
    valueGbp: real("value_gbp").notNull(),
    // true = pre-filled from prior snapshot, not freshly entered by user
    isCarriedForward: integer("is_carried_forward", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    // One valuation per account per snapshot
    unique("uq_valuation_snapshot_account").on(t.snapshotId, t.accountId),
  ]
);
