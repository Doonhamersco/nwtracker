"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { TimeframeSelector } from "@/components/dashboard/TimeframeSelector";
import { DebtToggle } from "@/components/dashboard/DebtToggle";
import { HeroTotal } from "@/components/dashboard/HeroTotal";
import { NetWorthChart, type NotableEvent } from "@/components/dashboard/NetWorthChart";
import { CategoryBreakdownBar } from "@/components/dashboard/CategoryBreakdownBar";
import { AssetsTable } from "@/components/dashboard/AssetsTable";
import { NotableEventsManager } from "@/components/dashboard/NotableEventsManager";
import { WeightManager, type WeightReading } from "@/components/dashboard/WeightManager";
import { KpiStrip } from "@/components/dashboard/KpiStrip";
import { useCheckinDueLabel, useDashboardPrefs } from "@/components/dashboard/useDashboardPrefs";
import { Card } from "@/components/ui/Card";
import type { AccountMove, SeriesPoint } from "@/lib/dashboard-kpis";

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
  series?: SeriesPoint[];
  movesByDate?: Record<string, AccountMove[]>;
  monthlySubscriptionGbp?: number;
  activeSubscriptionCount?: number;
}

function computeNetWorthFromValuations(
  valuations: ValuationRow[],
  accountById: Map<string, AccountRow>,
  hideDebt: boolean
): number | null {
  if (valuations.length === 0) return null;
  let total = 0;
  let counted = false;
  for (const v of valuations) {
    const acc = accountById.get(v.accountId);
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
  series = [],
  movesByDate = {},
  monthlySubscriptionGbp = 0,
  activeSubscriptionCount = 0,
}: DashboardClientProps) {
  const { timeframe, setTimeframe, hideDebt, setHideDebt } = useDashboardPrefs();
  const [events, setEvents] = useState<NotableEvent[]>(initialEvents);
  const [weightReadings, setWeightReadings] = useState<WeightReading[]>(initialWeightReadings);

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );

  const hasDebt = useMemo(
    () => hasOutstandingDebt(accounts, latestValuations),
    [accounts, latestValuations]
  );

  const sortedSnapshots = useMemo(
    () =>
      [...initialSnapshots].sort(
        (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime()
      ),
    [initialSnapshots]
  );

  const latestSnapshot = sortedSnapshots[0] ?? null;
  const previousSnapshot = sortedSnapshots[1] ?? null;
  const lastCheckinAt =
    sortedSnapshots.find((snapshot) => !snapshot.isPartial)?.takenAt ?? null;
  const dueLabel = useCheckinDueLabel(lastCheckinAt);

  const fromValuations = computeNetWorthFromValuations(
    latestValuations,
    accountById,
    hideDebt
  );
  const prevFromValuations = computeNetWorthFromValuations(
    previousValuations,
    accountById,
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

  const visibleLatestValuations = useMemo(
    () =>
      hideDebt
        ? latestValuations.filter(
            (valuation) => accountById.get(valuation.accountId)?.type !== "LIABILITY"
          )
        : latestValuations,
    [hideDebt, latestValuations, accountById]
  );

  const visiblePreviousValuations = useMemo(
    () =>
      hideDebt
        ? previousValuations.filter(
            (valuation) => accountById.get(valuation.accountId)?.type !== "LIABILITY"
          )
        : previousValuations,
    [hideDebt, previousValuations, accountById]
  );

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
      <Card padding="hero">
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
                onToggle={() => setHideDebt((value) => !value)}
                compact
              />
              <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            </div>
            <Link
              href="/checkin"
              className="inline-flex flex-wrap items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg-base transition-colors hover:bg-accent-hover"
            >
              Monthly check-in
              {dueLabel && (
                <span className="rounded-full bg-black/15 px-2 py-0.5 text-[11px] font-medium">
                  {dueLabel}
                </span>
              )}
            </Link>
          </div>
        </div>
        <div className="mt-6">
          <KpiStrip
            points={series}
            timeframe={timeframe}
            hideDebt={hideDebt}
            monthlySubscriptionGbp={monthlySubscriptionGbp}
            activeSubscriptionCount={activeSubscriptionCount}
          />
        </div>
        <div className="mt-8">
          <NetWorthChart
            snapshots={chartSnapshots}
            timeframe={timeframe}
            loading={false}
            events={events}
            weightReadings={weightReadings}
            movesByDate={movesByDate}
            hideDebt={hideDebt}
            variant="hero"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="flex flex-col">
          <h2 className="mb-5 font-display text-xl font-medium text-text">Asset mix</h2>
          <CategoryBreakdownBar accounts={accountSummaries} />
        </Card>

        <Card className="flex flex-col">
          <h2 className="mb-5 font-display text-xl font-medium text-text">Life events</h2>
          <NotableEventsManager events={events} onEventsChange={setEvents} />
        </Card>

        <Card className="flex flex-col">
          <h2 className="mb-5 font-display text-xl font-medium text-text">Weight</h2>
          <WeightManager readings={weightReadings} onReadingsChange={setWeightReadings} />
        </Card>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 sm:px-6">
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-xl font-medium text-text">Accounts</h2>
            <span className="text-xs text-muted">Top 5</span>
          </div>
          <Link href="/assets" className="text-sm text-accent hover:text-accent-hover">
            View all →
          </Link>
        </div>
        <AssetsTable
          valuations={visibleLatestValuations}
          accounts={visibleAccounts}
          previousValuations={visiblePreviousValuations}
          limit={5}
        />
      </Card>

      <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-placeholder">
        <Lock size={11} />
        Stored on your nwTracker server
      </p>
    </div>
  );
}
