"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "@/components/ui/Card"
import { useAccentColor } from "@/components/layout/ProfileProvider"
import { paletteFromAccent } from "@/lib/profile-theme"
import { formatMonthLabel } from "@/lib/spending/dates"
import { formatGbp } from "@/lib/spending/money"
import type { CategorySpend, MonthTrend } from "@/lib/spending/types"

const SLICE_COLORS = [
  "#c5a059",
  "#d47a6a",
  "#8a9bb0",
  "#7d9a78",
  "#e0c992",
  "#a67c6d",
  "#6e8b9a",
  "#b8954a",
  "#9c8a62",
  "#c4b49a",
]

export function categoryColor(index: number): string {
  return SLICE_COLORS[index % SLICE_COLORS.length]
}

export function SpendingCharts({
  byCategory,
  trend,
}: {
  byCategory: CategorySpend[]
  trend: MonthTrend[]
}) {
  const accent = useAccentColor()
  const palette = paletteFromAccent(accent)
  const tooltipStyle = {
    backgroundColor: palette.bgCard,
    border: `1px solid ${palette.border}`,
    borderRadius: 8,
    color: "#f7f1e6",
    fontSize: 12,
  }
  const axis = { fill: palette.muted, fontSize: 11 }
  const slices = byCategory
    .filter((row) => row.spend > 0)
    .map((row, index) => ({
      ...row,
      fill: categoryColor(index),
    }))
  const trendData = trend.map((row) => ({
    ...row,
    label: formatMonthLabel(row.month).replace(" ", "\n"),
    short: formatMonthLabel(row.month).split(" ")[0]?.slice(0, 3) ?? row.month,
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="font-display text-lg text-text">Spend by category</h2>
        {slices.length === 0 ? (
          <p className="mt-6 text-sm text-muted">No spending this month.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-52 w-full sm:w-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="spend"
                    nameKey="category"
                    innerRadius={52}
                    outerRadius={78}
                    stroke="none"
                    paddingAngle={1.5}
                  >
                    {slices.map((slice) => (
                      <Cell key={slice.category} fill={slice.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => formatGbp(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-0 flex-1 space-y-2">
              {slices.map((slice) => (
                <li key={slice.category} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-muted">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.fill }}
                    />
                    <span className="truncate">{slice.category}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-text">
                    {formatGbp(slice.spend)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-lg text-text">Month on month</h2>
        <p className="mt-1 text-xs text-muted">Accent bars are this month. Pale bars are last month.</p>
        {byCategory.length === 0 ? (
          <p className="mt-6 text-sm text-muted">Nothing to compare yet.</p>
        ) : (
          <div className="mt-2" style={{ height: Math.max(260, byCategory.length * 32) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byCategory.filter((row) => row.spend > 0 || row.previousSpend > 0)}
                layout="vertical"
                margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
              >
                <CartesianGrid stroke={palette.border} horizontal={false} />
                <XAxis type="number" tick={axis} tickFormatter={(value) => formatGbp(Number(value), 0)} />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={128}
                  tick={axis}
                  tickFormatter={(value) =>
                    String(value).length > 18 ? `${String(value).slice(0, 17)}…` : String(value)
                  }
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [
                    formatGbp(Number(value)),
                    name === "spend" ? "This month" : "Last month",
                  ]}
                />
                <Bar dataKey="previousSpend" fill={palette.borderStrong} radius={[0, 4, 4, 0]} />
                <Bar dataKey="spend" fill={accent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="lg:col-span-2">
        <h2 className="font-display text-lg text-text">Trend</h2>
        {trendData.length === 0 ? (
          <p className="mt-6 text-sm text-muted">Import a statement to see a trend.</p>
        ) : (
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke={palette.border} vertical={false} />
                <XAxis dataKey="short" tick={axis} />
                <YAxis tick={axis} tickFormatter={(value) => formatGbp(Number(value), 0)} width={56} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [
                    formatGbp(Number(value)),
                    name === "spend" ? "Spend" : "Income",
                  ]}
                  labelFormatter={(_, payload) => {
                    const month = payload?.[0]?.payload?.month as string | undefined
                    return month ? formatMonthLabel(month) : ""
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="spend"
                  stroke="#d47a6a"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#d47a6a", strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke={accent}
                  strokeWidth={2}
                  dot={{ r: 4, fill: accent, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  )
}
