import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { accounts } from "@/db/schema";
import { getSnapshotById } from "@/lib/services/checkin";
import { formatSnapshotDayLabel } from "@/lib/engine/net-worth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata = {
  title: "Snapshot — nwTracker",
};

function pounds(value: number): string {
  return value.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
}

export default async function SnapshotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getSnapshotById(id);
  if (!data) notFound();

  const accountRows = db.select().from(accounts).all();
  const byId = new Map(accountRows.map((account) => [account.id, account]));
  const rows = data.valuations
    .map((valuation) => {
      const account = byId.get(valuation.accountId);
      return { valuation, account };
    })
    .sort((a, b) => (b.valuation.valueGbp ?? 0) - (a.valuation.valueGbp ?? 0));

  const notes = data.snapshot.notes?.trim() ?? "";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/dashboard" className="text-sm text-accent hover:text-accent-hover">
          ← Overview
        </Link>
        <h1 className="mt-2 font-display text-3xl font-medium text-text">
          {formatSnapshotDayLabel(data.snapshot.takenAt)}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {data.snapshot.netWorthGbp !== null && (
            <p className="font-mono text-lg text-text">{pounds(data.snapshot.netWorthGbp)}</p>
          )}
          {data.snapshot.isPartial && <Badge variant="neutral">Partial</Badge>}
        </div>
      </div>

      <Card>
        <h2 className="font-display text-xl font-medium text-text">Notes</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
          {notes || "No description for this snapshot."}
        </p>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <h2 className="px-5 py-4 font-display text-xl font-medium text-text">Accounts</h2>
        {rows.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">No account balances on this snapshot.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map(({ valuation, account }) => (
              <li key={valuation.id} className="flex items-baseline justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text">{account?.name ?? "Unknown account"}</p>
                  <p className="text-xs text-muted">
                    {account?.category ?? "—"}
                    {valuation.isCarriedForward ? " · carried forward" : ""}
                    {valuation.netDepositGbp != null
                      ? ` · ${valuation.netDepositGbp < 0 ? "withdrew" : "deposited"} ${pounds(Math.abs(valuation.netDepositGbp))}`
                      : ""}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm text-text">{pounds(valuation.valueGbp)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
