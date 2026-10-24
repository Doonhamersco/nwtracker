import { notFound } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { PreviewFrame } from "@/app/preview/PreviewFrame";
import { buildDashboardSeries } from "@/lib/dashboard-kpis";
import { previewTrainingConnected } from "@/lib/strava/preview";
import { fitnessSummaryLine } from "@/lib/training/summary";

export const dynamic = "force-dynamic";

const accounts = [
  { id: "isa", name: "Stocks & shares ISA", type: "ASSET" as const, category: "ISA", currencyCode: "GBP" },
  { id: "sipp", name: "SIPP", type: "ASSET" as const, category: "PENSION", currencyCode: "GBP" },
  { id: "cash", name: "Current account", type: "ASSET" as const, category: "CASH", currencyCode: "GBP" },
];

function valuation(id: string, accountId: string, value: number) {
  return {
    id,
    accountId,
    valueNative: value,
    valueGbp: value,
    isCarriedForward: false,
    createdAt: "2026-10-01T09:00:00.000Z",
  };
}

export default function OverviewPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const snapshots = [
    { id: "s1", takenAt: "2026-05-01T09:00:00.000Z", netWorthGbp: 98000, isPartial: false, notes: null },
    { id: "s2", takenAt: "2026-06-01T09:00:00.000Z", netWorthGbp: 101000, isPartial: false, notes: null },
    { id: "s3", takenAt: "2026-07-01T09:00:00.000Z", netWorthGbp: 104500, isPartial: false, notes: null },
    { id: "s4", takenAt: "2026-08-01T09:00:00.000Z", netWorthGbp: 107200, isPartial: false, notes: null },
    { id: "s5", takenAt: "2026-09-01T09:00:00.000Z", netWorthGbp: 110400, isPartial: false, notes: null },
    { id: "s6", takenAt: "2026-10-01T09:00:00.000Z", netWorthGbp: 113800, isPartial: false, notes: null },
  ];

  const seriesInput = snapshots.flatMap((snapshot) => {
    const scale = snapshot.netWorthGbp / 113800;
    return [
      { snapshotId: snapshot.id, accountId: "isa", valueGbp: Math.round(42000 * scale) },
      { snapshotId: snapshot.id, accountId: "sipp", valueGbp: Math.round(61000 * scale) },
      { snapshotId: snapshot.id, accountId: "cash", valueGbp: Math.round(10800 * scale) },
    ];
  });
  const { points, movesByDate } = buildDashboardSeries({
    snapshots,
    valuations: seriesInput,
    accounts,
  });

  return (
    <PreviewFrame note="Sample data for layout review. Cardio and weight live on Fitness.">
      <DashboardClient
        initialSnapshots={snapshots}
        latestValuations={[
          valuation("v1", "isa", 42000),
          valuation("v2", "sipp", 61000),
          valuation("v3", "cash", 10800),
        ]}
        previousValuations={[
          valuation("p1", "isa", 40000),
          valuation("p2", "sipp", 59000),
          valuation("p3", "cash", 11400),
        ]}
        accounts={accounts}
        debtBySnapshot={{}}
        initialEvents={[
          { id: "e1", date: "2026-08-01", emoji: "🏠", label: "Moved house" },
        ]}
        initialWeightReadings={[
          { id: "wt-1", date: "2026-08-01", weightKg: 82.8, snapshotId: "s4" },
          { id: "wt-2", date: "2026-09-01", weightKg: 82.1, snapshotId: "s5" },
          { id: "wt-3", date: "2026-10-01", weightKg: 81.6, snapshotId: "s6" },
        ]}
        series={points}
        movesByDate={movesByDate}
        monthlySubscriptionGbp={86}
        activeSubscriptionCount={4}
        fitnessSummary={fitnessSummaryLine(previewTrainingConnected())}
      />
    </PreviewFrame>
  );
}
