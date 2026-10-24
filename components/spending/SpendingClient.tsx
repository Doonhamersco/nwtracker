"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { formatMonthLabel } from "@/lib/spending/dates"
import { formatGbp, formatPct } from "@/lib/spending/money"
import type { MerchantSpend, SpendingReport } from "@/lib/spending/types"
import { RecurringPanel } from "./RecurringPanel"
import { SpendingCharts } from "./SpendingCharts"
import { TransactionsTable } from "./TransactionsTable"

export function SpendingClient({
  report,
  basePath = "/spending",
}: {
  report: SpendingReport
  basePath?: string
}) {
  const router = useRouter()
  const [pendingMonth, setPendingMonth] = useState<string | null>(null)
  const selectedMonth =
    pendingMonth && pendingMonth !== report.month ? pendingMonth : report.month
  const spendDelta = report.previous
    ? report.totals.spend - report.previous.spend
    : null

  function refresh() {
    router.refresh()
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-text">
            Spending
          </h1>
          <p className="mt-1 text-sm text-muted">
            {formatMonthLabel(report.month)} · transfers excluded from spend
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted">
          Month
          <select
            aria-label="Statement month"
            value={selectedMonth}
            onChange={(event) => {
              const next = event.target.value
              setPendingMonth(next)
              router.push(`${basePath}?month=${encodeURIComponent(next)}`)
            }}
            className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm normal-case tracking-normal text-text focus:border-accent focus:outline-none"
          >
            {(report.months.includes(selectedMonth)
              ? report.months
              : [...report.months, selectedMonth].sort()
            ).map((value) => (
              <option key={value} value={value}>
                {formatMonthLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {report.transactions.length === 0 && report.trend.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No transactions yet. Import a statement with the curl command in the README,
            then come back here.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Stat
              label="Spend"
              value={formatGbp(report.totals.spend)}
              hint={
                spendDelta === null
                  ? "Excludes transfers"
                  : `vs ${formatMonthLabel(report.previous?.month ?? "")}`
              }
              tone={spendDelta !== null && spendDelta > 0 ? "negative" : "default"}
              badge={
                spendDelta === null ? (
                  <Badge variant="neutral">Transfers out</Badge>
                ) : (
                  <Badge variant={spendDelta > 0 ? "negative" : "positive"}>
                    {spendDelta > 0 ? "+" : ""}
                    {formatGbp(spendDelta)}
                  </Badge>
                )
              }
            />
            <Stat
              label="Income"
              value={formatGbp(report.totals.income)}
              hint="Excludes transfers in"
              tone="positive"
            />
            <Stat
              label="Savings rate"
              value={formatPct(report.totals.savingsRate)}
              hint={`${formatGbp(report.totals.savings)} left after spend`}
              tone={
                report.totals.savingsRate !== null && report.totals.savingsRate < 0
                  ? "negative"
                  : "positive"
              }
            />
          </div>

          <SpendingCharts byCategory={report.byCategory} trend={report.trend} />

          <Card>
            <h2 className="font-display text-xl font-medium text-text">Top merchants</h2>
            {report.topMerchants.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No merchant spend this month.</p>
            ) : (
              <MerchantList merchants={report.topMerchants} />
            )}
          </Card>

          <RecurringPanel
            recurring={report.recurring}
            duplicates={report.duplicateSubscriptions}
            onAdded={refresh}
          />

          <TransactionsTable
            transactions={report.transactions}
            categories={report.categories}
            onChanged={refresh}
          />
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  tone,
  badge,
}: {
  label: string
  value: string
  hint: string
  tone: "default" | "positive" | "negative"
  badge?: React.ReactNode
}) {
  const color =
    tone === "negative" ? "text-negative" : tone === "positive" ? "text-positive" : "text-text"
  return (
    <Card variant="inset" padding="compact" className="flex h-full min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
          {label}
        </span>
        {badge}
      </div>
      <p className={`font-mono text-2xl tabular-nums tracking-tight ${color}`}>{value}</p>
      <p className="text-xs text-muted">{hint}</p>
    </Card>
  )
}

function MerchantList({ merchants }: { merchants: MerchantSpend[] }) {
  const max = merchants[0]?.spend ?? 1
  return (
    <ul className="mt-4 space-y-3">
      {merchants.map((merchant) => (
        <li key={merchant.merchant}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-text">{merchant.merchant}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {formatGbp(merchant.spend)} · {merchant.count}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-hover">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(4, (merchant.spend / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
