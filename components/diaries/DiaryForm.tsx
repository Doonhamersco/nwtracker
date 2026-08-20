"use client"

import { useState } from "react"
import { youtubeWatchUrl } from "@/lib/youtube"
import type { VideoDiaryRow } from "@/lib/services/diaries"

interface DiaryFormProps {
  initial?: VideoDiaryRow
  onSuccess: (diary: VideoDiaryRow) => void
  onCancel: () => void
}

function todayIsoDate() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function DiaryForm({ initial, onSuccess, onCancel }: DiaryFormProps) {
  const isEdit = Boolean(initial)
  const [title, setTitle] = useState(initial?.title ?? "")
  const [recordedAt, setRecordedAt] = useState(initial?.recordedAt ?? todayIsoDate())
  const [youtubeUrl, setYoutubeUrl] = useState(
    initial ? youtubeWatchUrl(initial.youtubeVideoId) : ""
  )
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const payload = {
        title: title.trim(),
        recordedAt,
        youtubeUrl: youtubeUrl.trim(),
        notes: notes.trim() ? notes.trim() : null,
      }

      const res = await fetch(isEdit ? `/api/diaries/${initial!.id}` : "/api/diaries", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string; detail?: string }
        throw new Error(data.detail ?? data.error ?? "Failed to save diary")
      }

      const saved = (await res.json()) as VideoDiaryRow
      onSuccess(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent transition-colors"

  const labelClass = "block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {error}
        </div>
      )}

      <div>
        <label className={labelClass}>Title *</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Spring 2026 diary"
          maxLength={255}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Recorded *</label>
          <input
            type="date"
            required
            value={recordedAt}
            onChange={(e) => setRecordedAt(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>YouTube URL *</label>
          <input
            type="text"
            required
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://youtu.be/…"
            className={inputClass}
          />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted">
        Private YouTube videos cannot play here. Set the video to{" "}
        <span className="text-text">Unlisted</span> so it can embed. Unlisted videos are not in
        search; this app is already login-gated.
      </p>

      <div>
        <label className={labelClass}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes about this recording…"
          rows={4}
          maxLength={5000}
          className={inputClass + " resize-none"}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-bg-card hover:text-text"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-accent px-4 py-2 text-sm text-bg-base transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Add Diary"}
        </button>
      </div>
    </form>
  )
}
