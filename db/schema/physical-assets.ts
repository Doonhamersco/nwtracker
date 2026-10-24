import { sql } from "drizzle-orm";
import { real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const physicalAssetCategoryEnum = [
  "vehicle",
  "property",
  "valuables",
  "other",
] as const;

export type PhysicalAssetCategory = (typeof physicalAssetCategoryEnum)[number];

export const physicalAssets = sqliteTable("physical_assets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category", { enum: physicalAssetCategoryEnum }).notNull(),
  valueGbp: real("value_gbp").notNull(),
  purchaseDate: text("purchase_date"),
  purchasePriceGbp: real("purchase_price_gbp"),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
