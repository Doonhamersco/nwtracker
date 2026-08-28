"use client"

import { useEffect, useRef, useState } from "react"
import { Film } from "lucide-react"
import { DiaryCard } from "@/components/diaries/DiaryCard"
import { DiaryForm } from "@/components/diaries/DiaryForm"
import { DiaryPlayer } from "@/components/diaries/DiaryPlayer"
import { DiaryUnlock, type CryptoConfig } from "@/components/diaries/DiaryUnlock"
import type { VideoDiary } from "@/components/diaries/types"

type FormMode = { kind: "create" } | { kind: "edit"; diaryId: string }

function groupByYear(diaries: VideoDiary[]): Array<[string, VideoDiary[]]> {
  const groups = new Map<string, VideoDiary[]>()
  for (const diary of diaries) {
    const year = diary.recordedAt.slice(0, 4)
    const list = groups.get(year) ?? []
    list.push(diary)
    groups.set(year, list)
  }
  return [...groups.entries()]
}

export default function DiariesPage() {
  const [cryptoConfig, setCryptoConfig] = useState<CryptoConfig | null>(null)
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null)
  const [diaries, setDiaries] = useState<VideoDiary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<FormMode | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const shouldScrollRef = useRef(false)

  const selected = diaries.find((d) => d.id === selectedId) ?? null
  const editingItem =
    formMode?.kind === "edit" ? diaries.find((d) => d.id === formMode.diaryId) ?? null : null
  const unlocked = Boolean(masterKey)

  async function loadCrypto() {
    const res = await fetch("/api/diaries/crypto")
    if (!res.ok) throw new Error("Failed to load vault config")
    const data = (await res.json()) as CryptoConfig
    setCryptoConfig(data)
  }

  async function fetchDiaries(selectId?: string) {
    try {
      setError(null)
      const res = await fetch("/api/diaries")
      if (!res.ok) throw new Error("Failed to load diaries")
      const data = (await res.json()) as VideoDiary[]
      setDiaries(data)
      setSelectedId((current) => {
        if (selectId) return selectId
        if (current && data.some((d) => d.id === current)) return current
        return data[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/diaries/${id}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete diary")
      setDiaries((prev) => {
        const next = prev.filter((d) => d.id !== id)
        setSelectedId((current) => {
          if (current !== id) return current
          return next[0]?.id ?? null
        })
        return next
      })
      if (formMode?.kind === "edit" && formMode.diaryId === id) {
        setFormMode(null)
      }
    } catch (err) {
      console.error("Delete diary error:", err)
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadCrypto()
        await fetchDiaries()
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (formMode) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [formMode])

  useEffect(() => {
    if (!shouldScrollRef.current) return
    shouldScrollRef.current = false
    if (!formMode) {
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [selectedId, formMode])

  function handleSaved(diary: VideoDiary) {
    setFormMode(null)
    void fetchDiaries(diary.id)
  }

  if (loading && !cryptoConfig) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-40 animate-pulse rounded-2xl bg-bg-card" />
      </div>
    )
  }

  if (cryptoConfig && !unlocked) {
    return (
      <DiaryUnlock
        config={cryptoConfig}
        onUnlocked={(key, nextConfig) => {
          setMasterKey(key)
          setCryptoConfig(nextConfig)
        }}
      />
    )
  }

  if (!masterKey) return null

  const yearGroups = groupByYear(diaries)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-text">Diaries</h1>
          <p className="mt-1 text-sm text-muted">Encrypted on this device, stored as ciphertext</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMasterKey(null)}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:bg-bg-card hover:text-text"
          >
            Lock
          </button>
          {!formMode && (
            <button
              onClick={() => setFormMode({ kind: "create" })}
              className="rounded-lg bg-accent px-4 py-2 text-sm text-bg-base transition-colors hover:bg-accent-hover"
            >
              + Add diary
            </button>
          )}
        </div>
      </div>

      {formMode && (
        <div ref={formRef} className="rounded-2xl border border-border bg-bg-card p-5">
          <h2 className="mb-4 text-base font-semibold text-text">
            {formMode.kind === "create" ? "Add diary" : "Edit diary"}
          </h2>
          <DiaryForm
            key={formMode.kind === "create" ? "new" : formMode.diaryId}
            masterKey={masterKey}
            initial={editingItem ?? undefined}
            onSuccess={handleSaved}
            onCancel={() => setFormMode(null)}
          />
        </div>
      )}

      {!formMode && selected && (
        <div ref={playerRef}>
          <DiaryPlayer
            diary={selected}
            masterKey={masterKey}
            onEdit={() => setFormMode({ kind: "edit", diaryId: selected.id })}
            onDelete={() => handleDelete(selected.id)}
          />
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-bg-card" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-negative/40 bg-negative/10 p-4 text-sm text-negative">
          {error}
        </div>
      )}

      {!loading && !error && diaries.length === 0 && !formMode && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-bg-card py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/20">
            <Film className="text-accent" size={28} />
          </div>
          <div>
            <p className="font-semibold text-text">Add your first diary</p>
            <p className="mt-1 text-sm text-muted">
              Upload a video. It is encrypted here before it is stored.
            </p>
          </div>
          <button
            onClick={() => setFormMode({ kind: "create" })}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-bg-base transition-colors hover:bg-accent-hover"
          >
            Add diary
          </button>
        </div>
      )}

      {!loading && !error && diaries.length > 0 && (
        <div className="flex flex-col gap-8">
          {yearGroups.map(([year, entries]) => (
            <section key={year}>
              <h2 className="mb-3 font-display text-xl font-medium tracking-tight text-text">
                {year}
              </h2>
              <div className="flex flex-col gap-3">
                {entries.map((diary) => (
                  <DiaryCard
                    key={diary.id}
                    diary={diary}
                    masterKey={masterKey}
                    selected={diary.id === selectedId}
                    onSelect={() => {
                      shouldScrollRef.current = true
                      setFormMode(null)
                      setSelectedId(diary.id)
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
