import { getSpendingReport } from "@/lib/services/spending"
import { SpendingClient } from "@/components/spending/SpendingClient"

export default async function SpendingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>
}) {
  const params = await searchParams
  const raw = Array.isArray(params.month) ? params.month[0] : params.month
  const month = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : null
  const report = getSpendingReport(month)
  return <SpendingClient report={report} />
}
