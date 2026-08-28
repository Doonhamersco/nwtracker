"use client"

import { useRef, useState } from "react"
import { Card } from "@/components/ui/Card"
import { BrandMark } from "@/components/layout/BrandMark"
import { useProfile } from "@/components/layout/ProfileProvider"
import {
  ACCENT_PRESETS,
  AVATAR_MAX_BYTES,
  isAvatarMimeType,
} from "@/lib/profile-theme"

export function ProfileForm() {
  const { accentColor, avatarUrl, setAccentColor, setAvatar } = useProfile()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [savingColor, setSavingColor] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function persistColor(color: string) {
    const previous = accentColor
    setAccentColor(color)
    setSavingColor(true)
    setError(null)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accentColor: color }),
      })
      if (!res.ok) throw new Error("Could not save colour")
      const data = (await res.json()) as { accentColor: string }
      setAccentColor(data.accentColor)
    } catch (err) {
      setAccentColor(previous)
      setError(err instanceof Error ? err.message : "Could not save colour")
    } finally {
      setSavingColor(false)
    }
  }

  async function handleFile(file: File) {
    if (!isAvatarMimeType(file.type)) {
      setError("Use a JPEG, PNG, or WebP image")
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError("Image must be 2MB or smaller")
      return
    }

    setUploading(true)
    setError(null)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/profile/avatar", { method: "PUT", body })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Could not upload image")
      }
      const data = (await res.json()) as { hasAvatar: boolean; updatedAt: string | null }
      setAvatar(data.hasAvatar, data.updatedAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload image")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleRemove() {
    setUploading(true)
    setError(null)
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" })
      if (!res.ok) throw new Error("Could not remove image")
      const data = (await res.json()) as { hasAvatar: boolean; updatedAt: string | null }
      setAvatar(data.hasAvatar, data.updatedAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove image")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-text">Profile</h2>

      <Card>
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="font-medium text-text">Logo</h3>
            <p className="mt-1 text-sm text-muted">
              Shown in the top-left of the app. A square photo of your face works best.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <BrandMark />
            <div className="flex flex-wrap gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleFile(file)
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="rounded-lg bg-accent px-3 py-2 text-sm text-bg-base transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => void handleRemove()}
                  disabled={uploading}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-text transition-colors hover:bg-bg-hover disabled:opacity-60"
                >
                  Use letter T
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="font-medium text-text">App colour</h3>
            <p className="mt-1 text-sm text-muted">
              Recolours buttons, highlights, charts, and the rest of the chrome.
              The dark background stays; the gold does not.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={`Use colour ${preset}`}
                onClick={() => void persistColor(preset)}
                className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-105 ${
                  accentColor.toLowerCase() === preset
                    ? "border-text"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: preset }}
              />
            ))}
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => void persistColor(e.target.value)}
                className="h-9 w-9 cursor-pointer rounded-lg border border-border bg-bg-base p-1"
              />
              Custom
            </label>
          </div>

          {savingColor && <p className="text-xs text-muted">Saving…</p>}
        </div>
      </Card>

      {error && (
        <p className="text-sm text-negative" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
