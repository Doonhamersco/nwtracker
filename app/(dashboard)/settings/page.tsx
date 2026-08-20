"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/Card"
import { AddAccountForm } from "@/components/settings/AddAccountForm"
import { Download, Key, Database, Info, Plus } from "lucide-react"

interface AccountRow {
  id: string
  name: string
  type: string
  category: string
  currencyCode: string
  institution: string | null
  isActive: boolean
}

type HevyStatus = "loading" | "connected" | "error" | "unconfigured"

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [hevyStatus, setHevyStatus] = useState<HevyStatus>("loading")
  const [activeTab, setActiveTab] = useState<"accounts" | "api" | "export" | "about">("accounts")

  async function fetchAccounts() {
    try {
      const res = await fetch("/api/accounts?includeInactive=true")
      if (!res.ok) throw new Error("Failed to load accounts")
      const data = (await res.json()) as AccountRow[]
      setAccounts(data)
    } catch {
      // ignore — show empty state
    } finally {
      setAccountsLoading(false)
    }
  }

  async function checkHevyStatus() {
    try {
      const res = await fetch("/api/hevy/stats")
      if (res.ok) {
        setHevyStatus("connected")
      } else {
        const data = (await res.json()) as { error?: string }
        const msg = data.error ?? ""
        if (msg.includes("HEVY_API_KEY") || msg.includes("not configured")) {
          setHevyStatus("unconfigured")
        } else {
          setHevyStatus("error")
        }
      }
    } catch {
      setHevyStatus("error")
    }
  }

  async function handleArchive(id: string) {
    await fetch(`/api/accounts/${id}`, { method: "DELETE" })
    await fetchAccounts()
  }

  async function handleActivate(id: string) {
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    })
    await fetchAccounts()
  }

  function triggerDownload(url: string, filename: string) {
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
  }

  useEffect(() => {
    void fetchAccounts()
    void checkHevyStatus()
  }, [])

  const TABS = [
    { id: "accounts" as const, label: "Accounts", icon: Database },
    { id: "api" as const, label: "API Keys", icon: Key },
    { id: "export" as const, label: "Export", icon: Download },
    { id: "about" as const, label: "About", icon: Info },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Settings</h1>
        <p className="mt-1 text-sm text-[#94A3B8]">
          Manage accounts, API keys, and data exports
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-[#222222] bg-[#111111] p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 flex-1 justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === id
                ? "bg-[#22c55e] text-white"
                : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1a1a1a]"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Accounts section */}
      {activeTab === "accounts" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#F1F5F9]">Accounts</h2>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 bg-[#22c55e] text-white rounded-lg px-3 py-2 text-sm hover:bg-[#16a34a] transition-colors"
            >
              <Plus size={14} />
              Add Account
            </button>
          </div>

          {showAddForm && (
            <Card>
              <h3 className="mb-4 font-medium text-[#F1F5F9]">New Account</h3>
              <AddAccountForm
                onSuccess={() => {
                  setShowAddForm(false)
                  void fetchAccounts()
                }}
                onCancel={() => setShowAddForm(false)}
              />
            </Card>
          )}

          <Card className="p-0 overflow-hidden">
            {accountsLoading ? (
              <div className="flex flex-col gap-2 p-5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-[#222222]" />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#94A3B8]">No accounts yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#222222] bg-[#0a0a0a]">
                    {["Account", "Type", "Category", "Currency", "Status", "Actions"].map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-xs font-medium uppercase tracking-wide text-[#94A3B8] ${
                          h === "Actions" ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222]">
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-[#1a1a1a] transition-colors">
                      <td className="px-4 py-3 font-medium text-[#F1F5F9]">
                        <div>{acc.name}</div>
                        {acc.institution && (
                          <div className="text-xs text-[#94A3B8]">{acc.institution}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#94A3B8]">{acc.type}</td>
                      <td className="px-4 py-3 text-[#94A3B8]">{acc.category}</td>
                      <td className="px-4 py-3 text-[#94A3B8]">{acc.currencyCode}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            acc.isActive
                              ? "bg-[#22C55E]/20 text-[#22C55E]"
                              : "bg-[#94A3B8]/20 text-[#94A3B8]"
                          }`}
                        >
                          {acc.isActive ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {acc.isActive ? (
                          <button
                            onClick={() => handleArchive(acc.id)}
                            className="text-xs text-[#94A3B8] hover:text-[#EF4444] transition-colors"
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(acc.id)}
                            className="text-xs text-[#94A3B8] hover:text-[#22C55E] transition-colors"
                          >
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* API Keys section */}
      {activeTab === "api" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-[#F1F5F9]">API Keys</h2>

          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-[#F1F5F9]">Hevy API Key</h3>
                  <p className="mt-1 text-sm text-[#94A3B8]">
                    Connect your Hevy account to sync workout data automatically.
                  </p>
                  <p className="mt-1 text-xs text-[#94A3B8]">
                    Get your key at{" "}
                    <a
                      href="https://hevy.com/settings?developer"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#22c55e] hover:underline"
                    >
                      hevy.com/settings?developer
                    </a>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hevyStatus === "loading" && (
                    <span className="text-xs text-[#94A3B8] animate-pulse">Checking…</span>
                  )}
                  {hevyStatus === "connected" && (
                    <span className="rounded-full bg-[#22C55E]/20 px-2.5 py-1 text-xs font-medium text-[#22C55E]">
                      ✓ Connected
                    </span>
                  )}
                  {hevyStatus === "unconfigured" && (
                    <span className="rounded-full bg-[#94A3B8]/20 px-2.5 py-1 text-xs font-medium text-[#94A3B8]">
                      Not configured
                    </span>
                  )}
                  {hevyStatus === "error" && (
                    <span className="rounded-full bg-[#EF4444]/20 px-2.5 py-1 text-xs font-medium text-[#EF4444]">
                      Error
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] px-3 py-2">
                <code className="text-xs text-[#94A3B8]">
                  HEVY_API_KEY=••••••••••••••••
                </code>
              </div>
              <p className="text-xs text-[#94A3B8]">
                API keys are stored as environment variables and cannot be edited from the UI.
                Update <code className="rounded bg-[#222222] px-1 py-0.5 text-[#F1F5F9]">.env.local</code> and
                restart the server to change them.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Export section */}
      {activeTab === "export" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-[#F1F5F9]">Data Export</h2>

          <Card>
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="font-medium text-[#F1F5F9]">Export your data</h3>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  Full data export including all snapshots, valuations, and FX rates.
                  Your data is stored locally in SQLite — export it any time for backup or migration.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => triggerDownload("/api/export/json", "nwtracker-export.json")}
                  className="flex items-center gap-2 bg-[#22c55e] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#16a34a] transition-colors"
                >
                  <Download size={14} />
                  Export JSON
                </button>
                <button
                  onClick={() => triggerDownload("/api/export/csv", "nwtracker-export.csv")}
                  className="flex items-center gap-2 border border-[#222222] text-[#F1F5F9] rounded-lg px-4 py-2 text-sm hover:bg-[#111111] transition-colors"
                >
                  <Download size={14} />
                  Export CSV
                </button>
              </div>

              <p className="text-xs text-[#94A3B8] border-t border-[#222222] pt-3">
                Note: Export endpoints must be implemented by your backend. If they return 404, the export routes may not have been set up yet.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* About section */}
      {activeTab === "about" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-[#F1F5F9]">About</h2>

          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#22c55e]">
                  <span className="text-lg font-bold text-white">N</span>
                </div>
                <div>
                  <h3 className="font-semibold text-[#F1F5F9]">NW Tracker</h3>
                  <p className="text-xs text-[#94A3B8]">Personal net worth & life metrics tracker</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3">
                  <p className="text-xs text-[#94A3B8] uppercase tracking-wide">Stack</p>
                  <p className="mt-1 text-[#F1F5F9]">Next.js 16 · TypeScript · SQLite</p>
                </div>
                <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-3">
                  <p className="text-xs text-[#94A3B8] uppercase tracking-wide">Storage</p>
                  <p className="mt-1 text-[#F1F5F9]">Local SQLite on your server</p>
                </div>
              </div>

              <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4 text-sm text-[#94A3B8]">
                <p className="font-medium text-[#F1F5F9] mb-2">Migration</p>
                <p>
                  Data is stored in a SQLite file alongside the application. To migrate, copy the{" "}
                  <code className="rounded bg-[#222222] px-1 py-0.5 text-[#F1F5F9]">nwtracker.db</code>{" "}
                  file to your new server, or use the JSON export above to move your data.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
