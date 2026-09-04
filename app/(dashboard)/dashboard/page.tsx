import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, accountValuations } from "@/db/schema";
import {
  getSnapshotHistory,
  getSnapshotById,
  type SnapshotSummary,
} from "@/lib/services/checkin";
import { listEvents } from "@/lib/services/events";
import { listWeightReadings } from "@/lib/services/weight";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const metadata = {
  title: "Dashboard — nwTracker",
};

export default async function DashboardPage() {
  const snapshots: SnapshotSummary[] = getSnapshotHistory(120);

  // Only committed (non-partial) snapshots carry valuations and net worth
  const committedSnapshots = [...snapshots]
    .filter((s) => !s.isPartial)
    .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime());

  const latestSnapshot = committedSnapshots[0] ?? null;
  const previousSnapshot = committedSnapshots[1] ?? null;

  const latestDetail = latestSnapshot ? getSnapshotById(latestSnapshot.id) : null;
  const previousDetail = previousSnapshot ? getSnapshotById(previousSnapshot.id) : null;

  const allAccounts = db.select().from(accounts).all();

  const latestValuations = (latestDetail?.valuations ?? []).map((v) => ({
    id: v.id,
    accountId: v.accountId,
    valueNative: v.valueNative,
    valueGbp: v.valueGbp,
    isCarriedForward: v.isCarriedForward,
    createdAt: v.createdAt,
  }));

  const previousValuations = (previousDetail?.valuations ?? []).map((v) => ({
    id: v.id,
    accountId: v.accountId,
    valueNative: v.valueNative,
    valueGbp: v.valueGbp,
    isCarriedForward: v.isCarriedForward,
    createdAt: v.createdAt,
  }));

  const accountRows = allAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as "ASSET" | "LIABILITY",
    category: a.category,
    currencyCode: a.currencyCode,
  }));

  // Liability GBP per snapshot — used to derive liquid net worth when debt is hidden
  const liabilityIds = allAccounts
    .filter((a) => a.type === "LIABILITY")
    .map((a) => a.id);
  const debtBySnapshot: Record<string, number> = {};
  if (liabilityIds.length > 0) {
    const debtVals = db
      .select({
        snapshotId: accountValuations.snapshotId,
        valueGbp: accountValuations.valueGbp,
      })
      .from(accountValuations)
      .where(inArray(accountValuations.accountId, liabilityIds))
      .all();
    for (const v of debtVals) {
      debtBySnapshot[v.snapshotId] =
        (debtBySnapshot[v.snapshotId] ?? 0) + v.valueGbp;
    }
  }

  const initialEvents = listEvents().map((ev) => ({
    id: ev.id,
    date: ev.date,
    emoji: ev.emoji,
    label: ev.label,
  }));

  const initialWeightReadings = listWeightReadings();

  return (
    <DashboardClient
      initialSnapshots={snapshots}
      latestValuations={latestValuations}
      previousValuations={previousValuations}
      accounts={accountRows}
      debtBySnapshot={debtBySnapshot}
      initialEvents={initialEvents}
      initialWeightReadings={initialWeightReadings}
    />
  );
}
