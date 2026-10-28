"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { formatMonthLabel } from "@/lib/spending/dates";
import {
  MANUAL_SPENDING_CATEGORIES,
  buildManualSpendingView,
  type ManualSpendingCategory,
  type ManualSpendingLineInput,
  type ManualSpendingTotalInput,
} from "@/lib/spending/manual";
import { formatGbp } from "@/lib/spending/money";

export function ManualSpendingClient({
  month,
  totals,
  lines,
  persist = true,
  basePath = "/spending",
}: {
  month: string;
  totals: ManualSpendingTotalInput[];
  lines: ManualSpendingLineInput[];
  persist?: boolean;
  basePath?: string;
}) {
  const router = useRouter();
  const [local, setLocal] = useState<{
    month: string;
    totals: ManualSpendingTotalInput[];
    lines: ManualSpendingLineInput[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = persist || !local ? { month, totals, lines } : local;

  const view = buildManualSpendingView(active);
  const delta = view.totalGbp - view.previousTotalGbp;

  function selectMonth(next: string) {
    setError(null);
    if (!persist) {
      setLocal({ month: next, totals: active.totals, lines: active.lines });
      return;
    }
    router.push(`${basePath}?month=${encodeURIComponent(next)}`);
  }

  async function saveTotals(draft: Record<ManualSpendingCategory, string>) {
    const amounts = MANUAL_SPENDING_CATEGORIES.map((category) => ({
      category,
      amountGbp: parseAmount(draft[category]),
    }));
    if (amounts.some((row) => row.amountGbp === null)) {
      setError("Enter an amount in pounds for each category. Use 0 if Chase shows nothing.");
      return;
    }
    setError(null);
    if (!persist) {
      const others = active.totals.filter((row) => row.month !== active.month);
      setLocal({
        month: active.month,
        lines: active.lines,
        totals: [
          ...others,
          ...amounts.map((row) => ({
            month: active.month,
            category: row.category,
            amountGbp: row.amountGbp ?? 0,
          })),
        ],
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/spending/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: active.month, amounts }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Failed to save spending");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function addLine(input: { date: string; category: ManualSpendingCategory; amountGbp: number; note: string }) {
    setError(null);
    if (!persist) {
      const nextLines = [
        ...active.lines,
        {
          id: `local-${active.lines.length + 1}`,
          date: input.date,
          category: input.category,
          amountGbp: input.amountGbp,
          note: input.note.trim() || null,
        },
      ];
      setLocal({
        month: input.date.slice(0, 7),
        totals: active.totals,
        lines: nextLines,
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/spending/manual/lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Failed to add expense");
        return;
      }
      const lineMonth = input.date.slice(0, 7);
      if (lineMonth !== active.month) {
        router.push(`${basePath}?month=${encodeURIComponent(lineMonth)}`);
      } else {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeLine(id: string) {
    setError(null);
    if (!persist) {
      setLocal({
        month: active.month,
        totals: active.totals,
        lines: active.lines.filter((line) => line.id !== id),
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/spending/manual/lines/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Failed to delete expense");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-text">Spending</h1>
          <p className="mt-1 text-sm text-muted">
            {formatMonthLabel(view.month)} · copy the totals from Chase, then edit them any time
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted">
          Month
          <input
            type="month"
            aria-label="Spending month"
            value={active.month}
            onChange={(event) => {
              if (event.target.value) selectMonth(event.target.value);
            }}
            className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm normal-case tracking-normal text-text focus:border-accent focus:outline-none"
          />
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Monthly total</p>
          <p className="mt-2 font-display text-4xl font-medium tabular-nums text-text">
            {formatGbp(view.totalGbp)}
          </p>
          <p className={`mt-2 text-sm ${delta > 0 ? "text-negative" : "text-positive"}`}>
            {delta > 0 ? "+" : ""}
            {formatGbp(delta)} since {formatMonthLabel(view.previousMonth)}
          </p>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="font-display text-xl font-medium text-text">Month on month</h2>
          <MonthTrendChart trend={view.trend} />
        </Card>
      </div>

      <CategoryForm
        key={view.month}
        categories={view.categories}
        saving={saving}
        onSave={(draft) => void saveTotals(draft)}
      />

      <CategoryBreakdown categories={view.categories} />

      <LinesEditor
        key={view.month}
        lines={view.lines}
        month={view.month}
        saving={saving}
        onAdd={(input) => void addLine(input)}
        onDelete={(id) => void removeLine(id)}
      />
    </div>
  );
}

function CategoryForm({
  categories,
  saving,
  onSave,
}: {
  categories: ManualSpendingViewCategories;
  saving: boolean;
  onSave: (draft: Record<ManualSpendingCategory, string>) => void;
}) {
  const [draft, setDraft] = useState<Record<ManualSpendingCategory, string>>(() =>
    Object.fromEntries(
      categories.map((row) => [row.category, row.enteredGbp ? String(row.enteredGbp) : ""])
    ) as Record<ManualSpendingCategory, string>
  );

  return (
    <Card>
      <h2 className="font-display text-xl font-medium text-text">Category totals</h2>
      <p className="mt-1 text-sm text-muted">One figure per category for this month. Saving replaces the figures for this month only.</p>
      <form
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        {categories.map((row) => (
          <label key={row.category} className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted">
            {row.category}
            <input
              aria-label={`${row.category} amount`}
              inputMode="decimal"
              value={draft[row.category]}
              placeholder="0.00"
              onChange={(event) =>
                setDraft((current) => ({ ...current, [row.category]: event.target.value }))
              }
              className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm normal-case tracking-normal text-text focus:border-accent focus:outline-none"
            />
          </label>
        ))}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-base transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save month"}
          </button>
        </div>
      </form>
    </Card>
  );
}

type ManualSpendingViewCategories = ReturnType<typeof buildManualSpendingView>["categories"];

function CategoryBreakdown({ categories }: { categories: ManualSpendingViewCategories }) {
  const max = Math.max(...categories.map((row) => row.totalGbp), 1);
  return (
    <Card>
      <h2 className="font-display text-xl font-medium text-text">By category</h2>
      <ul className="mt-4 space-y-3">
        {categories.map((row) => (
          <li key={row.category}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-text">{row.category}</span>
              <span className="tabular-nums text-muted">{formatGbp(row.totalGbp)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-hover">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${row.totalGbp === 0 ? 0 : Math.max(4, (row.totalGbp / max) * 100)}%` }}
              />
            </div>
            {row.linesGbp > 0 && (
              <p className="mt-1 text-xs text-muted">
                Includes {formatGbp(row.linesGbp)} from individual expenses
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MonthTrendChart({ trend }: { trend: ReturnType<typeof buildManualSpendingView>["trend"] }) {
  const data = trend.map((point) => ({
    ...point,
    label: formatMonthLabel(point.month).slice(0, 3),
    title: formatMonthLabel(point.month),
  }));
  return (
    <div className="mt-3 h-36 w-full" role="img" aria-label="Spending total for each of the last 12 months.">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fill: "var(--nw-muted)", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: "var(--nw-border)" }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const point = payload[0]?.payload as (typeof data)[number] | undefined;
              if (!point) return null;
              return (
                <div className="rounded-lg border border-border bg-bg-card px-2.5 py-1.5 text-xs">
                  <p className="text-muted">{point.title}</p>
                  <p className="font-mono tabular-nums text-text">{formatGbp(point.totalGbp)}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="totalGbp" fill="var(--nw-accent)" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LinesEditor({
  lines,
  month,
  saving,
  onAdd,
  onDelete,
}: {
  lines: ReturnType<typeof buildManualSpendingView>["lines"];
  month: string;
  saving: boolean;
  onAdd: (input: { date: string; category: ManualSpendingCategory; amountGbp: number; note: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [date, setDate] = useState(`${month}-01`);
  const [category, setCategory] = useState<ManualSpendingCategory>(MANUAL_SPENDING_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  return (
    <Card>
      <h2 className="font-display text-xl font-medium text-text">Individual expenses</h2>
      <p className="mt-1 text-sm text-muted">Optional. Each line is added to its category for the month of the date.</p>
      <form
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          const amountGbp = parseAmount(amount);
          if (amountGbp === null || amountGbp <= 0 || !date) return;
          onAdd({ date, category, amountGbp, note });
          setAmount("");
          setNote("");
        }}
      >
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted">
          Date
          <input
            type="date"
            required
            aria-label="Expense date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm normal-case tracking-normal text-text focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted">
          Category
          <select
            aria-label="Expense category"
            value={category}
            onChange={(event) => setCategory(event.target.value as ManualSpendingCategory)}
            className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm normal-case tracking-normal text-text focus:border-accent focus:outline-none"
          >
            {MANUAL_SPENDING_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted">
          Amount
          <input
            required
            inputMode="decimal"
            aria-label="Expense amount"
            value={amount}
            placeholder="0.00"
            onChange={(event) => setAmount(event.target.value)}
            className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm normal-case tracking-normal text-text focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted lg:col-span-1">
          Note
          <input
            aria-label="Expense note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm normal-case tracking-normal text-text focus:border-accent focus:outline-none"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text transition-colors hover:bg-bg-hover disabled:opacity-60"
          >
            Add line
          </button>
        </div>
      </form>
      {lines.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No individual expenses this month.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {lines.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-text">
                  {line.category}
                  {line.note ? ` · ${line.note}` : ""}
                </p>
                <p className="text-xs text-muted">{line.date}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-sm text-text">{formatGbp(line.amountGbp)}</span>
                <button
                  type="button"
                  onClick={() => onDelete(line.id)}
                  className="text-xs text-muted transition-colors hover:text-negative"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const amount = Number(trimmed.replace(/£/g, "").replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}
