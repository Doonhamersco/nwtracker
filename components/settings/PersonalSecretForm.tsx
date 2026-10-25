"use client"

import { useState } from "react"

export function PersonalSecretForm({
  label,
  placeholder,
  endpoint,
  onSaved,
}: {
  label: string
  placeholder: string
  endpoint: string
  onSaved: () => void
}) {
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          endpoint.endsWith("/hevy") ? { apiKey: value } : { refreshToken: value }
        ),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Could not save")
      setValue("")
      setMessage("Saved for this account.")
      onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save")
    } finally {
      setBusy(false)
    }
  }

  async function clear() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(endpoint, { method: "DELETE" })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Could not remove")
      setMessage("Removed from this account.")
      onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not remove")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <label className="text-xs font-medium uppercase tracking-wide text-muted">{label}</label>
      <input
        type="password"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || value.trim().length === 0}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-bg-base hover:bg-accent-hover disabled:opacity-60"
        >
          Save for this account
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={clear}
          className="rounded-lg border border-border px-3 py-2 text-sm text-text disabled:opacity-60"
        >
          Remove
        </button>
      </div>
      {message && <p className="text-xs text-muted">{message}</p>}
    </form>
  )
}
