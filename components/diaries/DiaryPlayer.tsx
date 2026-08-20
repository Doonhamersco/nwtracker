"use client"

import { youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/youtube"
import { ExternalLink } from "lucide-react"
import type { VideoDiary } from "./types"
import { formatRecordedDate } from "./formatDate"

interface DiaryPlayerProps {
  diary: VideoDiary
  onEdit: () => void
  onDelete: () => void
}

export function DiaryPlayer({ diary, onEdit, onDelete }: DiaryPlayerProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-card">
      <div className="relative aspect-video w-full bg-black">
        <iframe
          src={youtubeEmbedUrl(diary.youtubeVideoId)}
          title={diary.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
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
          <a
            href={youtubeWatchUrl(diary.youtubeVideoId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 pt-1 text-sm text-muted hover:text-accent"
          >
            Open on YouTube
            <ExternalLink size={14} />
          </a>
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
