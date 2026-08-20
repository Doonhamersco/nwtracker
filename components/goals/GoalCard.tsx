"use client"

import { Card } from "@/components/ui/Card"

interface GoalProgress {
  currentValue: number
  baselineValue: number | null
  targetValue: number
  progressPercent: number | null
  isOnTrack: boolean | null
  projectedCompletionDate: string | null
  status: "on_track" | "at_risk" | "achieved" | "no_data"
}

interface GoalRow {
  id: string
  name: string
  description: string | null
  targetValue: number
  targetDate: string
  metricType: "NET_WORTH" | "LIFE_METRIC" | "ACCOUNT_CATEGORY"
  linkedMetricId: string | null
  linkedCategory: string | null
  baselineValue: number | null
  baselineDate: string | null
  isActive: boolean
  createdAt: string
}

export interface GoalWithProgress {
  goal: GoalRow
  progress: GoalProgress
}

interface GoalCardProps {
  item: GoalWithProgress
  onDelete: () => void
}

const STATUS_CONFIG = {
  achieved: { label: "Achieved", color: "#22C55E", barColor: "bg-[#22C55E]", badgeBg: "bg-[#22C55E]/20 text-[#22C55E]" },
  on_track: { label: "On Track", color: "#22c55e", barColor: "bg-[#22c55e]", badgeBg: "bg-[#22c55e]/20 text-[#22c55e]" },
  at_risk: { label: "At Risk", color: "#F59E0B", barColor: "bg-amber-500", badgeBg: "bg-amber-500/20 text-amber-400" },
  no_data: { label: "No Data", color: "#94A3B8", barColor: "bg-[#94A3B8]", badgeBg: "bg-[#94A3B8]/20 text-[#94A3B8]" },
}

function formatValue(value: number): string {
  if (value >= 1_000_000) {
    return "£" + (value / 1_000_000).toFixed(2) + "M"
  }
  if (value >= 1_000) {
    return "£" + value.toLocaleString("en-GB", { maximumFractionDigits: 0 })
  }
  return value.toLocaleString("en-GB", { maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function GoalCard({ item, onDelete }: GoalCardProps) {
  const { goal, progress } = item
  const cfg = STATUS_CONFIG[progress.status]
  const clampedPercent = Math.min(100, Math.max(0, progress.progressPercent ?? 0))

  return (
    <Card className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#F1F5F9] truncate">{goal.name}</h3>
          {goal.description && (
            <p className="mt-0.5 text-sm text-[#94A3B8] line-clamp-2">{goal.description}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badgeBg}`}>
          {cfg.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-full bg-[#222222] h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${cfg.barColor}`}
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-medium text-[#94A3B8] w-10 text-right">
          {progress.progressPercent !== null ? `${Math.round(clampedPercent)}%` : "—"}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-[#94A3B8] uppercase tracking-wide">Current</span>
          <span className="font-semibold text-[#F1F5F9]">{formatValue(progress.currentValue)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[#94A3B8] uppercase tracking-wide">Target</span>
          <span className="font-semibold text-[#F1F5F9]">
            {formatValue(progress.targetValue)}
          </span>
          <span className="text-[#94A3B8]">by {formatDate(goal.targetDate)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[#94A3B8] uppercase tracking-wide">Projected</span>
          <span className="font-semibold text-[#F1F5F9]">
            {progress.projectedCompletionDate
              ? formatDate(progress.projectedCompletionDate)
              : "Insufficient data"}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end border-t border-[#222222] pt-3">
        <button
          onClick={onDelete}
          className="text-xs text-[#94A3B8] hover:text-[#EF4444] transition-colors px-2 py-1 rounded hover:bg-[#EF4444]/10"
        >
          Delete
        </button>
      </div>
    </Card>
  )
}
