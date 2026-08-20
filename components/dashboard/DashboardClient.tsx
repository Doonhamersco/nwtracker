"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { TimeframeSelector, type Timeframe } from "@/components/dashboard/TimeframeSelector";
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
  studentLoanBySnapshot: Record<string, number>;
  initialEvents: NotableEvent[];
  initialWeightReadings: WeightReading[];
}

function computeNetWorthFromValuations(
  valuations: ValuationRow[],
  accounts: AccountRow[],
  hideStudentLoan: boolean
): number | null {
  if (valuations.length === 0) return null;
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  let total = 0;
  let counted = false;
  for (const v of valuations) {
    const acc = accountMap.get(v.accountId);
    if (!acc) continue;
    if (hideStudentLoan && acc.category === "STUDENT_LOAN") continue;
    counted = true;
    total += acc.type === "ASSET" ? v.valueGbp : -v.valueGbp;
  }
  return counted ? total : null;
}

export function DashboardClient({
  initialSnapshots,
  latestValuations,
  previousValuations,
  accounts,
  studentLoanBySnapshot,
  initialEvents,
  initialWeightReadings,
}: DashboardClientProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1Y");
  const [events, setEvents] = useState<NotableEvent[]>(initialEvents);
  const [weightReadings, setWeightReadings] = useState<WeightReading[]>(initialWeightReadings);
  const [hideStudentLoan, setHideStudentLoan] = useState(false);

  const hasStudentLoan = accounts.some((a) => a.category === "STUDENT_LOAN");

  const sortedSnapshots = [...initialSnapshots].sort(
    (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime()
  );

  const latestSnapshot = sortedSnapshots[0] ?? null;
  const previousSnapshot = sortedSnapshots[1] ?? null;

  const fromValuations = computeNetWorthFromValuations(
    latestValuations,
    accounts,
    hideStudentLoan
  );
  const prevFromValuations = computeNetWorthFromValuations(
    previousValuations,
    accounts,
    hideStudentLoan
  );

  // Prefer recomputed valuations (supports liquid toggle); fall back to stored snapshot totals
  const heroNetWorth =
    fromValuations ??
    (latestSnapshot?.netWorthGbp !== null && latestSnapshot?.netWorthGbp !== undefined
      ? latestSnapshot.netWorthGbp +
        (hideStudentLoan ? (studentLoanBySnapshot[latestSnapshot.id] ?? 0) : 0)
      : null);

  const heroPrevious =
    prevFromValuations ??
    (previousSnapshot?.netWorthGbp !== null && previousSnapshot?.netWorthGbp !== undefined
      ? previousSnapshot.netWorthGbp +
        (hideStudentLoan ? (studentLoanBySnapshot[previousSnapshot.id] ?? 0) : 0)
      : null);

  const chartSnapshots = hideStudentLoan
    ? initialSnapshots.map((s) => ({
        ...s,
        netWorthGbp:
          s.netWorthGbp !== null
            ? s.netWorthGbp + (studentLoanBySnapshot[s.id] ?? 0)
            : null,
      }))
    : initialSnapshots;

  const visibleAccounts = hideStudentLoan
    ? accounts.filter((a) => a.category !== "STUDENT_LOAN")
    : accounts;

  const visibleLatestValuations = hideStudentLoan
    ? latestValuations.filter((v) => {
        const acc = accounts.find((a) => a.id === v.accountId);
        return acc?.category !== "STUDENT_LOAN";
      })
    : latestValuations;

  const visiblePreviousValuations = hideStudentLoan
    ? previousValuations.filter((v) => {
        const acc = accounts.find((a) => a.id === v.accountId);
        return acc?.category !== "STUDENT_LOAN";
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
    <div className="mx-auto max-w-7xl space-y-6">
        {/* Title row */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#F1F5F9]">Net Worth</h1>
            {latestSnapshot && (
              <p className="text-sm text-[#94A3B8] mt-0.5">
                Last snapshot:{" "}
                {new Date(latestSnapshot.takenAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {hasStudentLoan && (
              <button
                type="button"
                onClick={() => setHideStudentLoan((v) => !v)}
                aria-pressed={hideStudentLoan}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap ${
                  hideStudentLoan
                    ? "bg-[#22c55e]/15 border-[#22c55e]/80 text-[#22c55e]"
                    : "bg-transparent border-[#333333] text-[#94A3B8] hover:border-[#555555] hover:text-[#F1F5F9]"
                }`}
              >
                {hideStudentLoan ? "Liquid (loan hidden)" : "Hide student loan"}
              </button>
            )}
            <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            <Link
              href="/checkin"
              className="w-full sm:w-auto text-center bg-[#22c55e] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#16a34a] transition-colors whitespace-nowrap"
            >
              Monthly Check-in
            </Link>
          </div>
        </div>

        {/* Hero total */}
        <Card>
          <HeroTotal
            netWorthGbp={heroNetWorth}
            previousGbp={heroPrevious}
            loading={false}
            label={hideStudentLoan ? "Liquid Net Worth" : "Net Worth"}
          />
        </Card>

        {/* Net worth chart */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wide mb-4">
            History
          </h2>
          <NetWorthChart
            snapshots={chartSnapshots}
            timeframe={timeframe}
            loading={false}
            events={events}
            weightReadings={weightReadings}
          />
        </Card>

        {/* Middle row: category breakdown + notable events + weight */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wide mb-4">
              Asset Breakdown
            </h2>
            <CategoryBreakdownBar accounts={accountSummaries} />
          </Card>

          {/* Notable events */}
          <Card>
            <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wide mb-4">
              Notable Events
            </h2>
            <NotableEventsManager events={events} onEventsChange={setEvents} />
          </Card>

          {/* Weight log */}
          <Card>
            <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wide mb-4">
              Weight Log
            </h2>
            <WeightManager readings={weightReadings} onReadingsChange={setWeightReadings} />
          </Card>
        </div>

        {/* Summary stats */}
        <Card>
          <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wide mb-4">
            Summary
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: "Total Assets",
                value: accountSummaries
                  .filter((a) => a.accountType === "ASSET")
                  .reduce((sum, a) => sum + a.valueGbp, 0),
                positive: true,
              },
              {
                label: "Total Liabilities",
                value: accountSummaries
                  .filter((a) => a.accountType === "LIABILITY")
                  .reduce((sum, a) => sum + a.valueGbp, 0),
                positive: false,
              },
              {
                label: "Snapshots",
                value: initialSnapshots.length,
                isCount: true,
              },
              {
                label: "Accounts",
                value: visibleAccounts.length,
                isCount: true,
              },
            ].map(({ label, value, positive, isCount }) => (
              <div key={label} className="bg-[#0a0a0a] rounded-xl p-3">
                <p className="text-xs text-[#94A3B8] mb-1">{label}</p>
                <p
                  className={`text-lg font-bold font-mono ${
                    isCount
                      ? "text-[#F1F5F9]"
                      : positive
                        ? "text-[#22C55E]"
                        : "text-[#EF4444]"
                  }`}
                >
                  {isCount
                    ? value
                    : `£${(value as number).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Assets table */}
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-[#222222]">
            <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wide">
              Accounts
            </h2>
          </div>
          <AssetsTable
            valuations={visibleLatestValuations}
            accounts={visibleAccounts}
            previousValuations={visiblePreviousValuations}
          />
        </Card>
    </div>
  );
}
