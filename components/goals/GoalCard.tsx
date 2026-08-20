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

interface GoalFile {
  id: string
  displayName: string
  mimeType: string
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
  completedAt: string | null
  isActive: boolean
  createdAt: string
}

export interface GoalWithProgress {
  goal: GoalRow
  progress: GoalProgress
  files: GoalFile[]
}

interface GoalCardProps {
  item: GoalWithProgress
  onEdit: () => void
  onComplete: () => void
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

export function GoalCard({ item, onEdit, onComplete, onDelete }: GoalCardProps) {
  const { goal, progress, files = [] } = item
  const isCompleted = Boolean(goal.completedAt) || progress.status === "achieved"
  const cfg = STATUS_CONFIG[isCompleted ? "achieved" : progress.status]
  const clampedPercent = isCompleted
    ? 100
    : Math.min(100, Math.max(0, progress.progressPercent ?? 0))
  const muted = isCompleted ? "text-[#bbf7d0]" : "text-[#94A3B8]"
  const heading = isCompleted ? "text-white" : "text-[#F1F5F9]"
  const imageFiles = files.filter((f) => f.mimeType.startsWith("image/"))

  return (
    <Card variant={isCompleted ? "completed" : "default"} className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold truncate ${heading}`}>{goal.name}</h3>
          {goal.description && (
            <p className={`mt-0.5 text-sm line-clamp-3 ${muted}`}>{goal.description}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isCompleted ? "bg-white/20 text-white" : cfg.badgeBg
          }`}
        >
          {isCompleted ? "Completed" : cfg.label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className={`flex-1 rounded-full h-2 overflow-hidden ${isCompleted ? "bg-black/20" : "bg-[#222222]"}`}>
          <div
            className={`h-full rounded-full transition-all ${isCompleted ? "bg-white" : cfg.barColor}`}
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
        <span className={`shrink-0 text-sm font-medium w-10 text-right ${muted}`}>
          {isCompleted || progress.progressPercent !== null
            ? `${Math.round(clampedPercent)}%`
            : "—"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className={`${muted} uppercase tracking-wide`}>Current</span>
          <span className={`font-semibold ${heading}`}>{formatValue(progress.currentValue)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className={`${muted} uppercase tracking-wide`}>Target</span>
          <span className={`font-semibold ${heading}`}>
            {formatValue(progress.targetValue)}
          </span>
          <span className={muted}>by {formatDate(goal.targetDate)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className={`${muted} uppercase tracking-wide`}>
            {isCompleted ? "Completed" : "Projected"}
          </span>
          <span className={`font-semibold ${heading}`}>
            {isCompleted && goal.completedAt
              ? formatDate(goal.completedAt)
              : progress.projectedCompletionDate
                ? formatDate(progress.projectedCompletionDate)
                : "Insufficient data"}
          </span>
        </div>
      </div>

      {imageFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imageFiles.map((file) => (
            <a
              key={file.id}
              href={`/api/files/${file.id}`}
              target="_blank"
              rel="noreferrer"
              className="h-16 w-16 overflow-hidden rounded-lg border border-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/files/${file.id}`}
                alt={file.displayName}
                className="h-full w-full object-cover"
              />
            </a>
          ))}
        </div>
      )}

      <div
        className={`flex items-center justify-between gap-2 border-t pt-3 ${
          isCompleted ? "border-white/15" : "border-[#222222]"
        }`}
      >
        <button
          type="button"
          onClick={onDelete}
          className={`text-sm transition-colors px-2 py-1.5 rounded-lg ${
            isCompleted
              ? "text-white/70 hover:text-white hover:bg-[#EF4444]/40"
              : "text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
          }`}
        >
          Delete
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              isCompleted
                ? "border-white/30 text-white hover:bg-white/10"
                : "border-[#333333] text-[#F1F5F9] hover:bg-[#1a1a1a]"
            }`}
          >
            Edit
          </button>
          {!isCompleted && (
            <button
              type="button"
              onClick={onComplete}
              className="text-sm font-medium bg-[#22c55e] text-white px-3 py-1.5 rounded-lg hover:bg-[#16a34a] transition-colors"
            >
              Complete
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}
