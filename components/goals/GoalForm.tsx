"use client"

import { useState } from "react"

interface GoalFormProps {
  onSuccess: () => void
  onCancel: () => void
}

const METRIC_TYPE_OPTIONS = [
  { value: "NET_WORTH", label: "Net Worth" },
  { value: "LIFE_METRIC", label: "Life Metric" },
  { value: "ACCOUNT_CATEGORY", label: "Account Category" },
] as const

const ACCOUNT_CATEGORIES = [
  { value: "CASH", label: "Cash" },
  { value: "ISA", label: "ISA" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "VEHICLE", label: "Vehicle" },
  { value: "STUDENT_LOAN", label: "Student Loan" },
  { value: "PENSION", label: "Pension" },
  { value: "PROPERTY", label: "Property" },
  { value: "STOCKS", label: "Stocks" },
  { value: "OTHER_ASSET", label: "Other Asset" },
  { value: "OTHER_LIABILITY", label: "Other Liability" },
] as const

type MetricType = "NET_WORTH" | "LIFE_METRIC" | "ACCOUNT_CATEGORY"

export function GoalForm({ onSuccess, onCancel }: GoalFormProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [targetValue, setTargetValue] = useState("")
  const [targetDate, setTargetDate] = useState("")
  const [metricType, setMetricType] = useState<MetricType>("NET_WORTH")
  const [linkedCategory, setLinkedCategory] = useState("CASH")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
        targetValue: parseFloat(targetValue),
        targetDate,
        metricType,
      }

      if (metricType === "ACCOUNT_CATEGORY") {
        body.linkedCategory = linkedCategory
      }

      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string; detail?: string }
        throw new Error(data.detail ?? data.error ?? "Failed to create goal")
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[#222222] bg-[#0a0a0a] px-3 py-2 text-sm text-[#F1F5F9] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#22c55e] transition-colors"

  const labelClass = "block text-xs font-medium text-[#94A3B8] mb-1.5 uppercase tracking-wide"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-2 text-sm text-[#EF4444]">
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label className={labelClass}>Goal Name *</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Reach £100k net worth"
          className={inputClass}
        />
      </div>

      {/* Description */}
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes about this goal…"
          rows={2}
          className={inputClass + " resize-none"}
        />
      </div>

      {/* Target value + date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Target Value *</label>
          <input
            type="number"
            required
            min="0"
            step="any"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="100000"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Target Date *</label>
          <input
            type="date"
            required
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Metric type */}
      <div>
        <label className={labelClass}>Metric Type *</label>
        <select
          value={metricType}
          onChange={(e) => setMetricType(e.target.value as MetricType)}
          className={inputClass}
        >
          {METRIC_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Account category (only for ACCOUNT_CATEGORY type) */}
      {metricType === "ACCOUNT_CATEGORY" && (
        <div>
          <label className={labelClass}>Account Category *</label>
          <select
            value={linkedCategory}
            onChange={(e) => setLinkedCategory(e.target.value)}
            className={inputClass}
          >
            {ACCOUNT_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#111111] rounded-lg px-3 py-2 text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-[#22c55e] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Creating…" : "Create Goal"}
        </button>
      </div>
    </form>
  )
}
