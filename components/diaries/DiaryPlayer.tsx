"use client"

import { useEffect, useState } from "react"
import { youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/youtube"
import { ExternalLink } from "lucide-react"
import type { VideoDiary } from "./types"
import { formatRecordedDate } from "./formatDate"
import {
  base64ToBytes,
  decryptToBlob,
  unwrapFileKey,
} from "@/lib/crypto/diary"
import { fetchEncryptedObject } from "./r2Upload"

interface DiaryPlayerProps {
  diary: VideoDiary
  masterKey: Uint8Array
  onEdit: () => void
  onDelete: () => void
}

export function DiaryPlayer({ diary, masterKey, onEdit, onDelete }: DiaryPlayerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isR2 = Boolean(diary.r2ObjectKey && diary.wrappedFileKey && diary.wrapIv)

  useEffect(() => {
    if (!isR2 || !diary.r2ObjectKey || !diary.wrappedFileKey || !diary.wrapIv) return
    let cancelled = false
    let url: string | null = null

    async function load() {
      setError(null)
      setStatus("Downloading ciphertext…")
      try {
        const fileKey = await unwrapFileKey(
          base64ToBytes(diary.wrappedFileKey!),
          base64ToBytes(diary.wrapIv!),
          masterKey
        )
        const ciphertext = await fetchEncryptedObject(diary.r2ObjectKey!)
        if (cancelled) return
        setStatus("Decrypting…")
        const blob = await decryptToBlob(ciphertext, fileKey, diary.mimeType ?? "video/mp4")
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setObjectUrl(url)
        setStatus(null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not decrypt video")
          setStatus(null)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [diary.id, diary.r2ObjectKey, diary.wrappedFileKey, diary.wrapIv, diary.mimeType, isR2, masterKey])

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-card">
      <div className="relative aspect-video w-full bg-black">
        {isR2 ? (
          objectUrl ? (
            <video
              src={objectUrl}
              controls
              className="absolute inset-0 h-full w-full"
              playsInline
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted">
              {error ?? status ?? "Loading…"}
            </div>
          )
        ) : diary.youtubeVideoId ? (
          <iframe
            src={youtubeEmbedUrl(diary.youtubeVideoId)}
            title={diary.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            No video
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {formatRecordedDate(diary.recordedAt)}
            </p>
            <h2 className="mt-0.5 font-display text-2xl font-medium tracking-tight text-text">
              {diary.title}
            </h2>
          </div>
          {!isR2 && diary.youtubeVideoId && (
            <a
              href={youtubeWatchUrl(diary.youtubeVideoId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 pt-1 text-sm text-muted hover:text-accent"
            >
              Open on YouTube
              <ExternalLink size={14} />
            </a>
          )}
        </div>

        {diary.notes && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{diary.notes}</p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-negative/10 hover:text-negative"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-bg-hover"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  )
}
