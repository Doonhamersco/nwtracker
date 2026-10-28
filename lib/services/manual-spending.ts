import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { manualSpendingLines, manualSpendingTotals } from "@/db/schema";
import { normaliseIsoDate } from "@/lib/spending/dates";
import {
  MANUAL_SPENDING_CATEGORIES,
  buildManualSpendingView,
  currentLondonMonth,
  isManualCategory,
  type ManualSpendingCategory,
  type ManualSpendingView,
} from "@/lib/spending/manual";
import { roundPence } from "@/lib/spending/money";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export class ManualSpendingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManualSpendingError";
  }
}

export function getManualSpending(month?: string | null): ManualSpendingView {
  const selected = month && MONTH_RE.test(month) ? month : currentLondonMonth();
  const totals = db.select().from(manualSpendingTotals).all();
  const lines = db.select().from(manualSpendingLines).all();
  return buildManualSpendingView({
    month: selected,
    totals: totals.map((row) => ({
      month: row.month,
      category: row.category,
      amountGbp: row.amountGbp,
    })),
    lines: lines.map((row) => ({
      id: row.id,
      date: row.date,
      category: row.category,
      amountGbp: row.amountGbp,
      note: row.note,
    })),
  });
}

export function saveManualCategoryTotals(
  month: string,
  amounts: Array<{ category: string; amountGbp: number }>
): ManualSpendingView {
  const selected = assertMonth(month);
  const byCategory = new Map<ManualSpendingCategory, number>(
    MANUAL_SPENDING_CATEGORIES.map((category) => [category, 0])
  );
  for (const row of amounts) {
    byCategory.set(assertCategory(row.category), assertAmount(row.amountGbp, true));
  }
  const updatedAt = new Date().toISOString();

  db.transaction((tx) => {
    for (const [category, amountGbp] of byCategory) {
      const [existing] = tx
        .select()
        .from(manualSpendingTotals)
        .where(and(eq(manualSpendingTotals.month, selected), eq(manualSpendingTotals.category, category)))
        .all();
      if (existing) {
        tx.update(manualSpendingTotals)
          .set({ amountGbp, updatedAt })
          .where(eq(manualSpendingTotals.id, existing.id))
          .run();
      } else {
        tx.insert(manualSpendingTotals)
          .values({
            id: randomUUID(),
            month: selected,
            category,
            amountGbp,
            updatedAt,
          })
          .run();
      }
    }
  });

  return getManualSpending(selected);
}

export function addManualSpendingLine(input: {
  date: string;
  category: string;
  amountGbp: number;
  note?: string | null;
}): ManualSpendingView {
  const date = normaliseIsoDate(input.date);
  if (!date) throw new ManualSpendingError("Enter a real date");
  const category = assertCategory(input.category);
  const amountGbp = assertAmount(input.amountGbp, false);
  const note = normaliseNote(input.note);

  db.insert(manualSpendingLines)
    .values({
      id: randomUUID(),
      date,
      category,
      amountGbp,
      note,
    })
    .run();

  return getManualSpending(date.slice(0, 7));
}

export function deleteManualSpendingLine(id: string): ManualSpendingView {
  const [existing] = db
    .select()
    .from(manualSpendingLines)
    .where(eq(manualSpendingLines.id, id))
    .all();
  if (!existing) throw new ManualSpendingError("Expense line not found");
  db.delete(manualSpendingLines).where(eq(manualSpendingLines.id, id)).run();
  return getManualSpending(existing.date.slice(0, 7));
}

function assertMonth(month: string): string {
  if (!MONTH_RE.test(month)) throw new ManualSpendingError("Choose a month");
  return month;
}

function assertCategory(category: string): ManualSpendingCategory {
  if (!isManualCategory(category)) throw new ManualSpendingError("Choose one of the spending categories");
  return category;
}

function assertAmount(value: number, allowZero: boolean): number {
  if (!Number.isFinite(value)) throw new ManualSpendingError("Enter an amount in pounds");
  const amount = roundPence(value);
  if (amount < 0 || (!allowZero && amount === 0)) {
    throw new ManualSpendingError("Enter an amount in pounds");
  }
  return amount;
}

function normaliseNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.length > 500) throw new ManualSpendingError("Note must be 500 characters or fewer");
  return trimmed;
}
