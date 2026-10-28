import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { resetAllTables } from "./helpers/test-db";
import { manualSpendingLines, manualSpendingTotals } from "@/db/schema";
import {
  MANUAL_SPENDING_CATEGORIES,
  buildManualSpendingView,
} from "@/lib/spending/manual";

vi.mock("@/db/client", async () => {
  const { createTestDb } = await import("./helpers/test-db");
  const { db, sqlite } = createTestDb();
  return { db, _sqlite: sqlite };
});

const clientModule = await import("@/db/client");
const { db } = clientModule;
const sqlite = (clientModule as unknown as { _sqlite: import("better-sqlite3").Database })._sqlite;
const {
  addManualSpendingLine,
  deleteManualSpendingLine,
  getManualSpending,
  saveManualCategoryTotals,
} = await import("@/lib/services/manual-spending");

beforeEach(() => {
  resetAllTables(sqlite);
});

describe("buildManualSpendingView", () => {
  it("keeps the Chase categories in order and adds individual lines into the month", () => {
    const view = buildManualSpendingView({
      month: "2026-10",
      totals: [
        { month: "2026-09", category: "Groceries", amountGbp: 100 },
        { month: "2026-10", category: "Groceries", amountGbp: 310 },
        { month: "2026-10", category: "Transfers", amountGbp: 200 },
        { month: "2026-10", category: "Old category", amountGbp: 999 },
      ],
      lines: [
        { id: "a", date: "2026-10-12", category: "Groceries", amountGbp: 18.4, note: "Corner shop" },
        { id: "b", date: "2026-09-02", category: "Groceries", amountGbp: 5, note: null },
      ],
    });

    expect(view.categories.map((row) => row.category)).toEqual([...MANUAL_SPENDING_CATEGORIES]);
    const groceries = view.categories.find((row) => row.category === "Groceries");
    expect(groceries).toMatchObject({ enteredGbp: 310, linesGbp: 18.4, totalGbp: 328.4 });
    expect(view.totalGbp).toBeCloseTo(528.4);
    expect(view.previousMonth).toBe("2026-09");
    expect(view.previousTotalGbp).toBeCloseTo(105);
    expect(view.lines.map((line) => line.id)).toEqual(["a"]);
    expect(view.trend).toHaveLength(12);
    expect(view.trend[0]).toEqual({ month: "2025-11", totalGbp: 0 });
    expect(view.trend.at(-1)?.totalGbp).toBeCloseTo(528.4);
  });
});

describe("manual spending service", () => {
  it("saves a month, edits it later, and rolls a line into that category", () => {
    saveManualCategoryTotals("2026-10", [
      { category: "Expenses", amountGbp: 450 },
      { category: "Groceries", amountGbp: 310 },
    ]);
    saveManualCategoryTotals("2026-10", [
      { category: "Expenses", amountGbp: 400 },
      { category: "Groceries", amountGbp: 310 },
    ]);

    const saved = getManualSpending("2026-10");
    expect(saved.categories.find((row) => row.category === "Expenses")?.enteredGbp).toBe(400);
    expect(db.select().from(manualSpendingTotals).all()).toHaveLength(MANUAL_SPENDING_CATEGORIES.length);

    const withLine = addManualSpendingLine({
      date: "2026-10-12",
      category: "Groceries",
      amountGbp: 18.4,
      note: "  Corner shop  ",
    });
    expect(withLine.categories.find((row) => row.category === "Groceries")).toMatchObject({
      enteredGbp: 310,
      linesGbp: 18.4,
      totalGbp: 328.4,
    });
    expect(withLine.totalGbp).toBeCloseTo(728.4);
    expect(withLine.lines[0]?.note).toBe("Corner shop");

    const cleared = deleteManualSpendingLine(withLine.lines[0].id);
    expect(cleared.lines).toEqual([]);
    expect(cleared.categories.find((row) => row.category === "Groceries")?.totalGbp).toBe(310);
    expect(db.select().from(manualSpendingLines).where(eq(manualSpendingLines.date, "2026-10-12")).all()).toEqual(
      []
    );
  });

  it("rejects an unknown category and a negative amount without writing", () => {
    expect(() => saveManualCategoryTotals("2026-10", [{ category: "Rent", amountGbp: 10 }])).toThrow(
      /categories/
    );
    expect(() =>
      addManualSpendingLine({ date: "2026-10-01", category: "Cash", amountGbp: -5, note: null })
    ).toThrow(/amount/);
    expect(db.select().from(manualSpendingTotals).all()).toEqual([]);
    expect(db.select().from(manualSpendingLines).all()).toEqual([]);
  });
});
