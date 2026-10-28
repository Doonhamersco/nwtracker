import { notFound } from "next/navigation";
import { ManualSpendingClient } from "@/components/spending/ManualSpendingClient";
import { PreviewFrame } from "@/app/preview/PreviewFrame";
import type { ManualSpendingLineInput, ManualSpendingTotalInput } from "@/lib/spending/manual";

export const dynamic = "force-dynamic";

const totals: ManualSpendingTotalInput[] = [
  { month: "2026-09", category: "Expenses", amountGbp: 420 },
  { month: "2026-09", category: "Going Out", amountGbp: 150 },
  { month: "2026-09", category: "Shopping", amountGbp: 80 },
  { month: "2026-09", category: "Groceries", amountGbp: 290 },
  { month: "2026-09", category: "Entertainment", amountGbp: 35 },
  { month: "2026-09", category: "Cash", amountGbp: 20 },
  { month: "2026-09", category: "Car & fuel", amountGbp: 60 },
  { month: "2026-09", category: "Transfers", amountGbp: 100 },
  { month: "2026-10", category: "Expenses", amountGbp: 450 },
  { month: "2026-10", category: "Going Out", amountGbp: 180 },
  { month: "2026-10", category: "Shopping", amountGbp: 95 },
  { month: "2026-10", category: "Groceries", amountGbp: 310 },
  { month: "2026-10", category: "Entertainment", amountGbp: 40 },
  { month: "2026-10", category: "Cash", amountGbp: 15 },
  { month: "2026-10", category: "Car & fuel", amountGbp: 70 },
  { month: "2026-10", category: "Transfers", amountGbp: 200 },
];

const lines: ManualSpendingLineInput[] = [
  {
    id: "line-groceries",
    date: "2026-10-12",
    category: "Groceries",
    amountGbp: 18.4,
    note: "Corner shop",
  },
];

export default async function SpendingPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const raw = Array.isArray(params.month) ? params.month[0] : params.month;
  const month = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : "2026-10";

  return (
    <PreviewFrame note="Sample monthly totals for layout review. Changes on this page stay in the browser.">
      <ManualSpendingClient
        month={month}
        totals={totals}
        lines={lines}
        persist={false}
        basePath="/preview/spending"
      />
    </PreviewFrame>
  );
}
