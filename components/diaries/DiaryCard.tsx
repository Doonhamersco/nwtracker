"use client"

import { useEffect, useState } from "react"
import { youtubeThumbnailUrl } from "@/lib/youtube"
import { Play } from "lucide-react"
import type { VideoDiary } from "./types"
import { formatRecordedDate } from "./formatDate"
import { cn } from "@/lib/utils"
import {
  base64ToBytes,
  decryptBytes,
  unwrapFileKey,
} from "@/lib/crypto/diary"
import { fetchEncryptedObject } from "./r2Upload"

interface DiaryCardProps {
  diary: VideoDiary
  masterKey: Uint8Array
  selected: boolean
  onSelect: () => void
}

export function DiaryCard({ diary, masterKey, selected, onSelect }: DiaryCardProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!diary.thumbObjectKey || !diary.wrappedFileKey || !diary.wrapIv) return
    let cancelled = false
    let url: string | null = null

    async function load() {
      try {
        const fileKey = await unwrapFileKey(
          base64ToBytes(diary.wrappedFileKey!),
          base64ToBytes(diary.wrapIv!),
          masterKey
        )
        const ciphertext = await fetchEncryptedObject(diary.thumbObjectKey!)
        if (cancelled) return
        const jpeg = await decryptBytes(ciphertext, fileKey)
        const copy = new Uint8Array(jpeg.byteLength)
        copy.set(jpeg)
        url = URL.createObjectURL(new Blob([new Uint8Array(copy)], { type: "image/jpeg" }))
        if (!cancelled) setThumbUrl(url)
      } catch {
        // Placeholder stays
      }
    }

    void load()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [diary.thumbObjectKey, diary.wrappedFileKey, diary.wrapIv, masterKey])

  const youtubeThumb =
    !diary.r2ObjectKey && diary.youtubeVideoId
      ? youtubeThumbnailUrl(diary.youtubeVideoId)
      : null
  const src = thumbUrl ?? youtubeThumb

  return (
    <button type="button" onClick={onSelect} className="w-full text-left">
      <div
        className={cn(
          "flex gap-4 rounded-2xl border p-3 transition-colors sm:p-4",
          selected
            ? "border-accent/50 bg-accent/5"
            : "border-border bg-bg-card hover:bg-bg-hover"
        )}
      >
        <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-bg-base sm:h-24 sm:w-40">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : null}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
            <Play size={18} className="fill-white/90 text-white/90" />
          </div>
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {formatRecordedDate(diary.recordedAt)}
          </p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-text">{diary.title}</h3>
          {diary.notes && (
            <p className="mt-1 line-clamp-2 text-sm text-muted">{diary.notes}</p>
          )}
        </div>
      </div>
    </button>
  )
}
