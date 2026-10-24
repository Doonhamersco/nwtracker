"use client"

import { useState } from "react"
import { Card } from "@/components/ui/Card"
import { formatGbp } from "@/lib/spending/money"
import type { DuplicateSubscription, RecurringCandidate } from "@/lib/spending/types"

export function RecurringPanel({
  recurring,
  duplicates,
  onAdded,
}: {
  recurring: RecurringCandidate[]
  duplicates: DuplicateSubscription[]
  onAdded: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {duplicates.length > 0 && (
        <div className="rounded-2xl border border-negative/40 bg-negative/10 px-5 py-4 text-sm">
          <p className="font-medium text-text">Possible duplicate subscriptions</p>
          <ul className="mt-2 space-y-1 text-muted">
            {duplicates.map((pair) => (
              <li key={pair.ids.join(":")}>
                {pair.names[0]} and {pair.names[1]} — {pair.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <h2 className="font-display text-lg text-text">
          Recurring payments not in Subscriptions
        </h2>
        <p className="mt-1 text-sm text-muted">
          Same merchant about once a month, or the same amount more than once.
          Groceries and other variable shops are left out.
        </p>
        {recurring.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing new to add.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {recurring.map((item) => (
              <RecurringRow key={item.merchant} item={item} onAdded={onAdded} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function RecurringRow({
  item,
  onAdded,
}: {
  item: RecurringCandidate
  onAdded: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/spending/recurring", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          merchant: item.merchant,
          costGbp: item.amountGbp,
          spendingCategory: item.spendingCategory,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? "Could not add subscription")
      }
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add subscription")
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-text">{item.merchant}</p>
        <p className="text-xs text-muted">
          {formatGbp(item.amountGbp)} · {item.count} payment{item.count === 1 ? "" : "s"} ·{" "}
          {item.reason === "monthly" ? "about monthly" : "matching amounts"}
          {item.spendingCategory ? ` · ${item.spendingCategory}` : ""}
        </p>
        {item.possibleDuplicate && (
          <p className="mt-1 text-xs text-negative">
            Possible duplicate of {item.possibleDuplicate.name} (
            {formatGbp(item.possibleDuplicate.costGbp)})
          </p>
        )}
        {error && <p className="mt-1 text-xs text-negative">{error}</p>}
      </div>
      <button
        type="button"
        onClick={() => void add()}
        disabled={saving}
        className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm text-bg-base transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {saving ? "Adding…" : "Add to subscriptions"}
      </button>
    </li>
  )
}
