"use client"

import { useEffect, useRef, useState } from "react"
import { ImagePlus, X } from "lucide-react"

type MetricType = "NET_WORTH" | "LIFE_METRIC" | "ACCOUNT_CATEGORY"

export interface GoalFileMeta {
  id: string
  displayName: string
  mimeType: string
}

export interface GoalFormInitial {
  id: string
  name: string
  description: string | null
  targetValue: number
  targetDate: string
  metricType: MetricType
  linkedCategory: string | null
  completedAt: string | null
  files: GoalFileMeta[]
}

interface GoalFormProps {
  initial?: GoalFormInitial
  defaultMarkCompleted?: boolean
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

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]

interface PendingImage {
  file: File
  url: string
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function GoalForm({
  initial,
  defaultMarkCompleted = false,
  onSuccess,
  onCancel,
}: GoalFormProps) {
  const isEdit = Boolean(initial)
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [targetValue, setTargetValue] = useState(
    initial ? String(initial.targetValue) : ""
  )
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "")
  const [metricType, setMetricType] = useState<MetricType>(
    initial?.metricType ?? "NET_WORTH"
  )
  const [linkedCategory, setLinkedCategory] = useState(
    initial?.linkedCategory ?? "CASH"
  )
  const [isCompleted, setIsCompleted] = useState(
    Boolean(initial?.completedAt) || defaultMarkCompleted
  )
  const [completedAt, setCompletedAt] = useState(
    initial?.completedAt ?? todayIsoDate()
  )
  const [existingFiles, setExistingFiles] = useState<GoalFileMeta[]>(
    initial?.files ?? []
  )
  const [removedFileIds, setRemovedFileIds] = useState<string[]>([])
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const pendingImagesRef = useRef<PendingImage[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    pendingImagesRef.current = pendingImages
  }, [pendingImages])

  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach((img) => URL.revokeObjectURL(img.url))
    }
  }, [])

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    const next: PendingImage[] = []
    for (const file of Array.from(fileList)) {
      const isImage =
        file.type.startsWith("image/") || ACCEPTED_IMAGE_TYPES.includes(file.type)
      if (!isImage) {
        setError("Only image files can be attached.")
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError(`"${file.name}" is larger than 10 MB.`)
        continue
      }
      next.push({ file, url: URL.createObjectURL(file) })
    }
    if (next.length > 0) {
      setPendingImages((prev) => [...prev, ...next])
      setError(null)
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function removePending(url: string) {
    setPendingImages((prev) => {
      const match = prev.find((img) => img.url === url)
      if (match) URL.revokeObjectURL(match.url)
      return prev.filter((img) => img.url !== url)
    })
  }

  function removeExisting(id: string) {
    setExistingFiles((prev) => prev.filter((f) => f.id !== id))
    setRemovedFileIds((prev) => [...prev, id])
  }

  async function uploadImages(goalId: string) {
    for (const img of pendingImages) {
      const formData = new FormData()
      formData.append("file", img.file)
      formData.append("linkedToType", "GOAL")
      formData.append("linkedToId", goalId)
      const res = await fetch("/api/files", { method: "POST", body: formData })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string; detail?: string }
        throw new Error(data.detail ?? data.error ?? "Failed to upload image")
      }
    }
  }

  async function deleteRemovedFiles() {
    for (const id of removedFileIds) {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) {
        throw new Error("Failed to remove an image")
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        targetValue: parseFloat(targetValue),
        targetDate,
        completedAt: isCompleted ? completedAt : null,
      }

      if (!isEdit) {
        body.metricType = metricType
        if (metricType === "ACCOUNT_CATEGORY") {
          body.linkedCategory = linkedCategory
        }
      }

      const res = await fetch(isEdit ? `/api/goals/${initial!.id}` : "/api/goals", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string; detail?: string }
        throw new Error(data.detail ?? data.error ?? "Failed to save goal")
      }

      const saved = (await res.json()) as { id: string }
      await deleteRemovedFiles()
      await uploadImages(saved.id)

      pendingImages.forEach((img) => URL.revokeObjectURL(img.url))
      setPendingImages([])
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

      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notes about this goal, or how you completed it…"
          rows={3}
          maxLength={1000}
          className={inputClass + " resize-none"}
        />
      </div>

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

      {!isEdit && (
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
      )}

      {!isEdit && metricType === "ACCOUNT_CATEGORY" && (
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

      <div>
        <label className={labelClass}>Images</label>
        <div className="flex flex-wrap gap-2">
          {existingFiles.map((file) => (
            <div
              key={file.id}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-[#222222]"
            >
              {file.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/files/${file.id}`}
                  alt={file.displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#0a0a0a] p-1 text-center text-[10px] text-[#94A3B8]">
                  {file.displayName}
                </div>
              )}
              <button
                type="button"
                onClick={() => removeExisting(file.id)}
                aria-label={`Remove ${file.displayName}`}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white hover:bg-[#EF4444]"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {pendingImages.map((img) => (
            <div
              key={img.url}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-[#222222]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.file.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePending(img.url)}
                aria-label={`Remove ${img.file.name}`}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white hover:bg-[#EF4444]"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#333333] text-[#94A3B8] hover:border-[#22c55e] hover:text-[#22c55e] transition-colors"
          >
            <ImagePlus size={18} />
            <span className="text-[10px]">Add</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-[#222222] bg-[#0a0a0a] px-3 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={(e) => {
            setIsCompleted(e.target.checked)
            if (e.target.checked && !completedAt) {
              setCompletedAt(todayIsoDate())
            }
          }}
          className="mt-0.5 h-4 w-4 accent-[#22c55e]"
        />
        <span className="flex-1">
          <span className="block text-sm font-medium text-[#F1F5F9]">
            Mark this goal as complete
          </span>
          <span className="mt-0.5 block text-xs text-[#94A3B8]">
            Turns the goal card green and records the date you finished it.
          </span>
        </span>
      </label>

      {isCompleted && (
        <div>
          <label className={labelClass}>Completed On</label>
          <input
            type="date"
            required
            value={completedAt}
            onChange={(e) => setCompletedAt(e.target.value)}
            className={inputClass}
          />
        </div>
      )}

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
          {isSubmitting
            ? "Saving…"
            : isEdit
              ? isCompleted
                ? "Save & Complete"
                : "Save Changes"
              : "Create Goal"}
        </button>
      </div>
    </form>
  )
}
