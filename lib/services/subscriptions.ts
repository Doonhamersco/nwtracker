import { randomUUID } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { subscriptions } from "@/db/schema";
import { listFiles, deleteFile, type FileRow } from "@/lib/services/files";
import type {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from "@/lib/validators/subscriptions";
import type { SubscriptionStatus } from "@/db/schema";
import { monthlyEquivalent, activeMonthlyTotal } from "@/lib/subscriptions-math";

export type SubscriptionRow = typeof subscriptions.$inferSelect;
export { monthlyEquivalent, activeMonthlyTotal };

export interface SubscriptionWithFiles {
  subscription: SubscriptionRow;
  files: FileRow[];
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveCancellation(input: {
  status?: SubscriptionStatus;
  cancelledAt?: string | null;
  previousStatus?: SubscriptionStatus;
  previousCancelledAt?: string | null;
}): { status: SubscriptionStatus; cancelledAt: string | null } {
  const status = input.status ?? input.previousStatus ?? "active";
  if (status === "cancelled") {
    return {
      status,
      cancelledAt:
        input.cancelledAt !== undefined && input.cancelledAt !== null
          ? input.cancelledAt
          : (input.previousCancelledAt ?? todayIsoDate()),
    };
  }
  return { status, cancelledAt: null };
}

function withFiles(row: SubscriptionRow): SubscriptionWithFiles {
  return {
    subscription: row,
    files: listFiles("SUBSCRIPTION", row.id),
  };
}

export function createSubscription(
  input: CreateSubscriptionInput
): SubscriptionRow {
  const id = randomUUID();
  const { status, cancelledAt } = resolveCancellation({
    status: input.status,
    cancelledAt: input.cancelledAt,
  });

  db.insert(subscriptions)
    .values({
      id,
      name: input.name,
      costGbp: input.costGbp,
      billingCycle: input.billingCycle,
      nextRenewalDate: input.nextRenewalDate ?? null,
      category: input.category,
      status,
      notes: input.notes ?? null,
      cancelledAt,
    })
    .run();

  const [row] = db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .all();
  return row;
}

export function updateSubscription(
  id: string,
  input: UpdateSubscriptionInput
): SubscriptionRow {
  const existing = db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .all()[0];
  if (!existing) throw new Error(`Subscription not found: ${id}`);

  const cancellation =
    input.status !== undefined || input.cancelledAt !== undefined
      ? resolveCancellation({
          status: input.status,
          cancelledAt: input.cancelledAt,
          previousStatus: existing.status,
          previousCancelledAt: existing.cancelledAt,
        })
      : null;

  db.update(subscriptions)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.costGbp !== undefined && { costGbp: input.costGbp }),
      ...(input.billingCycle !== undefined && {
        billingCycle: input.billingCycle,
      }),
      ...(input.nextRenewalDate !== undefined && {
        nextRenewalDate: input.nextRenewalDate,
      }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(cancellation !== null && {
        status: cancellation.status,
        cancelledAt: cancellation.cancelledAt,
      }),
    })
    .where(eq(subscriptions.id, id))
    .run();

  const [row] = db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .all();
  return row;
}

export function deleteSubscription(id: string): void {
  for (const file of listFiles("SUBSCRIPTION", id)) {
    deleteFile(file.id);
  }
  db.delete(subscriptions).where(eq(subscriptions.id, id)).run();
}

export function listSubscriptions(): SubscriptionWithFiles[] {
  const rows = db
    .select()
    .from(subscriptions)
    .orderBy(desc(subscriptions.createdAt))
    .all();
  return rows.map(withFiles);
}

export function getSubscriptionById(id: string): SubscriptionWithFiles | null {
  const [row] = db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .all();
  if (!row) return null;
  return withFiles(row);
}
