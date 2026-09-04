"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Compass, Landmark, PiggyBank, Vault } from "lucide-react"
import { Card } from "@/components/ui/Card"
import { gbp, pct } from "@/components/plan/money"
import {
  plannedPathFromZero,
  projectCareer,
  serviceYearsElapsed,
  type CareerPlanAssumptions,
} from "@/lib/engine/career-projection"
import type { PlanActuals, PlanPayload } from "@/lib/plan-types"

const inputClass =
  "w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
const labelClass = "block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide"

function compactGbp(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "£0"
  if (Math.abs(value) >= 1000) return `£${Math.round(value / 1000)}k`
  return gbp(value)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function PlanClient() {
  const [payload, setPayload] = useState<PlanPayload | null>(null)
  const [draft, setDraft] = useState<CareerPlanAssumptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAllCashflow, setShowAllCashflow] = useState(false)
  const [showAssumptions, setShowAssumptions] = useState(false)

  async function load() {
    try {
      setError(null)
      const res = await fetch("/api/plan")
      if (!res.ok) throw new Error("Failed to load plan")
      const data = (await res.json()) as PlanPayload
      setPayload(data)
      setDraft(data.assumptions)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const actuals: PlanActuals = payload?.actuals ?? {
    isaGbp: 0,
    sippGbp: 0,
    isaHistory: [],
    sippHistory: [],
  }

  const projection = useMemo(() => {
    if (!draft) return null
    return projectCareer(draft, { isaGbp: actuals.isaGbp, sippGbp: actuals.sippGbp }, todayIso())
  }, [draft, actuals.isaGbp, actuals.sippGbp])

  const planned = useMemo(() => {
    if (!draft) return []
    return plannedPathFromZero(draft)
  }, [draft])

  async function save() {
    if (!draft) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string; detail?: string }
        throw new Error(data.detail ?? data.error ?? "Failed to save")
      }
      const data = (await res.json()) as PlanPayload
      setPayload(data)
      setDraft(data.assumptions)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  function patchDraft(partial: Partial<CareerPlanAssumptions>) {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev))
  }

  if (loading || !draft || !projection) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-12 w-64 animate-pulse rounded-xl bg-bg-card" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-bg-card" />
          ))}
        </div>
      </div>
    )
  }

  const year30 = projection.years.find((y) => y.serviceYear === 30)
  const year10 = projection.years.find((y) => y.serviceYear === 10)
  const cashflowRows = showAllCashflow ? projection.cashflow : projection.cashflow.slice(0, 10)
  const year1cf = projection.cashflow[0]
  const year10cf = projection.cashflow[9]

  const chartData = projection.years.map((y) => {
    const plannedRow = planned.find((p) => p.serviceYear === y.serviceYear)
    return {
      year: y.serviceYear,
      age: y.age,
      isa: Math.round(y.isaPot),
      sipp: Math.round(y.sippPot),
      combined: Math.round(y.combinedLiquid),
      plannedIsa: plannedRow ? Math.round(plannedRow.isaPot) : null,
      plannedSipp: plannedRow ? Math.round(plannedRow.sippPot) : null,
    }
  })

  const actualDots = actuals.isaHistory.map((point) => ({
    year: Math.max(0, serviceYearsElapsed(draft.startDate, point.date)),
    actualIsa: Math.round(point.valueGbp),
  }))
  const sippDots = actuals.sippHistory.map((point) => ({
    year: Math.max(0, serviceYearsElapsed(draft.startDate, point.date)),
    actualSipp: Math.round(point.valueGbp),
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-text">Plan</h1>
          <p className="mt-1 text-sm text-muted">
            Police Scotland CARE pension, Stocks &amp; Shares ISA, and a SIPP that only
            shelters the Scottish 42% top-slice. Figures in today&apos;s money.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAssumptions((v) => !v)}
            className="self-start rounded-lg border border-border px-3 py-2 text-sm text-muted hover:bg-bg-card hover:text-text transition-colors"
          >
            {showAssumptions ? "Hide assumptions" : "Edit assumptions"}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="self-start bg-accent text-bg-base rounded-lg px-4 py-2 text-sm hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-negative/40 bg-negative/10 p-4 text-sm text-negative">
          {error}
        </div>
      )}

      {showAssumptions && (
        <Card>
          <h2 className="mb-4 text-base font-semibold text-text">Assumptions</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Training start">
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => patchDraft({ startDate: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Date of birth">
              <input
                type="date"
                value={draft.dateOfBirth}
                onChange={(e) => patchDraft({ dateOfBirth: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Normal pension age">
              <input
                type="number"
                value={draft.npa}
                onChange={(e) => patchDraft({ npa: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="SIPP access age">
              <input
                type="number"
                value={draft.sippAccessAge}
                onChange={(e) => patchDraft({ sippAccessAge: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Police contribution">
              <input
                type="number"
                step="0.0001"
                value={draft.policeContributionRate}
                onChange={(e) => patchDraft({ policeContributionRate: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Accrual divisor (CARE)">
              <input
                type="number"
                step="0.1"
                value={draft.accrualDivisor}
                onChange={(e) => patchDraft({ accrualDivisor: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Scottish higher-rate threshold">
              <input
                type="number"
                value={draft.scottishHigherRateThreshold}
                onChange={(e) =>
                  patchDraft({ scottishHigherRateThreshold: Number(e.target.value) })
                }
                className={inputClass}
              />
            </Field>
            <Field label="ISA £ / month">
              <input
                type="number"
                value={draft.isaMonthlyGbp}
                onChange={(e) => patchDraft({ isaMonthlyGbp: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Expected real return">
              <input
                type="number"
                step="0.005"
                value={draft.expectedRealReturn}
                onChange={(e) => patchDraft({ expectedRealReturn: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Commutation factor">
              <input
                type="number"
                step="0.1"
                value={draft.commutationFactor}
                onChange={(e) => patchDraft({ commutationFactor: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Years to project">
              <input
                type="number"
                value={draft.projectionYears}
                onChange={(e) => patchDraft({ projectionYears: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className={labelClass}>Constable pay scale (one annual salary per year, then holds)</label>
              <textarea
                value={draft.payScale.join("\n")}
                onChange={(e) => {
                  const payScale = e.target.value
                    .split(/[\n,]+/)
                    .map((s) => Number(s.trim()))
                    .filter((n) => Number.isFinite(n) && n > 0)
                  if (payScale.length > 0) patchDraft({ payScale })
                }}
                rows={4}
                className={inputClass + " resize-y font-mono"}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="bg-accent text-bg-base rounded-lg px-4 py-2 text-sm hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save assumptions"}
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-3 flex items-center gap-2 text-accent">
            <Landmark size={18} />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Police pension
            </h2>
          </div>
          <p className="font-display text-3xl text-text">
            {gbp(year30?.policeAccruedAnnual ?? 0)}
            <span className="ml-1 text-base text-muted">/ year at 60</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            CARE 1/{draft.accrualDivisor} of each year&apos;s pay, CPI-protected. Payable from{" "}
            {draft.npa}; reduced from 55.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-bg-base p-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Full income</p>
              <p className="mt-1 font-mono text-text">{gbp(year30?.policeAccruedAnnual ?? 0)}/yr</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Or commute 25%</p>
              <p className="mt-1 font-mono text-text">
                {gbp(projection.commute.lumpSum)} + {gbp(projection.commute.reducedAnnual)}/yr
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2 text-accent">
            <PiggyBank size={18} />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Stocks &amp; Shares ISA
            </h2>
          </div>
          <p className="font-display text-3xl text-text">{gbp(year30?.isaPot ?? 0)}</p>
          <p className="mt-1 text-sm text-muted">
            Projected at year {draft.projectionYears} (age {year30?.age ?? "—"}). Actual now{" "}
            {gbp(actuals.isaGbp)}. Accessible anytime.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="£ / month">
              <input
                type="number"
                value={draft.isaMonthlyGbp}
                onChange={(e) => patchDraft({ isaMonthlyGbp: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Real return">
              <input
                type="number"
                step="0.005"
                value={draft.expectedRealReturn}
                onChange={(e) => patchDraft({ expectedRealReturn: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">{pct(draft.expectedRealReturn)} assumed real return</p>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2 text-accent">
            <Vault size={18} />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">SIPP top-slice</h2>
          </div>
          <p className="font-display text-3xl text-text">{gbp(year30?.sippPot ?? 0)}</p>
          <p className="mt-1 text-sm text-muted">
            Only the taxable pay above {gbp(draft.scottishHigherRateThreshold)} after the{" "}
            {pct(draft.policeContributionRate)} police contribution. Unlocks at {draft.sippAccessAge}.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-bg-base p-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Year 10 SIPP</p>
              <p className="mt-1 font-mono text-text">{gbp(year10cf?.sippMonthly ?? 0)}/mo</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">25% PCLS at {draft.sippAccessAge}</p>
              <p className="mt-1 font-mono text-text">{gbp(projection.sippPclsAtAccess)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">Actual now {gbp(actuals.sippGbp)}</p>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Compass size={16} className="text-accent" />
          <h2 className="text-base font-semibold text-text">Where this path goes</h2>
        </div>
        <div className="h-96 w-full min-w-0 px-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 22, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="var(--nw-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="year"
                type="number"
                domain={["dataMin", "dataMax"]}
                ticks={chartData.map((d) => d.year)}
                interval={0}
                tick={{ fill: "var(--nw-muted)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `£${Math.round(v / 1000)}k`}
                tick={{ fill: "var(--nw-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                cursor={{ stroke: "var(--nw-muted)", strokeDasharray: "3 3" }}
                contentStyle={{
                  background: "var(--nw-bg-card)",
                  border: "1px solid var(--nw-border)",
                  borderRadius: 12,
                }}
                formatter={(value, name) => [
                  gbp(typeof value === "number" ? value : Number(value) || 0),
                  String(name),
                ]}
                labelFormatter={(label) => `Year ${String(label)}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="isa"
                name="ISA"
                stroke="#d4b978"
                strokeWidth={2}
                dot={{ r: 3, fill: "#d4b978", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              >
                <LabelList
                  dataKey="isa"
                  position="top"
                  offset={6}
                  formatter={(value) => compactGbp(typeof value === "number" ? value : Number(value))}
                  style={{ fill: "#d4b978", fontSize: 9, fontFamily: "ui-monospace, monospace" }}
                />
              </Line>
              <Line
                type="monotone"
                dataKey="sipp"
                name="SIPP"
                stroke="#8a9bb0"
                strokeWidth={2}
                dot={{ r: 3, fill: "#8a9bb0", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              >
                <LabelList
                  dataKey="sipp"
                  position="bottom"
                  offset={6}
                  formatter={(value) => compactGbp(typeof value === "number" ? value : Number(value))}
                  style={{ fill: "#8a9bb0", fontSize: 9, fontFamily: "ui-monospace, monospace" }}
                />
              </Line>
              <Scatter data={actualDots} dataKey="actualIsa" name="ISA actual" fill="#d4b978" />
              <Scatter data={sippDots} dataKey="actualSipp" name="SIPP actual" fill="#8a9bb0" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-base">
                {["Year", "Age", "Police £/yr", "ISA pot", "SIPP pot", "Combined"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projection.years.map((row) => (
                <tr key={row.serviceYear} className="hover:bg-bg-hover">
                  <td className="px-4 py-2.5 text-text">{row.serviceYear}</td>
                  <td className="px-4 py-2.5 text-muted">{row.age}</td>
                  <td className="px-4 py-2.5 font-mono text-text">{gbp(row.policeAccruedAnnual)}</td>
                  <td className="px-4 py-2.5 font-mono text-text">{gbp(row.isaPot)}</td>
                  <td className="px-4 py-2.5 font-mono text-text">{gbp(row.sippPot)}</td>
                  <td className="px-4 py-2.5 font-mono text-text">{gbp(row.combinedLiquid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">Monthly cashflow</h2>
            <p className="text-xs text-muted">
              Year 1 take-home {year1cf ? gbp(year1cf.takeHomeMonthly) : "—"}
              {year10cf ? ` · Year 10 ${gbp(year10cf.takeHomeMonthly)} after SIPP top-slice` : ""}
              {year10 ? ` · gross ${gbp(year10.grossAnnual)}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAllCashflow((v) => !v)}
            className="self-start text-xs text-muted hover:text-text"
          >
            {showAllCashflow ? "Show first 10 years" : "Show all years"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-y border-border bg-bg-base">
                {["Year", "Age", "Gross", "Police contrib", "SIPP", "Take-home", "ISA standing order"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cashflowRows.map((row) => (
                <tr key={row.serviceYear} className="hover:bg-bg-hover">
                  <td className="px-4 py-3 text-text">{row.serviceYear}</td>
                  <td className="px-4 py-3 text-muted">{row.age}</td>
                  <td className="px-4 py-3 font-mono text-muted">{gbp(row.grossAnnual)}</td>
                  <td className="px-4 py-3 font-mono text-text">{gbp(row.policeMonthly)}/mo</td>
                  <td className="px-4 py-3 font-mono text-text">{gbp(row.sippMonthly)}/mo</td>
                  <td className="px-4 py-3 font-mono text-text">{gbp(row.takeHomeMonthly)}/mo</td>
                  <td className="px-4 py-3 font-mono text-muted">{gbp(row.isaMonthly)}/mo</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  )
}
