import { londonToday } from "@/lib/training/dates";
import { roundPence } from "@/lib/spending/money";

export const MANUAL_SPENDING_CATEGORIES = [
  "Expenses",
  "Going Out",
  "Shopping",
  "Groceries",
  "Entertainment",
  "Cash",
  "Car & fuel",
  "Transfers",
] as const;

export type ManualSpendingCategory = (typeof MANUAL_SPENDING_CATEGORIES)[number];

const CATEGORY_SET = new Set<string>(MANUAL_SPENDING_CATEGORIES);

export interface ManualSpendingTotalInput {
  month: string;
  category: string;
  amountGbp: number;
}

export interface ManualSpendingLineInput {
  id: string;
  date: string;
  category: string;
  amountGbp: number;
  note: string | null;
}

export interface ManualCategoryBreakdown {
  category: ManualSpendingCategory;
  enteredGbp: number;
  linesGbp: number;
  totalGbp: number;
}

export interface ManualSpendingLine {
  id: string;
  date: string;
  category: ManualSpendingCategory;
  amountGbp: number;
  note: string | null;
}

export interface ManualMonthTrend {
  month: string;
  totalGbp: number;
}

export interface ManualSpendingView {
  month: string;
  totalGbp: number;
  previousMonth: string;
  previousTotalGbp: number;
  categories: ManualCategoryBreakdown[];
  lines: ManualSpendingLine[];
  trend: ManualMonthTrend[];
}

export function currentLondonMonth(now = new Date()): string {
  return londonToday(now).slice(0, 7);
}

export function isManualCategory(value: string): value is ManualSpendingCategory {
  return CATEGORY_SET.has(value);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildManualSpendingView(input: {
  month: string;
  totals: ManualSpendingTotalInput[];
  lines: ManualSpendingLineInput[];
}): ManualSpendingView {
  const months = Array.from({ length: 12 }, (_, index) => shiftMonth(input.month, index - 11));
  const trend = months.map((month) => ({
    month,
    totalGbp: roundPence(monthTotal(month, input.totals, input.lines)),
  }));
  const categories = MANUAL_SPENDING_CATEGORIES.map((category) => {
    const enteredGbp = roundPence(enteredAmount(input.month, category, input.totals));
    const linesGbp = roundPence(lineAmount(input.month, category, input.lines));
    return {
      category,
      enteredGbp,
      linesGbp,
      totalGbp: roundPence(enteredGbp + linesGbp),
    };
  });
  const previousMonth = shiftMonth(input.month, -1);
  return {
    month: input.month,
    totalGbp: roundPence(categories.reduce((sum, row) => sum + row.totalGbp, 0)),
    previousMonth,
    previousTotalGbp: roundPence(monthTotal(previousMonth, input.totals, input.lines)),
    categories,
    lines: input.lines
      .filter((line) => line.date.slice(0, 7) === input.month && isManualCategory(line.category))
      .map((line) => ({
        id: line.id,
        date: line.date,
        category: line.category as ManualSpendingCategory,
        amountGbp: roundPence(line.amountGbp),
        note: line.note,
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.category.localeCompare(b.category)),
    trend,
  };
}

function enteredAmount(
  month: string,
  category: string,
  totals: ManualSpendingTotalInput[]
): number {
  return totals
    .filter((row) => row.month === month && row.category === category)
    .reduce((sum, row) => sum + row.amountGbp, 0);
}

function lineAmount(month: string, category: string, lines: ManualSpendingLineInput[]): number {
  return lines
    .filter((line) => line.date.slice(0, 7) === month && line.category === category)
    .reduce((sum, line) => sum + line.amountGbp, 0);
}

function monthTotal(
  month: string,
  totals: ManualSpendingTotalInput[],
  lines: ManualSpendingLineInput[]
): number {
  return MANUAL_SPENDING_CATEGORIES.reduce(
    (sum, category) => sum + enteredAmount(month, category, totals) + lineAmount(month, category, lines),
    0
  );
}
