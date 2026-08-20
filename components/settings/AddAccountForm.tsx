"use client"

import { useState } from "react"

interface AddAccountFormProps {
  onSuccess: () => void
  onCancel: () => void
}

const ACCOUNT_TYPES = [
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
] as const

const ACCOUNT_CATEGORIES = [
  { value: "CASH", label: "Cash" },
  { value: "ISA", label: "ISA" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "VEHICLE", label: "Vehicle" },
  { value: "STUDENT_LOAN", label: "Student Loan" },
  { value: "PENSION", label: "Pension" },
  { value: "PROPERTY", label: "Property" },
  { value: "STOCKS", label: "Stocks" },
  { value: "OTHER_ASSET", label: "Other Asset" },
  { value: "OTHER_LIABILITY", label: "Other Liability" },
] as const

type AccountType = "ASSET" | "LIABILITY"

export function AddAccountForm({ onSuccess, onCancel }: AddAccountFormProps) {
  const [name, setName] = useState("")
  const [type, setType] = useState<AccountType>("ASSET")
  const [category, setCategory] = useState("CASH")
  const [currencyCode, setCurrencyCode] = useState("GBP")
  const [coingeckoId, setCoingeckoId] = useState("")
  const [institution, setInstitution] = useState("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCrypto = category === "CRYPTO"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        type,
        category,
        currencyCode: currencyCode.trim().toUpperCase() || "GBP",
        institution: institution.trim() || undefined,
        notes: notes.trim() || undefined,
      }

      if (isCrypto && coingeckoId.trim()) {
        body.coingeckoId = coingeckoId.trim().toLowerCase()
      }

      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string; detail?: string }
        throw new Error(data.detail ?? data.error ?? "Failed to create account")
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
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

      {/* Name */}
      <div>
        <label className={labelClass}>Account Name *</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Barclays Current Account"
          className={inputClass}
        />
      </div>

      {/* Type + Category */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Type *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
            className={inputClass}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Category *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          >
            {ACCOUNT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Currency */}
      <div>
        <label className={labelClass}>Currency</label>
        <input
          type="text"
          value={currencyCode}
          onChange={(e) => setCurrencyCode(e.target.value)}
          placeholder="GBP"
          maxLength={10}
          className={inputClass}
        />
      </div>

      {/* CoinGecko ID (only for CRYPTO) */}
      {isCrypto && (
        <div>
          <label className={labelClass}>CoinGecko ID</label>
          <input
            type="text"
            value={coingeckoId}
            onChange={(e) => setCoingeckoId(e.target.value)}
            placeholder="e.g. bitcoin, ethereum"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted">
            Used to auto-fetch GBP spot price at check-in.
            Find IDs at{" "}
            <a
              href="https://www.coingecko.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              coingecko.com
            </a>
          </p>
        </div>
      )}

      {/* Institution */}
      <div>
        <label className={labelClass}>Institution</label>
        <input
          type="text"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          placeholder="e.g. Barclays, Coinbase (optional)"
          className={inputClass}
        />
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes…"
          rows={2}
          className={inputClass + " resize-none"}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="text-muted hover:text-text hover:bg-bg-card rounded-lg px-3 py-2 text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-accent text-bg-base rounded-lg px-4 py-2 text-sm hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Adding…" : "Add Account"}
        </button>
      </div>
    </form>
  )
}
