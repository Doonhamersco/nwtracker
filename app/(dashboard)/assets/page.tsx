import { listAccounts } from "@/lib/services/accounts"
import { getSnapshotHistory, getSnapshotById } from "@/lib/services/checkin"
import { AssetsClient, type AccountWithHistory } from "./AssetsClient"

export default async function AssetsPage() {
  const accounts = listAccounts(false)

  // Fetch the last 4 snapshots to compute current, MoM and 3M change
  const snapshots = getSnapshotHistory(4)
  const snapshotDetails = snapshots
    .map((s) => getSnapshotById(s.id))
    .filter(Boolean) as NonNullable<ReturnType<typeof getSnapshotById>>[]

  // Build valuation maps: snapshotIndex → accountId → valueGbp
  // Index 0 = most recent, 1 = previous month, 3 = ~3 months ago
  const valuationsBySnapshot = snapshotDetails.map((detail) => {
    const map: Record<string, { native: number; gbp: number }> = {}
    for (const v of detail.valuations) {
      map[v.accountId] = { native: v.valueNative, gbp: v.valueGbp }
    }
    return map
  })

  const lastSnapshotDate = snapshots[0]?.takenAt ?? null

  const accountsWithHistory: AccountWithHistory[] = accounts.map((acc) => {
    const current = valuationsBySnapshot[0]?.[acc.id] ?? null
    const prev1 = valuationsBySnapshot[1]?.[acc.id] ?? null
    const prev3 = valuationsBySnapshot[3]?.[acc.id] ?? null

    return {
      id: acc.id,
      name: acc.name,
      type: acc.type as "ASSET" | "LIABILITY",
      category: acc.category,
      currencyCode: acc.currencyCode,
      institution: acc.institution ?? null,
      currentNative: current?.native ?? null,
      currentGbp: current?.gbp ?? null,
      momChange: current && prev1 ? current.gbp - prev1.gbp : null,
      threeMonthChange: current && prev3 ? current.gbp - prev3.gbp : null,
    }
  })

  return (
    <AssetsClient
      accounts={accountsWithHistory}
      lastSnapshotDate={lastSnapshotDate}
    />
  )
}
