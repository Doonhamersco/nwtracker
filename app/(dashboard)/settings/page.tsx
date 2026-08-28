"use client"

import { useEffect, useState, Suspense } from "react"
import { Card } from "@/components/ui/Card"
import { AddAccountForm } from "@/components/settings/AddAccountForm"
import { BrandMark } from "@/components/layout/BrandMark"
import { Download, Key, Database, Info, Plus, User } from "lucide-react"
import { ProfileForm } from "@/components/settings/ProfileForm"
import { useRouter, useSearchParams } from "next/navigation"

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

type TabId = "profile" | "accounts" | "api" | "export" | "about"

const TABS = [
  { id: "profile" as const, label: "Profile", icon: User },
  { id: "accounts" as const, label: "Accounts", icon: Database },
  { id: "api" as const, label: "API Keys", icon: Key },
  { id: "export" as const, label: "Export", icon: Download },
  { id: "about" as const, label: "About", icon: Info },
]

function isTabId(value: string | null): value is TabId {
  return TABS.some((t) => t.id === value)
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-bg-card" />}>
      <SettingsPageInner />
    </Suspense>
  )
}

function SettingsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [hevyStatus, setHevyStatus] = useState<HevyStatus>("loading")
  const [activeTab, setActiveTab] = useState<TabId>(isTabId(tabParam) ? tabParam : "profile")

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

  useEffect(() => {
    if (isTabId(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [tabParam, activeTab])

  function selectTab(id: TabId) {
    setActiveTab(id)
    router.replace(`/settings?tab=${id}`, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight text-text">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Manage profile, accounts, API keys, and data exports
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-bg-card p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => selectTab(id)}
            className={`flex min-h-11 items-center gap-2 flex-1 justify-center rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === id
                ? "bg-accent text-bg-base"
                : "text-muted hover:text-text hover:bg-bg-hover"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "profile" && <ProfileForm />}

      {/* Accounts section */}
      {activeTab === "accounts" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-text">Accounts</h2>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 self-start bg-accent text-bg-base rounded-lg px-3 py-2 text-sm hover:bg-accent-hover transition-colors"
            >
              <Plus size={14} />
              Add Account
            </button>
          </div>

          {showAddForm && (
            <Card>
              <h3 className="mb-4 font-medium text-text">New Account</h3>
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
                  <div key={i} className="h-8 animate-pulse rounded bg-border" />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No accounts yet.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-base">
                    {["Account", "Type", "Category", "Currency", "Status", "Actions"].map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted ${
                          h === "Actions" ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-bg-hover transition-colors">
                      <td className="px-4 py-3 font-medium text-text">
                        <div>{acc.name}</div>
                        {acc.institution && (
                          <div className="text-xs text-muted">{acc.institution}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">{acc.type}</td>
                      <td className="px-4 py-3 text-muted">{acc.category}</td>
                      <td className="px-4 py-3 text-muted">{acc.currencyCode}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            acc.isActive
                              ? "bg-positive/20 text-positive"
                              : "bg-muted/20 text-muted"
                          }`}
                        >
                          {acc.isActive ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {acc.isActive ? (
                          <button
                            onClick={() => handleArchive(acc.id)}
                            className="text-xs text-muted hover:text-negative transition-colors"
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(acc.id)}
                            className="text-xs text-muted hover:text-positive transition-colors"
                          >
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* API Keys section */}
      {activeTab === "api" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-text">API Keys</h2>

          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-text">Hevy API Key</h3>
                  <p className="mt-1 text-sm text-muted">
                    Connect your Hevy account to sync workout data automatically.
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Get your key at{" "}
                    <a
                      href="https://hevy.com/settings?developer"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      hevy.com/settings?developer
                    </a>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hevyStatus === "loading" && (
                    <span className="text-xs text-muted animate-pulse">Checking…</span>
                  )}
                  {hevyStatus === "connected" && (
                    <span className="rounded-full bg-positive/20 px-2.5 py-1 text-xs font-medium text-positive">
                      ✓ Connected
                    </span>
                  )}
                  {hevyStatus === "unconfigured" && (
                    <span className="rounded-full bg-muted/20 px-2.5 py-1 text-xs font-medium text-muted">
                      Not configured
                    </span>
                  )}
                  {hevyStatus === "error" && (
                    <span className="rounded-full bg-negative/20 px-2.5 py-1 text-xs font-medium text-negative">
                      Error
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-bg-base px-3 py-2">
                <code className="text-xs text-muted">
                  HEVY_API_KEY=••••••••••••••••
                </code>
              </div>
              <p className="text-xs text-muted">
                API keys are stored as environment variables and cannot be edited from the UI.
                Update <code className="rounded bg-border px-1 py-0.5 text-text">.env.local</code> and
                restart the server to change them.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Export section */}
      {activeTab === "export" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-text">Data Export</h2>

          <Card>
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="font-medium text-text">Export your data</h3>
                <p className="mt-1 text-sm text-muted">
                  Full data export including all snapshots, valuations, and FX rates.
                  Your data is stored locally in SQLite — export it any time for backup or migration.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => triggerDownload("/api/export/json", "nwtracker-export.json")}
                  className="flex items-center gap-2 bg-accent text-bg-base rounded-lg px-4 py-2 text-sm hover:bg-accent-hover transition-colors"
                >
                  <Download size={14} />
                  Export JSON
                </button>
                <button
                  onClick={() => triggerDownload("/api/export/csv", "nwtracker-export.csv")}
                  className="flex items-center gap-2 border border-border text-text rounded-lg px-4 py-2 text-sm hover:bg-bg-card transition-colors"
                >
                  <Download size={14} />
                  Export CSV
                </button>
              </div>

              <p className="text-xs text-muted border-t border-border pt-3">
                Note: Export endpoints must be implemented by your backend. If they return 404, the export routes may not have been set up yet.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* About section */}
      {activeTab === "about" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-text">About</h2>

          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <BrandMark size="sm" />
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-bg-base p-3">
                  <p className="text-xs text-muted uppercase tracking-wide">Stack</p>
                  <p className="mt-1 text-text">Next.js 16 · TypeScript · SQLite</p>
                </div>
                <div className="rounded-lg border border-border bg-bg-base p-3">
                  <p className="text-xs text-muted uppercase tracking-wide">Storage</p>
                  <p className="mt-1 text-text">Local SQLite on your server</p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-bg-base p-4 text-sm text-muted">
                <p className="font-medium text-text mb-2">Migration</p>
                <p>
                  Data is stored in a SQLite file alongside the application. To migrate, copy the{" "}
                  <code className="rounded bg-border px-1 py-0.5 text-text">nwtracker.db</code>{" "}
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
