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

  // Student loan GBP per snapshot — used to derive liquid net worth on the client
  const studentLoanIds = allAccounts
    .filter((a) => a.category === "STUDENT_LOAN")
    .map((a) => a.id);
  const studentLoanBySnapshot: Record<string, number> = {};
  if (studentLoanIds.length > 0) {
    const loanVals = db
      .select({
        snapshotId: accountValuations.snapshotId,
        valueGbp: accountValuations.valueGbp,
      })
      .from(accountValuations)
      .where(inArray(accountValuations.accountId, studentLoanIds))
      .all();
    for (const v of loanVals) {
      studentLoanBySnapshot[v.snapshotId] =
        (studentLoanBySnapshot[v.snapshotId] ?? 0) + v.valueGbp;
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
      studentLoanBySnapshot={studentLoanBySnapshot}
      initialEvents={initialEvents}
      initialWeightReadings={initialWeightReadings}
    />
  );
}
