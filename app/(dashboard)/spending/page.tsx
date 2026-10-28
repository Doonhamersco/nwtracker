import { ManualSpendingClient } from "@/components/spending/ManualSpendingClient";
import { getManualSpending } from "@/lib/services/manual-spending";
import { db } from "@/db/client";
import { manualSpendingLines, manualSpendingTotals } from "@/db/schema";

export const metadata = {
  title: "Spending — nwTracker",
};

export default async function SpendingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.month) ? params.month[0] : params.month;
  const month = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : null;
  const view = getManualSpending(month);
  const totals = db.select().from(manualSpendingTotals).all();
  const lines = db.select().from(manualSpendingLines).all();

  return (
    <ManualSpendingClient
      month={view.month}
      totals={totals.map((row) => ({
        month: row.month,
        category: row.category,
        amountGbp: row.amountGbp,
      }))}
      lines={lines.map((row) => ({
        id: row.id,
        date: row.date,
        category: row.category,
        amountGbp: row.amountGbp,
        note: row.note,
      }))}
    />
  );
}
