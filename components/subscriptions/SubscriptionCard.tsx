"use client"

import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { monthlyEquivalent } from "@/lib/subscriptions-math"
import type {
  SubscriptionBillingCycle,
  SubscriptionCategory,
  SubscriptionStatus,
} from "@/db/schema"
import { billingCycleLabel, categoryLabel } from "./labels"

interface SubscriptionFile {
  id: string
  displayName: string
  mimeType: string
}

interface SubscriptionRow {
  id: string
  name: string
  costGbp: number
  billingCycle: SubscriptionBillingCycle
  nextRenewalDate: string | null
  category: SubscriptionCategory
  status: SubscriptionStatus
  notes: string | null
}

export interface SubscriptionWithFiles {
  subscription: SubscriptionRow
  files: SubscriptionFile[]
}

interface SubscriptionCardProps {
  item: SubscriptionWithFiles
  onEdit: () => void
  onDelete: () => void
}

function formatGbp(value: number): string {
  return (
    "£" +
    value.toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function SubscriptionCard({ item, onEdit, onDelete }: SubscriptionCardProps) {
  const { subscription, files = [] } = item
  const cancelled = subscription.status === "cancelled"
  const logo = files.find((f) => f.mimeType.startsWith("image/"))
  const monthly = monthlyEquivalent(subscription.costGbp, subscription.billingCycle)

  return (
    <Card className={`flex flex-col gap-4 ${cancelled ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-bg-base">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/files/${logo.id}`}
              alt={`${subscription.name} logo`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-display text-sm text-accent">
              {subscription.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-semibold text-text">{subscription.name}</h3>
            <Badge variant={cancelled ? "neutral" : "positive"}>
              {cancelled ? "Cancelled" : "Active"}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {formatGbp(subscription.costGbp)} / {billingCycleLabel(subscription.billingCycle).toLowerCase()}
            {subscription.billingCycle === "yearly" && (
              <span> · {formatGbp(monthly)} / month</span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="uppercase tracking-wide text-muted">Category</span>
          <span className="font-medium text-text">{categoryLabel(subscription.category)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="uppercase tracking-wide text-muted">Next renewal</span>
          <span className="font-medium text-text">
            {subscription.nextRenewalDate
              ? formatDate(subscription.nextRenewalDate)
              : "—"}
          </span>
        </div>
      </div>

      {subscription.notes && (
        <p className="line-clamp-2 text-sm text-muted">{subscription.notes}</p>
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
    </Card>
  )
}
