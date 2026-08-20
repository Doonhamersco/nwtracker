"use client"

import { Card } from "@/components/ui/Card"
import { Sparkline } from "./Sparkline"

interface MetricCardProps {
  name: string
  unit: string
  currentValue: number | null
  previousValue: number | null
  history: number[]
  color: string
  isHevyMetric?: boolean
}

function formatValue(value: number, unit: string): string {
  if (unit === "GBP" || unit === "£") {
    return "£" + value.toLocaleString("en-GB", { maximumFractionDigits: 0 })
  }
  if (unit === "%") {
    return value.toFixed(1) + "%"
  }
  if (unit === "kg") {
    return value.toFixed(1) + " kg"
  }
  return value.toLocaleString("en-GB", { maximumFractionDigits: 1 }) + (unit ? " " + unit : "")
}

export function MetricCard({
  name,
  unit,
  currentValue,
  previousValue,
  history,
  color,
  isHevyMetric = false,
}: MetricCardProps) {
  const change =
    currentValue !== null && previousValue !== null
      ? currentValue - previousValue
      : null
  const changePercent =
    change !== null && previousValue !== null && previousValue !== 0
      ? (change / Math.abs(previousValue)) * 100
      : null

  const isPositive = change !== null && change >= 0

  return (
    <Card>
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            {name}
          </span>
          {isHevyMetric && (
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
              Hevy
            </span>
          )}
        </div>

        {/* Value */}
        <div className="flex flex-col gap-1">
          {currentValue !== null ? (
            <span className="text-2xl font-bold text-text">
              {formatValue(currentValue, unit)}
            </span>
          ) : (
            <span className="text-2xl font-bold text-muted">—</span>
          )}

          {/* Change indicator */}
          {change !== null ? (
            <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? "text-positive" : "text-negative"}`}>
              <span>{isPositive ? "▲" : "▼"}</span>
              <span>
                {formatValue(Math.abs(change), unit)}
                {changePercent !== null && (
                  <span className="ml-1 opacity-70">
                    ({changePercent >= 0 ? "+" : ""}{changePercent.toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>
          ) : currentValue !== null ? (
            <span className="text-xs text-muted">No previous data</span>
          ) : null}
        </div>

        {/* Sparkline */}
        <div className="h-12">
          <Sparkline
            data={history.length > 0 ? history : [0]}
            color={color}
          />
        </div>
      </div>
    </Card>
  )
}
