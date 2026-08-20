"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/Badge"

export interface AccountWithHistory {
  id: string
  name: string
  type: "ASSET" | "LIABILITY"
  category: string
  currencyCode: string
  institution: string | null
  currentNative: number | null
  currentGbp: number | null
  momChange: number | null
  threeMonthChange: number | null
}

interface AssetsClientProps {
  accounts: AccountWithHistory[]
  lastSnapshotDate: string | null
}

function fmt(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value)
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[#94A3B8] text-xs">—</span>
  const sign = value >= 0 ? "▲" : "▼"
  const color = value >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
  return (
    <span className={`font-mono text-sm ${color}`}>
      {sign} £{Math.abs(value).toLocaleString("en-GB", { maximumFractionDigits: 0 })}
    </span>
  )
}

function Section({
  title,
  accounts,
  color,
}: {
  title: string
  accounts: AccountWithHistory[]
  color: string
}) {
  if (accounts.length === 0) return null
  return (
    <>
      <tr>
        <td
          colSpan={6}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider`}
          style={{ color, backgroundColor: `${color}10` }}
        >
          {title}
        </td>
      </tr>
      {accounts
        .slice()
        .sort((a, b) => (b.currentGbp ?? 0) - (a.currentGbp ?? 0))
        .map((acc) => (
          <tr
            key={acc.id}
            className="border-b border-[#222222] hover:bg-[#1a1a1a] transition-colors"
          >
            <td className="px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[#F1F5F9]">{acc.name}</p>
                {acc.institution && (
                  <p className="text-xs text-[#94A3B8]">{acc.institution}</p>
                )}
              </div>
            </td>
            <td className="px-4 py-3">
              <Badge variant="neutral">{acc.category}</Badge>
            </td>
            <td className="px-4 py-3 text-xs text-[#94A3B8] font-mono text-right">
              {acc.currencyCode !== "GBP" && acc.currentNative !== null
                ? `${acc.currentNative.toFixed(6)} ${acc.currencyCode}`
                : "—"}
            </td>
            <td className="px-4 py-3 text-right">
              <span
                className={`font-mono text-sm font-medium ${
                  acc.type === "LIABILITY" ? "text-[#EF4444]" : "text-[#F1F5F9]"
                }`}
              >
                {acc.currentGbp !== null
                  ? (acc.type === "LIABILITY" ? "-" : "") + fmt(acc.currentGbp)
                  : "—"}
              </span>
            </td>
            <td className="px-4 py-3 text-right">
              <Change value={acc.momChange} />
            </td>
            <td className="px-4 py-3 text-right">
              <Change value={acc.threeMonthChange} />
            </td>
          </tr>
        ))}
    </>
  )
}

export function AssetsClient({ accounts, lastSnapshotDate }: AssetsClientProps) {
  const assets = accounts.filter((a) => a.type === "ASSET")
  const liabilities = accounts.filter((a) => a.type === "LIABILITY")

  const totalAssets = assets.reduce((s, a) => s + (a.currentGbp ?? 0), 0)
  const totalLiabilities = liabilities.reduce((s, a) => s + (a.currentGbp ?? 0), 0)
  const netWorth = totalAssets - totalLiabilities

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F5F9]">Assets &amp; Liabilities</h1>
          {lastSnapshotDate && (
            <p className="mt-1 text-sm text-[#94A3B8]">
              Last updated:{" "}
              {new Date(lastSnapshotDate).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Assets", value: totalAssets, color: "#22C55E" },
          { label: "Total Liabilities", value: totalLiabilities, color: "#EF4444" },
          { label: "Net Worth", value: netWorth, color: "#22c55e" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-[#222222] bg-[#111111] p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
              {label}
            </p>
            <p className="mt-2 text-2xl font-bold" style={{ color }}>
              {fmt(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-10 text-center text-sm text-[#94A3B8]">
          No accounts yet. Add your first account in Settings.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#222222] bg-[#111111]">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-[#222222]">
                {["Account", "Category", "Native", "GBP Value", "MoM Δ", "3M Δ"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8] text-left last:text-right [&:nth-child(n+3)]:text-right"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Section title="Assets" accounts={assets} color="#22C55E" />
              <Section title="Liabilities" accounts={liabilities} color="#EF4444" />
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
