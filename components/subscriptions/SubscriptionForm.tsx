"use client"

import { useEffect, useRef, useState } from "react"
import { ImagePlus, X } from "lucide-react"
import type {
  SubscriptionBillingCycle,
  SubscriptionCategory,
  SubscriptionStatus,
} from "@/db/schema"
import {
  BILLING_CYCLE_OPTIONS,
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
} from "./labels"

export interface SubscriptionFileMeta {
  id: string
  displayName: string
  mimeType: string
}

export interface SubscriptionFormInitial {
  id: string
  name: string
  costGbp: number
  billingCycle: SubscriptionBillingCycle
  nextRenewalDate: string | null
  category: SubscriptionCategory
  status: SubscriptionStatus
  notes: string | null
  files: SubscriptionFileMeta[]
}

interface SubscriptionFormProps {
  initial?: SubscriptionFormInitial
  onSuccess: () => void
  onCancel: () => void
}

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

export function SubscriptionForm({
  initial,
  onSuccess,
  onCancel,
}: SubscriptionFormProps) {
  const isEdit = Boolean(initial)
  const [name, setName] = useState(initial?.name ?? "")
  const [costGbp, setCostGbp] = useState(
    initial ? String(initial.costGbp) : ""
  )
  const [billingCycle, setBillingCycle] = useState<SubscriptionBillingCycle>(
    initial?.billingCycle ?? "monthly"
  )
  const [nextRenewalDate, setNextRenewalDate] = useState(
    initial?.nextRenewalDate ?? ""
  )
  const [category, setCategory] = useState<SubscriptionCategory>(
    initial?.category ?? "other"
  )
  const [status, setStatus] = useState<SubscriptionStatus>(
    initial?.status ?? "active"
  )
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [existingFiles, setExistingFiles] = useState<SubscriptionFileMeta[]>(
    initial?.files ?? []
  )
  const [removedFileIds, setRemovedFileIds] = useState<string[]>([])
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.url)
    }
  }, [pendingImage])

  function addFile(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type) && !file.type.startsWith("image/")) {
      setError("Logo must be an image")
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Logo must be under 10MB")
      return
    }
    if (pendingImage) URL.revokeObjectURL(pendingImage.url)
    for (const existing of existingFiles) {
      setRemovedFileIds((prev) =>
        prev.includes(existing.id) ? prev : [...prev, existing.id]
      )
    }
    setExistingFiles([])
    setPendingImage({ file, url: URL.createObjectURL(file) })
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function removePending() {
    if (pendingImage) URL.revokeObjectURL(pendingImage.url)
    setPendingImage(null)
  }

  function removeExisting(id: string) {
    setExistingFiles((prev) => prev.filter((f) => f.id !== id))
    setRemovedFileIds((prev) => [...prev, id])
  }

  async function uploadLogo(subscriptionId: string) {
    if (!pendingImage) return
    const formData = new FormData()
    formData.append("file", pendingImage.file)
    formData.append("linkedToType", "SUBSCRIPTION")
    formData.append("linkedToId", subscriptionId)
    const res = await fetch("/api/files", { method: "POST", body: formData })
    if (!res.ok) {
      const data = (await res.json()) as { error?: string; detail?: string }
      throw new Error(data.detail ?? data.error ?? "Failed to upload logo")
    }
  }

  async function deleteRemovedFiles() {
    for (const id of removedFileIds) {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) {
        throw new Error("Failed to remove logo")
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const parsedCost = parseFloat(costGbp)
      if (Number.isNaN(parsedCost) || parsedCost < 0) {
        throw new Error("Cost must be a valid amount")
      }

      const body: Record<string, unknown> = {
        name: name.trim(),
        costGbp: parsedCost,
        billingCycle,
        nextRenewalDate: nextRenewalDate || null,
        category,
        status,
        notes: notes.trim() || null,
      }

      const res = await fetch(
        isEdit ? `/api/subscriptions/${initial!.id}` : "/api/subscriptions",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )

      if (!res.ok) {
        const data = (await res.json()) as { error?: string; detail?: string }
        throw new Error(data.detail ?? data.error ?? "Failed to save subscription")
      }

      const saved = (await res.json()) as { id: string }
      await deleteRemovedFiles()
      await uploadLogo(saved.id)

      if (pendingImage) URL.revokeObjectURL(pendingImage.url)
      setPendingImage(null)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent transition-colors"

  const labelClass = "block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide"

  const shownExisting = existingFiles[0]
  const logoPreview = pendingImage?.url
    ?? (shownExisting && shownExisting.mimeType.startsWith("image/")
      ? `/api/files/${shownExisting.id}`
      : null)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {error}
        </div>
      )}

      <div>
        <label className={labelClass}>Name *</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Netflix"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Logo</label>
        <div className="flex items-center gap-3">
          {logoPreview ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-border bg-bg-base">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoPreview} alt="Subscription logo" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  if (pendingImage) removePending()
                  else if (shownExisting) removeExisting(shownExisting.id)
                }}
                aria-label="Remove logo"
                className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white hover:bg-negative"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-strong text-muted hover:border-accent hover:text-accent transition-colors"
            >
              <ImagePlus size={18} />
              <span className="text-[10px]">Add</span>
            </button>
          )}
          {logoPreview && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-muted hover:text-text"
            >
              Replace
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => addFile(e.target.files)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Cost (GBP) *</label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={costGbp}
            onChange={(e) => setCostGbp(e.target.value)}
            placeholder="9.99"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Billing Cycle *</label>
          <select
            value={billingCycle}
            onChange={(e) =>
              setBillingCycle(e.target.value as SubscriptionBillingCycle)
            }
            className={inputClass}
          >
            {BILLING_CYCLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Next Renewal</label>
          <input
            type="date"
            value={nextRenewalDate}
            onChange={(e) => setNextRenewalDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Category *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SubscriptionCategory)}
            className={inputClass}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Status *</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
          className={inputClass}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
          rows={2}
          maxLength={2000}
          className={inputClass + " resize-none"}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-muted hover:text-text hover:bg-bg-card rounded-lg px-3 py-2 text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-accent text-bg-base rounded-lg px-4 py-2 text-sm hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting
            ? "Saving…"
            : isEdit
              ? "Save Changes"
              : "Add Subscription"}
        </button>
      </div>
    </form>
  )
}
