import { listAccounts } from "@/lib/services/accounts"
import { getSnapshotHistory, getSnapshotById } from "@/lib/services/checkin"
import { accountMovement } from "@/lib/engine/account-movement"
import { AssetsClient, type AccountWithHistory } from "./AssetsClient"

function depositsSince(
  maps: Array<Record<string, { netDepositGbp: number | null }>>,
  accountId: string,
  count: number
): Array<number | null> | null {
  const deposits: Array<number | null> = []
  for (let index = 0; index < count; index += 1) {
    const row = maps[index]?.[accountId]
    if (!row) return null
    deposits.push(row.netDepositGbp)
  }
  return deposits
}

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
    const map: Record<string, { native: number; gbp: number; netDepositGbp: number | null }> = {}
    for (const v of detail.valuations) {
      map[v.accountId] = { native: v.valueNative, gbp: v.valueGbp, netDepositGbp: v.netDepositGbp }
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
      momChange: accountMovement(
        current?.gbp ?? 0,
        current && prev1 ? prev1.gbp : null,
        current?.netDepositGbp == null ? null : [current.netDepositGbp]
      ),
      threeMonthChange: accountMovement(
        current?.gbp ?? 0,
        current && prev3 ? prev3.gbp : null,
        depositsSince(valuationsBySnapshot, acc.id, 3)
      ),
    }
  })

  return (
    <AssetsClient
      accounts={accountsWithHistory}
      lastSnapshotDate={lastSnapshotDate}
    />
  )
}
