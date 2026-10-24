"use client"

import { useState } from "react"
import { Card } from "@/components/ui/Card"
import { formatGbp } from "@/lib/spending/money"
import type { SpendingTransaction } from "@/lib/spending/types"

export function TransactionsTable({
  transactions,
  categories,
  onChanged,
}: {
  transactions: SpendingTransaction[]
  categories: string[]
  onChanged: () => void
}) {
  if (transactions.length === 0) {
    return (
      <Card>
        <h2 className="font-display text-lg text-text">Transactions</h2>
        <p className="mt-3 text-sm text-muted">No transactions in this month.</p>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden p-0 sm:p-0">
      <div className="px-5 pt-5 sm:px-6">
        <h2 className="font-display text-lg text-text">Transactions</h2>
        <p className="mt-1 text-sm text-muted">
          Change a category inline. Tick apply to future so the next import uses it.
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead>
            <tr className="border-y border-border text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-2 font-medium sm:px-6">Date</th>
              <th className="px-3 py-2 font-medium">Merchant</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-5 py-2 text-right font-medium sm:px-6">Balance</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                categories={categories}
                onChanged={onChanged}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function TransactionRow({
  tx,
  categories,
  onChanged,
}: {
  tx: SpendingTransaction
  categories: string[]
  onChanged: () => void
}) {
  const [applyToFuture, setApplyToFuture] = useState(false)
  const [custom, setCustom] = useState(false)
  const [draft, setDraft] = useState(tx.category ?? "")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const options = categories.includes(tx.category ?? "")
    ? categories
    : tx.category
      ? [...categories, tx.category]
      : categories

  async function save(category: string) {
    const trimmed = category.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: trimmed,
          applyToFuture,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? "Could not save category")
      }
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save category")
    } finally {
      setSaving(false)
    }
  }

  const amount = tx.direction === "out" ? -Math.abs(tx.amountGbp) : Math.abs(tx.amountGbp)

  return (
    <tr className="border-b border-border/70 align-top">
      <td className="px-5 py-3 whitespace-nowrap text-muted sm:px-6">
        {tx.date}
        <div className="text-xs">{tx.type}</div>
      </td>
      <td className="px-3 py-3">
        <div className="text-text">{tx.merchant}</div>
        {tx.descriptionRaw !== tx.merchant && (
          <div className="max-w-xs truncate text-xs text-muted" title={tx.descriptionRaw}>
            {tx.descriptionRaw}
          </div>
        )}
        {tx.isTransfer && (
          <span className="mt-1 inline-block rounded-full bg-bg-hover px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
            Transfer
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-1.5">
          {custom ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void save(draft)
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="w-40 rounded-lg border border-border bg-bg-base px-2 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
                aria-label={`Custom category for ${tx.merchant}`}
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent px-2 py-1 text-xs text-bg-base disabled:opacity-60"
              >
                Save
              </button>
            </form>
          ) : (
            <select
              aria-label={`Category for ${tx.merchant}`}
              value={tx.category ?? ""}
              disabled={saving}
              onChange={(event) => {
                if (event.target.value === "__custom") {
                  setCustom(true)
                  setDraft(tx.category ?? "")
                  return
                }
                void save(event.target.value)
              }}
              className="max-w-[16rem] rounded-lg border border-border bg-bg-base px-2 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
            >
              <option value="" disabled>
                Uncategorised
              </option>
              {options.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
              <option value="__custom">Custom…</option>
            </select>
          )}
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={applyToFuture}
              onChange={(event) => setApplyToFuture(event.target.checked)}
            />
            Apply to future imports
          </label>
          {error && <p className="text-xs text-negative">{error}</p>}
        </div>
      </td>
      <td
        className={`px-3 py-3 text-right tabular-nums ${
          amount < 0 ? "text-negative" : "text-positive"
        }`}
      >
        {formatGbp(amount)}
      </td>
      <td className="px-5 py-3 text-right tabular-nums text-muted sm:px-6">
        {formatGbp(tx.balanceAfterGbp)}
      </td>
    </tr>
  )
}
