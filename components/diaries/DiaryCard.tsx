"use client"

import { youtubeThumbnailUrl } from "@/lib/youtube"
import { Play } from "lucide-react"
import type { VideoDiary } from "./types"
import { formatRecordedDate } from "./formatDate"
import { cn } from "@/lib/utils"

interface DiaryCardProps {
  diary: VideoDiary
  selected: boolean
  onSelect: () => void
}

export function DiaryCard({ diary, selected, onSelect }: DiaryCardProps) {
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={youtubeThumbnailUrl(diary.youtubeVideoId)}
            alt=""
            className="h-full w-full object-cover"
          />
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
