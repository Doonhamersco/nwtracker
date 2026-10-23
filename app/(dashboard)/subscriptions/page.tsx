"use client"

import { useEffect, useRef, useState } from "react"
import { CreditCard } from "lucide-react"
import {
  SubscriptionCard,
  type SubscriptionWithFiles,
} from "@/components/subscriptions/SubscriptionCard"
import { SubscriptionForm } from "@/components/subscriptions/SubscriptionForm"
import { Card } from "@/components/ui/Card"
import { Skeleton } from "@/components/ui/Skeleton"
import { activeMonthlyTotal } from "@/lib/subscriptions-math"

type FormMode = { kind: "create" } | { kind: "edit"; subscriptionId: string }
type StatusFilter = "all" | "active" | "cancelled"

function formatGbp(value: number): string {
  return (
    "£" +
    value.toLocaleString("en-GB", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  )
}

function OverviewStat({
  label,
  value,
  suffix,
}: {
  label: string
  value: string
  suffix?: string
}) {
  return (
    <Card className="flex flex-col gap-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
        {label}
      </span>
      <p className="flex items-baseline gap-2">
        <span className="font-display text-5xl font-medium tracking-tight text-text tabular-nums sm:text-6xl">
          {value}
        </span>
        {suffix ? (
          <span className="text-sm text-muted sm:text-base">{suffix}</span>
        ) : null}
      </p>
    </Card>
  )
}

export default function SubscriptionsPage() {
  const [items, setItems] = useState<SubscriptionWithFiles[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<FormMode | null>(null)
  const [filter, setFilter] = useState<StatusFilter>("all")
  const formRef = useRef<HTMLDivElement>(null)

  const editingItem =
    formMode && formMode.kind === "edit"
      ? items.find((item) => item.subscription.id === formMode.subscriptionId) ?? null
      : null

  async function fetchSubscriptions() {
    try {
      setError(null)
      const res = await fetch("/api/subscriptions")
      if (!res.ok) throw new Error("Failed to load subscriptions")
      const data = (await res.json()) as SubscriptionWithFiles[]
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete subscription")
      setItems((prev) => prev.filter((item) => item.subscription.id !== id))
      if (formMode && formMode.kind === "edit" && formMode.subscriptionId === id) {
        setFormMode(null)
      }
    } catch (err) {
      console.error("Delete subscription error:", err)
    }
  }

  useEffect(() => {
    void fetchSubscriptions()
  }, [])

  useEffect(() => {
    if (formMode) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [formMode])

  function closeFormAndRefresh() {
    setFormMode(null)
    void fetchSubscriptions()
  }

  const rows = items.map((item) => item.subscription)
  const activeCount = rows.filter((row) => row.status === "active").length
  const monthlyTotal = activeMonthlyTotal(rows)
  const visibleItems = (
    filter === "all"
      ? items
      : items.filter((item) => item.subscription.status === filter)
  ).slice()
    .sort((a, b) => {
      const aCancelled = a.subscription.status === "cancelled" ? 1 : 0
      const bCancelled = b.subscription.status === "cancelled" ? 1 : 0
      return aCancelled - bCancelled
    })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-3xl font-medium tracking-tight text-text">
          Subscriptions
        </h1>
        {!formMode && (
          <button
            onClick={() => setFormMode({ kind: "create" })}
            className="bg-accent text-bg-base rounded-lg px-4 py-2 text-sm hover:bg-accent-hover transition-colors"
          >
            + Add Subscription
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OverviewStat label="Total per month" value={String(activeCount)} />
          <OverviewStat
            label="Total cost"
            value={formatGbp(monthlyTotal)}
            suffix="/ month"
          />
        </div>
      )}

      {formMode && (
        <div ref={formRef} className="rounded-2xl border border-border bg-bg-card p-5">
          <h2 className="mb-4 text-base font-semibold text-text">
            {formMode.kind === "create" ? "Add Subscription" : "Edit Subscription"}
          </h2>
          <SubscriptionForm
            key={formMode.kind === "create" ? "new" : formMode.subscriptionId}
            initial={
              editingItem
                ? {
                    id: editingItem.subscription.id,
                    name: editingItem.subscription.name,
                    costGbp: editingItem.subscription.costGbp,
                    billingCycle: editingItem.subscription.billingCycle,
                    nextRenewalDate: editingItem.subscription.nextRenewalDate,
                    category: editingItem.subscription.category,
                    status: editingItem.subscription.status,
                    notes: editingItem.subscription.notes,
                    files: editingItem.files,
                  }
                : undefined
            }
            onSuccess={closeFormAndRefresh}
            onCancel={() => setFormMode(null)}
          />
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="flex gap-1">
          {(["all", "active", "cancelled"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize transition-colors ${
                filter === value
                  ? "bg-accent/10 text-text"
                  : "text-muted hover:bg-bg-hover hover:text-text"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-bg-card" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-negative/40 bg-negative/10 p-4 text-sm text-negative">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && !formMode && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-bg-card py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/20">
            <CreditCard className="text-accent" size={28} />
          </div>
          <div>
            <p className="font-semibold text-text">Add your first subscription</p>
            <p className="mt-1 text-sm text-muted">
              Track Netflix, gym, software, and anything else you pay for regularly.
            </p>
          </div>
          <button
            onClick={() => setFormMode({ kind: "create" })}
            className="bg-accent text-bg-base rounded-lg px-4 py-2 text-sm hover:bg-accent-hover transition-colors"
          >
            Add Subscription
          </button>
        </div>
      )}

      {!loading && !error && items.length > 0 && visibleItems.length === 0 && (
        <p className="text-sm text-muted">No {filter} subscriptions.</p>
      )}

      {!loading && !error && visibleItems.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleItems.map((item) => (
            <SubscriptionCard
              key={item.subscription.id}
              item={item}
              onEdit={() =>
                setFormMode({ kind: "edit", subscriptionId: item.subscription.id })
              }
              onDelete={() => handleDelete(item.subscription.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
