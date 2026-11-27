import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { accounts, snapshots } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getSnapshotById } from "@/lib/services/checkin";
import { formatSnapshotDayLabel, findLatestCommittedSnapshot } from "@/lib/engine/net-worth";
import { totalPhysicalAssetsGbp } from "@/lib/services/physical-assets";
import { snapshotViewFromQuery, type SnapshotAccountType } from "@/lib/snapshots/display";
import { SnapshotDetail } from "@/components/snapshots/SnapshotDetail";

export const metadata = {
  title: "Snapshot — nwTracker",
};

export default async function SnapshotPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string | string[]; assets?: string | string[] }>;
}) {
  const { id } = await params;
  const query = snapshotViewFromQuery(await searchParams);
  const data = getSnapshotById(id);
  if (!data) notFound();

  const accountRows = db.select().from(accounts).all();
  const byId = new Map(accountRows.map((account) => [account.id, account]));
  const history = db
    .select({
      id: snapshots.id,
      takenAt: snapshots.takenAt,
      netWorthGbp: snapshots.netWorthGbp,
      isPartial: snapshots.isPartial,
      physicalAssetsGbp: snapshots.physicalAssetsGbp,
    })
    .from(snapshots)
    .orderBy(desc(snapshots.takenAt))
    .all();
  const latest = findLatestCommittedSnapshot(history);

  const accountLines = data.valuations.flatMap((valuation) => {
    const account = byId.get(valuation.accountId);
    if (!account) return [];
    return [
      {
        id: valuation.id,
        name: account.name,
        category: account.category,
        type: account.type as SnapshotAccountType,
        valueGbp: valuation.valueGbp,
        carriedForward: valuation.isCarriedForward,
        netDepositGbp: valuation.netDepositGbp,
      },
    ];
  });

  return (
    <SnapshotDetail
      dateLabel={formatSnapshotDayLabel(data.snapshot.takenAt)}
      notes={data.snapshot.notes?.trim() ?? ""}
      isPartial={data.snapshot.isPartial}
      snapshot={data.snapshot}
      accounts={accountLines}
      isLatestCommitted={latest?.id === data.snapshot.id}
      currentPhysicalAssetsGbp={totalPhysicalAssetsGbp()}
      mode={query.hideDebt === null ? null : query.hideDebt ? "liquid" : "total"}
      assets={query.hideAssets === null ? null : query.hideAssets ? "hidden" : "shown"}
    />
  );
}
