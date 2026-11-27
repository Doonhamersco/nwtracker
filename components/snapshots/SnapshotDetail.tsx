"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useDashboardPrefs } from "@/components/dashboard/useDashboardPrefs";
import type { SnapshotAccountLine } from "@/lib/snapshots/display";
import { presentSnapshot, type SnapshotAccountType } from "@/lib/snapshots/display";
import type { SnapshotWorth } from "@/lib/engine/net-worth";

function pounds(value: number): string {
  return value.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  });
}

export function SnapshotDetail({
  dateLabel,
  notes,
  isPartial,
  snapshot,
  accounts,
  isLatestCommitted,
  currentPhysicalAssetsGbp,
  mode,
  assets,
}: {
  dateLabel: string;
  notes: string;
  isPartial: boolean;
  snapshot: SnapshotWorth;
  accounts: Array<{
    id: string;
    name: string;
    category: string;
    type: SnapshotAccountType;
    valueGbp: number;
    carriedForward: boolean;
    netDepositGbp: number | null;
  }>;
  isLatestCommitted: boolean;
  currentPhysicalAssetsGbp: number;
  mode: "liquid" | "total" | null;
  assets: "hidden" | "shown" | null;
}) {
  const prefs = useDashboardPrefs();
  const hideDebt = mode === "liquid" ? true : mode === "total" ? false : prefs.hideDebt;
  const hideAssets = assets === "hidden" ? true : assets === "shown" ? false : prefs.hideAssets;
  const view = presentSnapshot({
    snapshot,
    accounts,
    isLatestCommitted,
    currentPhysicalAssetsGbp,
    hideDebt,
    hideAssets,
  });
  const assetsShown = view.lines.filter((line) => line.type === "ASSET");
  const liabilities = view.lines.filter((line) => line.type === "LIABILITY");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/dashboard" className="text-sm text-accent hover:text-accent-hover">
          ← Overview
        </Link>
        <h1 className="mt-2 font-display text-3xl font-medium text-text">{dateLabel}</h1>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">{view.label}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {view.totalGbp !== null && (
            <p className="font-mono text-lg text-text">{pounds(view.totalGbp)}</p>
          )}
          {isPartial && <Badge variant="neutral">Partial</Badge>}
        </div>
      </div>

      <Card>
        <h2 className="font-display text-xl font-medium text-text">Notes</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
          {notes || "No description for this snapshot."}
        </p>
      </Card>

      <AccountSection title="Accounts" lines={assetsShown} empty="No account balances on this snapshot." />
      {liabilities.length > 0 && <AccountSection title="Liabilities" lines={liabilities} empty="" />}
    </div>
  );
}

function AccountSection({
  title,
  lines,
  empty,
}: {
  title: string;
  lines: SnapshotAccountLine[];
  empty: string;
}) {
  return (
    <Card padding="none" className="overflow-hidden">
      <h2 className="px-5 py-4 font-display text-xl font-medium text-text">{title}</h2>
      {lines.length === 0 ? (
        empty ? <p className="px-5 pb-5 text-sm text-muted">{empty}</p> : null
      ) : (
        <ul className="divide-y divide-border">
          {lines.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-text">{line.name}</p>
                <p className="text-xs text-muted">
                  {line.category}
                  {line.carriedForward ? " · carried forward" : ""}
                  {line.netDepositGbp != null
                    ? ` · ${line.netDepositGbp < 0 ? "withdrew" : "deposited"} ${pounds(Math.abs(line.netDepositGbp))}`
                    : ""}
                </p>
              </div>
              <p
                className={`shrink-0 font-mono text-sm ${
                  line.signedGbp < 0 ? "text-negative" : "text-text"
                }`}
              >
                {pounds(line.signedGbp)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
