"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { TimeframeSelector, type Timeframe } from "@/components/dashboard/TimeframeSelector";
import { DebtToggle } from "@/components/dashboard/DebtToggle";
import { HeroTotal } from "@/components/dashboard/HeroTotal";
import { NetWorthChart, type NotableEvent } from "@/components/dashboard/NetWorthChart";
import { CategoryBreakdownBar } from "@/components/dashboard/CategoryBreakdownBar";
import { AssetsTable } from "@/components/dashboard/AssetsTable";
import { NotableEventsManager } from "@/components/dashboard/NotableEventsManager";
import { WeightManager, type WeightReading } from "@/components/dashboard/WeightManager";

interface SnapshotSummary {
  id: string;
  takenAt: string;
  netWorthGbp: number | null;
  isPartial: boolean;
  notes: string | null;
}

interface ValuationRow {
  id: string;
  accountId: string;
  valueNative: number;
  valueGbp: number;
  isCarriedForward: boolean;
  createdAt: string;
}

interface AccountRow {
  id: string;
  name: string;
  type: "ASSET" | "LIABILITY";
  category: string;
  currencyCode: string;
}

interface DashboardClientProps {
  initialSnapshots: SnapshotSummary[];
  latestValuations: ValuationRow[];
  previousValuations: ValuationRow[];
  accounts: AccountRow[];
  debtBySnapshot: Record<string, number>;
  initialEvents: NotableEvent[];
  initialWeightReadings: WeightReading[];
}

function computeNetWorthFromValuations(
  valuations: ValuationRow[],
  accounts: AccountRow[],
  hideDebt: boolean
): number | null {
  if (valuations.length === 0) return null;
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  let total = 0;
  let counted = false;
  for (const v of valuations) {
    const acc = accountMap.get(v.accountId);
    if (!acc) continue;
    if (hideDebt && acc.type === "LIABILITY") continue;
    counted = true;
    total += acc.type === "ASSET" ? v.valueGbp : -v.valueGbp;
  }
  return counted ? total : null;
}

function hasOutstandingDebt(
  accounts: AccountRow[],
  latestValuations: ValuationRow[]
): boolean {
  const liabilityIds = new Set(
    accounts.filter((a) => a.type === "LIABILITY").map((a) => a.id)
  );
  if (liabilityIds.size === 0) return false;
  if (latestValuations.length === 0) return true;
  return latestValuations.some(
    (v) => liabilityIds.has(v.accountId) && v.valueGbp > 0
  );
}

export function DashboardClient({
  initialSnapshots,
  latestValuations,
  previousValuations,
  accounts,
  debtBySnapshot,
  initialEvents,
  initialWeightReadings,
}: DashboardClientProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1Y");
  const [events, setEvents] = useState<NotableEvent[]>(initialEvents);
  const [weightReadings, setWeightReadings] = useState<WeightReading[]>(initialWeightReadings);
  const [hideDebt, setHideDebt] = useState(false);

  const hasDebt = hasOutstandingDebt(accounts, latestValuations);

  const sortedSnapshots = [...initialSnapshots].sort(
    (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime()
  );

  const latestSnapshot = sortedSnapshots[0] ?? null;
  const previousSnapshot = sortedSnapshots[1] ?? null;

  const fromValuations = computeNetWorthFromValuations(
    latestValuations,
    accounts,
    hideDebt
  );
  const prevFromValuations = computeNetWorthFromValuations(
    previousValuations,
    accounts,
    hideDebt
  );

  const heroNetWorth =
    fromValuations ??
    (latestSnapshot?.netWorthGbp !== null && latestSnapshot?.netWorthGbp !== undefined
      ? latestSnapshot.netWorthGbp +
        (hideDebt ? (debtBySnapshot[latestSnapshot.id] ?? 0) : 0)
      : null);

  const heroPrevious =
    prevFromValuations ??
    (previousSnapshot?.netWorthGbp !== null && previousSnapshot?.netWorthGbp !== undefined
      ? previousSnapshot.netWorthGbp +
        (hideDebt ? (debtBySnapshot[previousSnapshot.id] ?? 0) : 0)
      : null);

  const chartSnapshots = hideDebt
    ? initialSnapshots.map((s) => ({
        ...s,
        netWorthGbp:
          s.netWorthGbp !== null
            ? s.netWorthGbp + (debtBySnapshot[s.id] ?? 0)
            : null,
      }))
    : initialSnapshots;

  const visibleAccounts = hideDebt
    ? accounts.filter((a) => a.type !== "LIABILITY")
    : accounts;

  const visibleLatestValuations = hideDebt
    ? latestValuations.filter((v) => {
        const acc = accounts.find((a) => a.id === v.accountId);
        return acc?.type !== "LIABILITY";
      })
    : latestValuations;

  const visiblePreviousValuations = hideDebt
    ? previousValuations.filter((v) => {
        const acc = accounts.find((a) => a.id === v.accountId);
        return acc?.type !== "LIABILITY";
      })
    : previousValuations;

  const accountSummaries = visibleAccounts.map((acc) => {
    const val = visibleLatestValuations.find((v) => v.accountId === acc.id);
    return {
      category: acc.category,
      valueGbp: val?.valueGbp ?? 0,
      accountType: acc.type as "ASSET" | "LIABILITY",
    };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-border bg-bg-card px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <HeroTotal
            netWorthGbp={heroNetWorth}
            previousGbp={heroPrevious}
            loading={false}
            label={hideDebt ? "Liquid net worth" : "Net worth"}
          />
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <DebtToggle
                hasDebt={hasDebt}
                hideDebt={hideDebt}
                onToggle={() => setHideDebt((v) => !v)}
                compact
              />
              <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            </div>
            <Link
              href="/checkin"
              className="text-sm text-accent hover:text-accent-hover transition-colors"
            >
              Monthly check-in →
            </Link>
          </div>
        </div>
        <div className="mt-8">
          <NetWorthChart
            snapshots={chartSnapshots}
            timeframe={timeframe}
            loading={false}
            events={events}
            weightReadings={weightReadings}
            variant="hero"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="flex flex-col rounded-2xl border border-border bg-bg-card p-5 sm:p-6">
          <h2 className="mb-5 font-display text-xl font-medium text-text">Asset mix</h2>
          <CategoryBreakdownBar accounts={accountSummaries} />
        </section>

        <section className="flex flex-col rounded-2xl border border-border bg-bg-card p-5 sm:p-6">
          <h2 className="mb-5 font-display text-xl font-medium text-text">Life events</h2>
          <NotableEventsManager events={events} onEventsChange={setEvents} />
        </section>

        <section className="flex flex-col rounded-2xl border border-border bg-bg-card p-5 sm:p-6">
          <h2 className="mb-5 font-display text-xl font-medium text-text">Weight</h2>
          <WeightManager readings={weightReadings} onReadingsChange={setWeightReadings} />
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-bg-card">
        <div className="flex items-center justify-between px-5 py-4 sm:px-6">
          <h2 className="font-display text-xl font-medium text-text">Accounts</h2>
          <Link href="/assets" className="text-sm text-accent hover:text-accent-hover">
            View all →
          </Link>
        </div>
        <AssetsTable
          valuations={visibleLatestValuations}
          accounts={visibleAccounts}
          previousValuations={visiblePreviousValuations}
        />
      </section>

      <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-placeholder">
        <Lock size={11} />
        All data stays on your machine
      </p>
    </div>
  );
}
