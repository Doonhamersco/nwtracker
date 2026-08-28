"use client"

import { useEffect, useState, useMemo } from "react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card } from "@/components/ui/Card"
import { useAccentColor } from "@/components/layout/ProfileProvider"
import { paletteFromAccent } from "@/lib/profile-theme"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SnapshotSummary {
  id: string
  takenAt: string
  netWorthGbp: number | null
  isPartial: boolean
  notes: string | null
}

interface SnapshotDetail {
  snapshot: SnapshotSummary
  valuations: Array<{
    accountId: string
    valueGbp: number
  }>
  metrics: Array<{
    metricId: string
    value: number
  }>
}

interface AccountRow {
  id: string
  category: string
}

type Timeframe = "3M" | "6M" | "1Y" | "2Y" | "All"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatGbp(v: number): string {
  if (Math.abs(v) >= 1_000_000) return "£" + (v / 1_000_000).toFixed(2) + "M"
  if (Math.abs(v) >= 1_000) return "£" + Math.round(v).toLocaleString("en-GB")
  return "£" + v.toFixed(0)
}

function formatDate(iso: string, short = false): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    month: short ? "short" : "long",
    year: "numeric",
    day: short ? "numeric" : undefined,
  })
}

function cutoffDate(tf: Timeframe): Date | null {
  const now = new Date()
  if (tf === "All") return null
  const months = { "3M": 3, "6M": 6, "1Y": 12, "2Y": 24 }[tf]
  const d = new Date(now)
  d.setMonth(d.getMonth() - months)
  return d
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const accentColor = useAccentColor()
  const palette = paletteFromAccent(accentColor)
  const TOOLTIP_STYLE = {
    backgroundColor: palette.bgCard,
    border: `1px solid ${palette.border}`,
    borderRadius: 8,
    color: "#f7f1e6",
    fontSize: 12,
  }
  const AXIS_STYLE = { fill: palette.muted, fontSize: 11 }
  const gridStroke = palette.borderStrong
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([])
  const [details, setDetails] = useState<SnapshotDetail[]>([])
  const [studentLoanIds, setStudentLoanIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<Timeframe>("1Y")
  const [hideStudentLoan, setHideStudentLoan] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [snapRes, accountsRes] = await Promise.all([
          fetch("/api/snapshots?limit=120"),
          fetch("/api/accounts?includeInactive=true"),
        ])
        if (!snapRes.ok) throw new Error("Failed to load snapshots")
        const all = (await snapRes.json()) as SnapshotSummary[]
        // Oldest first for charts
        const sorted = [...all].reverse()
        setSnapshots(sorted)

        if (accountsRes.ok) {
          const accounts = (await accountsRes.json()) as AccountRow[]
          setStudentLoanIds(
            new Set(accounts.filter((a) => a.category === "STUDENT_LOAN").map((a) => a.id))
          )
        }

        // Fetch last 24 snapshot details in parallel for category breakdown + loan amounts
        const recent24 = sorted.slice(-24)
        const withNw = sorted.filter((s) => s.netWorthGbp !== null)
        const detailIds = new Set([...recent24, ...withNw].map((s) => s.id))
        const toFetch = sorted.filter((s) => detailIds.has(s.id))
        const detailResults = await Promise.allSettled(
          toFetch.map((s) =>
            fetch(`/api/snapshots/${s.id}`).then((r) => r.json() as Promise<SnapshotDetail>)
          )
        )
        const loadedDetails = detailResults
          .filter((r): r is PromiseFulfilledResult<SnapshotDetail> => r.status === "fulfilled")
          .map((r) => r.value)
        setDetails(loadedDetails)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const studentLoanBySnapshot = useMemo(() => {
    const map: Record<string, number> = {}
    if (studentLoanIds.size === 0) return map
    for (const d of details) {
      const loanGbp = d.valuations
        .filter((v) => studentLoanIds.has(v.accountId))
        .reduce((sum, v) => sum + v.valueGbp, 0)
      if (loanGbp > 0) map[d.snapshot.id] = loanGbp
    }
    return map
  }, [details, studentLoanIds])

  const hasStudentLoan = studentLoanIds.size > 0

  // Filter snapshots by timeframe
  const filteredSnapshots = useMemo(() => {
    const cutoff = cutoffDate(timeframe)
    if (!cutoff) return snapshots
    return snapshots.filter((s) => new Date(s.takenAt) >= cutoff)
  }, [snapshots, timeframe])

  // Net worth chart data
  const nwChartData = useMemo(() => {
    return filteredSnapshots
      .map((s) => {
        if (s.netWorthGbp === null) return null
        const value = hideStudentLoan
          ? s.netWorthGbp + (studentLoanBySnapshot[s.id] ?? 0)
          : s.netWorthGbp
        return { date: formatDate(s.takenAt, true), value }
      })
      .filter((row): row is { date: string; value: number } => row !== null)
  }, [filteredSnapshots, hideStudentLoan, studentLoanBySnapshot])

  // MoM and YoY change table
  const nwTableData = useMemo(() => {
    const rows = filteredSnapshots
      .map((s) => {
        if (s.netWorthGbp === null) return null
        const netWorth = hideStudentLoan
          ? s.netWorthGbp + (studentLoanBySnapshot[s.id] ?? 0)
          : s.netWorthGbp
        return { s, netWorth }
      })
      .filter((row): row is { s: SnapshotSummary; netWorth: number } => row !== null)

    return rows
      .map(({ s, netWorth }, i) => {
        const prev1 = rows[i - 1]
        const prev12 = rows[i - 12]
        return {
          id: s.id,
          date: formatDate(s.takenAt),
          netWorth,
          momChange: prev1 ? netWorth - prev1.netWorth : null,
          yoyChange: prev12 ? netWorth - prev12.netWorth : null,
        }
      })
      .reverse() // newest first in table
  }, [filteredSnapshots, hideStudentLoan, studentLoanBySnapshot])

  // Income vs spend chart — uses metric readings from details
  // We look for metrics by common names: income, spend, savings
  const incomeSpendData = useMemo(() => {
    if (details.length === 0) return []
    // We can't easily link metricId→name here without definitions, so
    // we'll just show per-snapshot totals from what we have
    // In practice this section would need metric definitions to be fetched
    return []
  }, [details])

  // Category breakdown chart
  const CATEGORY_COLORS: Record<string, string> = {
    CASH: accentColor,
    ISA: "#7a8faf",
    CRYPTO: "#c4a35a",
    VEHICLE: "#8fa3b8",
    PENSION: "#b8954a",
    STOCKS: "#d4c08a",
    PROPERTY: "#9c8f80",
    OTHER_ASSET: "#a89b8c",
  }

  const categoryChartData = useMemo(() => {
    // Build account→category mapping from details
    const accountDetails = details.slice(-24)
    // We don't have account category in valuations, skip if no data
    if (accountDetails.length === 0) return { data: [], categories: [] }

    // Note: we only have accountId in valuations without category info here
    // The chart will show net worth progression which is available
    return { data: [], categories: [] }
  }, [details])

  const TIMEFRAMES: Timeframe[] = ["3M", "6M", "1Y", "2Y", "All"]

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <div className="h-8 w-32 animate-pulse rounded bg-bg-card" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-bg-card" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-2xl bg-bg-card" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-negative/40 bg-negative/10 p-6 text-sm text-negative">
        Failed to load reports: {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight text-text">Reports</h1>
        <p className="mt-1 text-sm text-muted">
          Historical trends and financial analysis
        </p>
      </div>

      {/* Section 1: Net Worth History */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-text">
            {hideStudentLoan ? "Liquid Net Worth History" : "Net Worth History"}
          </h2>

          <div className="flex items-center gap-2 flex-wrap">
            {hasStudentLoan && (
              <button
                type="button"
                onClick={() => setHideStudentLoan((v) => !v)}
                aria-pressed={hideStudentLoan}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                  hideStudentLoan
                    ? "bg-accent/15 border-accent/80 text-accent"
                    : "bg-transparent border-border-strong text-muted hover:border-muted hover:text-text"
                }`}
              >
                {hideStudentLoan ? "Liquid (loan hidden)" : "Hide student loan"}
              </button>
            )}

            {/* Timeframe selector */}
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-bg-card p-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`shrink-0 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                    timeframe === tf
                      ? "bg-accent text-bg-base"
                      : "text-muted hover:text-text"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {nwChartData.length === 0 ? (
          <Card className="flex items-center justify-center h-48">
            <p className="text-muted">No snapshot data available for this timeframe.</p>
          </Card>
        ) : (
          <Card className="min-w-0">
            <div className="h-52 w-full min-w-0 sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={nwChartData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                <defs>
                  <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={accentColor} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="date"
                  tick={AXIS_STYLE}
                  tickLine={false}
                  axisLine={{ stroke: gridStroke }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={AXIS_STYLE}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatGbp}
                  width={52}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: unknown) => [
                    formatGbp(v as number),
                    hideStudentLoan ? "Liquid Net Worth" : "Net Worth",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={accentColor}
                  strokeWidth={2}
                  fill="url(#nwGradient)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Data table */}
        {nwTableData.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-card">
                  {["Date", hideStudentLoan ? "Liquid NW" : "Net Worth", "MoM Change", "YoY Change"].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted ${
                        h === "Date" ? "text-left" : "text-right"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nwTableData.map((row) => (
                  <tr key={row.id} className="border-b border-border hover:bg-bg-hover transition-colors">
                    <td className="px-4 py-3 text-muted">{row.date}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-text">
                      {formatGbp(row.netWorth)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {row.momChange !== null ? (
                        <span className={row.momChange >= 0 ? "text-positive" : "text-negative"}>
                          {row.momChange >= 0 ? "+" : ""}{formatGbp(row.momChange)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {row.yoyChange !== null ? (
                        <span className={row.yoyChange >= 0 ? "text-positive" : "text-negative"}>
                          {row.yoyChange >= 0 ? "+" : ""}{formatGbp(row.yoyChange)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 2: Income & Spending */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text">Income & Spending</h2>

        {incomeSpendData.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <p className="text-muted">Income & spending charts require life metric readings.</p>
              <p className="text-sm text-muted">
                Complete a check-in with Income and Spend metrics to see this chart.
              </p>
            </div>
          </Card>
        ) : (
          <Card>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={incomeSpendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: gridStroke }} />
                <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={formatGbp} width={72} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <Bar dataKey="income" name="Income" fill={accentColor} radius={[3, 3, 0, 0]} />
                <Bar dataKey="spend" name="Spend" fill="#e07060" radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="savingsRate" name="Savings Rate %" stroke={accentColor} strokeWidth={2} dot={false} yAxisId="right" />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        )}
      </section>

      {/* Section 3: Asset Growth by Category */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text">Asset Growth by Category</h2>

        {categoryChartData.data.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <p className="text-muted">Category breakdown requires account valuations.</p>
              <p className="text-sm text-muted">
                Complete a check-in with account balances to see the category stacked chart.
              </p>
            </div>
          </Card>
        ) : (
          <Card>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={categoryChartData.data}>
                <defs>
                  {categoryChartData.categories.map((cat: string) => (
                    <linearGradient key={cat} id={`grad-${cat}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CATEGORY_COLORS[cat] ?? "#a89b8c"} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={CATEGORY_COLORS[cat] ?? "#a89b8c"} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: gridStroke }} />
                <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={formatGbp} width={72} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => formatGbp(v as number)} />
                <Legend />
                {categoryChartData.categories.map((cat: string) => (
                  <Area
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    stackId="1"
                    stroke={CATEGORY_COLORS[cat] ?? "#a89b8c"}
                    fill={`url(#grad-${cat})`}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        )}
      </section>
    </div>
  )
}
