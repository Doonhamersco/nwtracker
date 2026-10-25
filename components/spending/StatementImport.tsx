"use client"

import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { formatMonthLabel } from "@/lib/spending/dates"
import { formatGbp } from "@/lib/spending/money"
import type { BalanceCheck } from "@/lib/spending/balances"
import type { StatementRowWarning } from "@/lib/spending/chase-statement"
import type { ImportTransactionsInput } from "@/lib/validators/transactions"

interface PreviewPayload {
  statement: ImportTransactionsInput
  balanceCheck: BalanceCheck
  warnings?: StatementRowWarning[]
}

type Phase =
  | { kind: "idle" }
  | { kind: "working"; label: string }
  | { kind: "preview"; file: File; preview: PreviewPayload }
  | { kind: "saved"; inserted: number; skipped: number; statementMonth: string }
  | { kind: "error"; message: string }

export function StatementImport({
  prominent = false,
  onImported,
}: {
  prominent?: boolean
  onImported: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const [dragging, setDragging] = useState(false)

  async function previewFile(file: File) {
    setPhase({ kind: "working", label: "Reading statement…" })
    try {
      const preview = await postStatement(file, "preview")
      setPhase({ kind: "preview", file, preview: preview as PreviewPayload })
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : "Could not read that PDF." })
    }
  }

  async function save(file: File) {
    setPhase({ kind: "working", label: "Saving transactions…" })
    try {
      const result = (await postStatement(file, "save")) as {
        inserted: number
        skipped: number
        statementMonth: string
      }
      setPhase({
        kind: "saved",
        inserted: result.inserted,
        skipped: result.skipped,
        statementMonth: result.statementMonth,
      })
      onImported()
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : "Could not save that statement." })
    }
  }

  function takeFile(file: File | undefined) {
    if (!file) return
    void previewFile(file)
  }

  const busy = phase.kind === "working"

  return (
    <div className="flex flex-col gap-3">
      <label
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          takeFile(event.dataTransfer.files[0])
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-center transition-colors ${
          prominent ? "px-6 py-8" : "px-4 py-4"
        } ${dragging ? "border-accent bg-accent/10" : "border-border bg-bg-base hover:border-accent/60"}`}
      >
        <Upload size={prominent ? 20 : 16} className="text-accent" />
        <span className="text-sm text-text">
          {prominent ? "Upload a Chase UK statement" : "Import another statement"}
        </span>
        <span className="text-xs text-muted">PDF from the Chase app. Drop it here or browse.</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-label="Upload Chase UK statement PDF"
          disabled={busy}
          onChange={(event) => {
            takeFile(event.target.files?.[0])
            event.target.value = ""
          }}
        />
      </label>

      {phase.kind === "working" && <p className="text-sm text-muted">{phase.label}</p>}

      {phase.kind === "error" && (
        <p className="text-sm text-negative" role="alert">
          {phase.message}
        </p>
      )}

      {phase.kind === "saved" && (
        <p className="text-sm text-text" role="status">
          Saved {phase.inserted} transaction{phase.inserted === 1 ? "" : "s"} for{" "}
          {formatMonthLabel(phase.statementMonth)}
          {phase.skipped > 0
            ? `. ${phase.skipped} already imported line${phase.skipped === 1 ? "" : "s"} skipped.`
            : "."}
        </p>
      )}

      {phase.kind === "preview" && (
        <Preview
          preview={phase.preview}
          busy={busy}
          onCancel={() => setPhase({ kind: "idle" })}
          onSave={() => void save(phase.file)}
        />
      )}
    </div>
  )
}

function Preview({
  preview,
  busy,
  onCancel,
  onSave,
}: {
  preview: PreviewPayload
  busy: boolean
  onCancel: () => void
  onSave: () => void
}) {
  const { statement, balanceCheck, warnings = [] } = preview
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-text">{formatMonthLabel(statement.statementMonth)}</p>
          <p className="text-xs text-muted">
            {statement.transactions.length} transaction{statement.transactions.length === 1 ? "" : "s"}
            {statement.openingBalance !== undefined ? ` · opening ${formatGbp(statement.openingBalance)}` : ""}
            {statement.closingBalance !== undefined ? ` · closing ${formatGbp(statement.closingBalance)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-bg-base hover:bg-accent-hover disabled:opacity-60"
          >
            Save transactions
          </button>
        </div>
      </div>
      {!balanceCheck.ok && (
        <p className="border-b border-border px-4 py-2 text-xs text-muted">
          The running balance does not match the statement totals. You can still save; rows already imported are skipped.
        </p>
      )}
      {warnings.length > 0 && (
        <div className="border-b border-border px-4 py-2 text-xs text-muted" role="status">
          <p>
            Skipped {warnings.length} row{warnings.length === 1 ? "" : "s"} that could not be read. The other transactions can still be saved.
          </p>
          <ul className="mt-1 list-disc pl-4">
            {warnings.map((warning) => (
              <li key={`${warning.date}-${warning.description}`}>{warning.message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-bg-card text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium">In / out</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {statement.transactions.map((row, index) => (
              <tr key={`${row.date}-${row.description}-${index}`} className="border-t border-border">
                <td className="whitespace-nowrap px-4 py-2 text-muted">{row.date}</td>
                <td className="px-4 py-2 text-text">{row.description}</td>
                <td className="px-4 py-2">
                  <Badge variant={row.direction === "in" ? "positive" : "neutral"}>
                    {row.direction === "in" ? "In" : "Out"}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-text">
                  {row.direction === "out" ? "−" : "+"}
                  {formatGbp(row.amount_gbp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

async function postStatement(file: File, intent: "preview" | "save") {
  const body = new FormData()
  body.set("file", file)
  body.set("intent", intent)
  const res = await fetch("/api/spending/statement", { method: "POST", body })
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) {
    throw new Error(data?.error || "Could not import that statement.")
  }
  return data
}
