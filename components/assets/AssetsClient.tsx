"use client"

import { useState } from "react"
import { Card } from "@/components/ui/Card"

type PhysicalAssetCategory = "vehicle" | "property" | "valuables" | "other"

interface PhysicalAsset {
  id: string
  name: string
  category: PhysicalAssetCategory
  valueGbp: number
  purchaseDate: string | null
  purchasePriceGbp: number | null
  notes: string | null
}

const CATEGORIES: Array<{ value: PhysicalAssetCategory; label: string }> = [
  { value: "vehicle", label: "Vehicle" },
  { value: "property", label: "Property" },
  { value: "valuables", label: "Valuables" },
  { value: "other", label: "Other" },
]

const inputClass =
  "w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
const labelClass = "block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide"

function formatGbp(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function categoryLabel(category: PhysicalAssetCategory): string {
  return CATEGORIES.find((entry) => entry.value === category)?.label ?? category
}

export function AssetsClient({
  initialAssets,
  initialTotal,
}: {
  initialAssets: PhysicalAsset[]
  initialTotal: number
}) {
  const [assets, setAssets] = useState(initialAssets)
  const [totalGbp, setTotalGbp] = useState(initialTotal)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<PhysicalAsset | null>(null)
  const [creating, setCreating] = useState(false)

  async function load() {
    try {
      setError(null)
      const res = await fetch("/api/physical-assets")
      if (!res.ok) throw new Error("Failed to load assets")
      const data = (await res.json()) as { assets: PhysicalAsset[]; totalGbp: number }
      setAssets(data.assets)
      setTotalGbp(data.totalGbp)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/physical-assets/${id}`, { method: "DELETE" })
    if (!res.ok && res.status !== 204) {
      setError("Failed to remove asset")
      return
    }
    if (editing?.id === id) setEditing(null)
    await load()
  }

  const formOpen = creating || editing !== null

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-text">Assets</h1>
          <p className="mt-1 text-sm text-muted">
            Cars, property, and other things you own outright. Included in net worth.
          </p>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setCreating(true)
            }}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-bg-base transition-colors hover:bg-accent-hover"
          >
            + Add asset
          </button>
        )}
      </div>

      <Card variant="inset" className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
          Total value
        </span>
        <p className="font-display text-5xl font-medium tracking-tight text-text tabular-nums">
          {formatGbp(totalGbp)}
        </p>
      </Card>

      {error && (
        <p className="text-sm text-negative" role="alert">
          {error}
        </p>
      )}

      {formOpen && (
        <Card>
          <h2 className="mb-4 text-base font-semibold text-text">
            {editing ? "Edit asset" : "Add asset"}
          </h2>
          <AssetForm
            initial={editing}
            onCancel={() => {
              setCreating(false)
              setEditing(null)
            }}
            onSaved={async () => {
              setCreating(false)
              setEditing(null)
              await load()
            }}
          />
        </Card>
      )}

      {assets.length === 0 && !formOpen && (
        <Card>
          <p className="text-sm text-muted">No assets yet. Add a car or anything else you own outright.</p>
        </Card>
      )}

      <ul className="flex flex-col gap-3">
        {assets.map((asset) => (
          <li key={asset.id}>
            <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-text">{asset.name}</p>
                <p className="mt-1 text-xs text-muted">
                  {categoryLabel(asset.category)}
                  {asset.purchaseDate ? ` · bought ${asset.purchaseDate}` : ""}
                  {asset.purchasePriceGbp != null ? ` for ${formatGbp(asset.purchasePriceGbp)}` : ""}
                </p>
                {asset.notes && <p className="mt-2 text-sm text-muted">{asset.notes}</p>}
              </div>
              <div className="flex items-center gap-3">
                <p className="font-mono text-lg tabular-nums text-text">{formatGbp(asset.valueGbp)}</p>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false)
                    setEditing(asset)
                  }}
                  className="text-sm text-accent hover:text-accent-hover"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void remove(asset.id)}
                  className="text-sm text-muted hover:text-negative"
                >
                  Remove
                </button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AssetForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: PhysicalAsset | null
  onCancel: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [category, setCategory] = useState<PhysicalAssetCategory>(initial?.category ?? "vehicle")
  const [valueGbp, setValueGbp] = useState(initial ? String(initial.valueGbp) : "")
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? "")
  const [purchasePriceGbp, setPurchasePriceGbp] = useState(
    initial?.purchasePriceGbp != null ? String(initial.purchasePriceGbp) : ""
  )
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      name,
      category,
      valueGbp: Number(valueGbp),
      purchaseDate: purchaseDate.trim() === "" ? null : purchaseDate,
      purchasePriceGbp: purchasePriceGbp.trim() === "" ? null : Number(purchasePriceGbp),
      notes: notes.trim() === "" ? null : notes,
    }
    try {
      const res = await fetch(initial ? `/api/physical-assets/${initial.id}` : "/api/physical-assets", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Could not save that asset")
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that asset")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && <p className="text-sm text-negative">{error}</p>}
      <div>
        <label className={labelClass} htmlFor="asset-name">
          Name
        </label>
        <input
          id="asset-name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
          placeholder="Car"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="asset-category">
            Category
          </label>
          <select
            id="asset-category"
            value={category}
            onChange={(event) => setCategory(event.target.value as PhysicalAssetCategory)}
            className={inputClass}
          >
            {CATEGORIES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="asset-value">
            Current value (GBP)
          </label>
          <input
            id="asset-value"
            required
            inputMode="decimal"
            value={valueGbp}
            onChange={(event) => setValueGbp(event.target.value)}
            className={inputClass}
            placeholder="8500"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="asset-bought">
            Purchase date
          </label>
          <input
            id="asset-bought"
            type="date"
            value={purchaseDate}
            onChange={(event) => setPurchaseDate(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="asset-price">
            Purchase price (GBP)
          </label>
          <input
            id="asset-price"
            inputMode="decimal"
            value={purchasePriceGbp}
            onChange={(event) => setPurchasePriceGbp(event.target.value)}
            className={inputClass}
            placeholder="Optional"
          />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="asset-notes">
          Notes
        </label>
        <textarea
          id="asset-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className={inputClass}
          placeholder="Bought outright"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm text-bg-base hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-text"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
