"use client"

import { useState } from "react"
import {
  CHUNK_SIZE,
  bytesToBase64,
  encryptBlob,
  encryptBytes,
  randomBytes,
  wrapFileKey,
} from "@/lib/crypto/diary"
import { diaryThumbKey, diaryVideoKey } from "@/lib/r2-keys"
import { uploadEncryptedObject } from "./r2Upload"
import type { VideoDiary } from "./types"

interface DiaryFormProps {
  masterKey: Uint8Array
  initial?: VideoDiary
  onSuccess: (diary: VideoDiary) => void
  onCancel: () => void
}

function todayIsoDate() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

async function captureThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement("video")
    video.muted = true
    video.playsInline = true
    video.preload = "metadata"
    video.src = url
    const cleanup = () => URL.revokeObjectURL(url)
    video.onloadeddata = () => {
      const t = Number.isFinite(video.duration) ? Math.min(1, video.duration * 0.1) : 0
      video.currentTime = t
    }
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas")
        const w = video.videoWidth || 640
        const h = video.videoHeight || 360
        canvas.width = 640
        canvas.height = Math.max(1, Math.round((h / w) * 640))
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => {
            cleanup()
            resolve(blob)
          },
          "image/jpeg",
          0.8
        )
      } catch {
        cleanup()
        resolve(null)
      }
    }
    video.onerror = () => {
      cleanup()
      resolve(null)
    }
  })
}

export function DiaryForm({ masterKey, initial, onSuccess, onCancel }: DiaryFormProps) {
  const isEdit = Boolean(initial)
  const [title, setTitle] = useState(initial?.title ?? "")
  const [recordedAt, setRecordedAt] = useState(initial?.recordedAt ?? todayIsoDate())
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (isEdit && initial) {
        const res = await fetch(`/api/diaries/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            recordedAt,
            notes: notes.trim() ? notes.trim() : null,
          }),
        })
        if (!res.ok) {
          const data = (await res.json()) as { error?: string; detail?: string }
          throw new Error(data.detail ?? data.error ?? "Failed to save diary")
        }
        onSuccess((await res.json()) as VideoDiary)
        return
      }

      if (!file) throw new Error("Choose a video file")

      const id = crypto.randomUUID()
      const fileKey = randomBytes(32)
      const wrapped = await wrapFileKey(fileKey, masterKey)
      const videoKey = diaryVideoKey(id)

      setProgress("Encrypting video…")
      const encrypted = await encryptBlob(file, fileKey)

      setProgress("Uploading ciphertext…")
      await uploadEncryptedObject(videoKey, encrypted.blob)

      let thumbObjectKey: string | null = null
      setProgress("Encrypting thumbnail…")
      const thumb = await captureThumbnail(file)
      if (thumb) {
        const thumbBytes = new Uint8Array(await thumb.arrayBuffer())
        const thumbEnc = await encryptBytes(thumbBytes, fileKey)
        thumbObjectKey = diaryThumbKey(id)
        await uploadEncryptedObject(
          thumbObjectKey,
          new Blob([new Uint8Array(thumbEnc)], { type: "application/octet-stream" })
        )
      }

      setProgress("Saving entry…")
      const res = await fetch("/api/diaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title: title.trim(),
          recordedAt,
          notes: notes.trim() ? notes.trim() : null,
          r2ObjectKey: videoKey,
          thumbObjectKey,
          wrappedFileKey: bytesToBase64(wrapped.wrapped),
          wrapIv: bytesToBase64(wrapped.iv),
          chunkSize: CHUNK_SIZE,
          ciphertextBytes: encrypted.bytes,
          mimeType: file.type || "video/mp4",
        }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string; detail?: string }
        throw new Error(data.detail ?? data.error ?? "Failed to save diary")
      }
      onSuccess((await res.json()) as VideoDiary)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
      setProgress(null)
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
        {!isEdit && (
          <div>
            <label className={labelClass}>Video *</label>
            <input
              type="file"
              required
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={inputClass}
            />
          </div>
        )}
      </div>

      {!isEdit && (
        <p className="text-xs leading-relaxed text-muted">
          The file is encrypted in this browser, then ciphertext is stored in a private R2 bucket.
          Prefer a compressed export (720p) over a raw 4K phone dump.
        </p>
      )}

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

      <div className="flex items-center justify-end gap-2 pt-2">
        {progress && <span className="mr-auto text-xs text-muted">{progress}</span>}
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
          {isSubmitting ? "Working…" : isEdit ? "Save Changes" : "Add Diary"}
        </button>
      </div>
    </form>
  )
}
