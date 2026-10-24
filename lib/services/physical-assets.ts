import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { physicalAssets } from "@/db/schema";
import { roundPence } from "@/lib/spending/money";
import type {
  CreatePhysicalAssetInput,
  UpdatePhysicalAssetInput,
} from "@/lib/validators/physical-assets";

export type PhysicalAssetRow = typeof physicalAssets.$inferSelect;

export function listPhysicalAssets(): PhysicalAssetRow[] {
  return db.select().from(physicalAssets).orderBy(desc(physicalAssets.createdAt), physicalAssets.name).all();
}

export function totalPhysicalAssetsGbp(): number {
  const total = listPhysicalAssets().reduce((sum, asset) => sum + asset.valueGbp, 0);
  return roundPence(total);
}

export function createPhysicalAsset(input: CreatePhysicalAssetInput): PhysicalAssetRow {
  const id = randomUUID();
  db.insert(physicalAssets)
    .values({
      id,
      name: input.name.trim(),
      category: input.category,
      valueGbp: roundPence(input.valueGbp),
      purchaseDate: input.purchaseDate ?? null,
      purchasePriceGbp:
        input.purchasePriceGbp === undefined || input.purchasePriceGbp === null
          ? null
          : roundPence(input.purchasePriceGbp),
      notes: blankToNull(input.notes),
    })
    .run();
  return requireAsset(id);
}

export function updatePhysicalAsset(id: string, input: UpdatePhysicalAssetInput): PhysicalAssetRow {
  requireAsset(id);
  const patch: Partial<typeof physicalAssets.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.category !== undefined) patch.category = input.category;
  if (input.valueGbp !== undefined) patch.valueGbp = roundPence(input.valueGbp);
  if (input.purchaseDate !== undefined) patch.purchaseDate = input.purchaseDate;
  if (input.purchasePriceGbp !== undefined) {
    patch.purchasePriceGbp =
      input.purchasePriceGbp === null ? null : roundPence(input.purchasePriceGbp);
  }
  if (input.notes !== undefined) patch.notes = blankToNull(input.notes);

  db.update(physicalAssets).set(patch).where(eq(physicalAssets.id, id)).run();
  return requireAsset(id);
}

export function deletePhysicalAsset(id: string): void {
  const result = db.delete(physicalAssets).where(eq(physicalAssets.id, id)).run();
  if (result.changes === 0) throw new Error("Physical asset not found");
}

function requireAsset(id: string): PhysicalAssetRow {
  const [row] = db.select().from(physicalAssets).where(eq(physicalAssets.id, id)).all();
  if (!row) throw new Error("Physical asset not found");
  return row;
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
