import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, accountValuations } from "@/db/schema";
import type {
  CreateAccountInput,
  UpdateAccountInput,
} from "@/lib/validators/accounts";

export type AccountRow = typeof accounts.$inferSelect;

export function listAccounts(includeInactive = false): AccountRow[] {
  if (includeInactive) {
    return db.select().from(accounts).orderBy(accounts.sortOrder).all();
  }
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(accounts.sortOrder)
    .all();
}

export function getAccountById(id: string): AccountRow | null {
  const [row] = db.select().from(accounts).where(eq(accounts.id, id)).all();
  return row ?? null;
}

export function createAccount(input: CreateAccountInput): AccountRow {
  const id = randomUUID();

  db.insert(accounts)
    .values({
      id,
      name: input.name,
      type: input.type,
      category: input.category,
      currencyCode: input.currencyCode ?? "GBP",
      coingeckoId: input.coingeckoId ?? null,
      institution: input.institution ?? null,
      notes: input.notes ?? null,
      sortOrder: input.sortOrder ?? 0,
      wrapper: input.wrapper ?? "NONE",
      isActive: true,
    })
    .run();

  const [row] = db.select().from(accounts).where(eq(accounts.id, id)).all();
  return row;
}

export function updateAccount(
  id: string,
  input: UpdateAccountInput
): AccountRow {
  const existing = getAccountById(id);
  if (!existing) throw new Error(`Account not found: ${id}`);

  db.update(accounts)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.currencyCode !== undefined && {
        currencyCode: input.currencyCode,
      }),
      ...(input.coingeckoId !== undefined && {
        coingeckoId: input.coingeckoId,
      }),
      ...(input.institution !== undefined && {
        institution: input.institution,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      ...(input.wrapper !== undefined && { wrapper: input.wrapper }),
    })
    .where(eq(accounts.id, id))
    .run();

  const [row] = db.select().from(accounts).where(eq(accounts.id, id)).all();
  return row;
}

export function archiveAccount(id: string): void {
  const existing = getAccountById(id);
  if (!existing) throw new Error(`Account not found: ${id}`);

  db.update(accounts)
    .set({ isActive: false })
    .where(eq(accounts.id, id))
    .run();
}

export function hardDeleteAccount(id: string): void {
  const valuations = db
    .select({ id: accountValuations.id })
    .from(accountValuations)
    .where(eq(accountValuations.accountId, id))
    .limit(1)
    .all();

  if (valuations.length > 0) {
    throw new Error(
      "Cannot delete an account that has valuations — archive it instead to preserve history"
    );
  }

  db.delete(accounts).where(eq(accounts.id, id)).run();
}

export function reorderAccounts(orderedIds: string[]): void {
  db.transaction((tx) => {
    orderedIds.forEach((id, index) => {
      tx.update(accounts)
        .set({ sortOrder: index })
        .where(eq(accounts.id, id))
        .run();
    });
  });
}
