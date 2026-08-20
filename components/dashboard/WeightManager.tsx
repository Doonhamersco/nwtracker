"use client";

import { useState } from "react";
import { Sparkline } from "@/components/metrics/Sparkline";

export interface WeightReading {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
  snapshotId: string;
}

interface WeightManagerProps {
  readings: WeightReading[];
  onReadingsChange: (readings: WeightReading[]) => void;
}

interface WeightFormData {
  date: string;
  weightKg: number;
}

function WeightForm({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (data: WeightFormData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const weightKg = parseFloat(weight);
    if (isNaN(weightKg) || weightKg <= 0) {
      setError("Please enter a valid weight.");
      return;
    }
    setError(null);
    await onSave({ date, weightKg });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-muted mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full bg-bg-hover border border-border-strong rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs text-muted mb-1.5">Weight (kg)</label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            step="0.1"
            min="1"
            max="500"
            placeholder="e.g. 80.5"
            required
            className="w-full bg-bg-hover border border-border-strong rounded-lg px-3 py-2 text-sm font-mono text-text placeholder-placeholder focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>
      {error && <p className="text-xs text-negative">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-accent text-bg-base text-sm font-medium px-3 py-2 rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Log Weight"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-sm text-muted hover:text-text transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function WeightManager({ readings, onReadingsChange }: WeightManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const sorted = [...readings].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0] ?? null;
  const previous = sorted[1] ?? null;
  const delta = latest && previous ? latest.weightKg - previous.weightKg : null;
  const sparkData = [...readings]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => r.weightKg);

  async function handleAdd(data: WeightFormData) {
    setSaving(true);
    try {
      const res = await fetch("/api/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to log weight");
      const created: WeightReading = await res.json();
      onReadingsChange(
        [...readings.filter((r) => r.date !== created.date), created].sort((a, b) =>
          a.date.localeCompare(b.date)
        )
      );
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncHevy() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/hevy/sync-weights", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      const { synced } = await res.json();
      const refreshed = await fetch("/api/weight").then((r) => r.json());
      onReadingsChange(refreshed);
      setSyncMsg(`Synced ${synced} reading${synced !== 1 ? "s" : ""} from Hevy`);
      setTimeout(() => setSyncMsg(null), 4000);
    } catch (err) {
      console.error(err);
      setSyncMsg("Sync failed");
      setTimeout(() => setSyncMsg(null), 4000);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/weight/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete reading");
      onReadingsChange(readings.filter((r) => r.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          onClick={handleSyncHevy}
          disabled={syncing}
          className="text-xs text-muted hover:text-accent disabled:opacity-50 transition-colors"
        >
          {syncing ? "Syncing…" : "Sync from Hevy"}
        </button>
        {syncMsg && <span className="text-xs text-muted">{syncMsg}</span>}
      </div>

      {latest ? (
        <div>
          <p className="font-display text-4xl font-medium tracking-tight text-text">
            {latest.weightKg.toFixed(1)}{" "}
            <span className="text-lg text-muted">kg</span>
          </p>
          {delta !== null && (
            <p className={`mt-1 text-sm ${delta <= 0 ? "text-accent" : "text-muted"}`}>
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)} kg since last log
            </p>
          )}
        </div>
      ) : (
        !showAddForm && <p className="text-sm text-muted">No weight logs yet.</p>
      )}

      {sparkData.length > 1 && (
        <div className="h-16">
          <Sparkline data={sparkData} color="#c5a059" height={64} />
        </div>
      )}

      {showHistory && sorted.length > 0 && (
        <div className="space-y-1">
          {sorted.slice(0, 6).map((r) => (
            <div key={r.id} className="group flex items-center gap-3 rounded-lg py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm tabular-nums text-text">{r.weightKg} kg</p>
                <p className="text-xs text-placeholder">
                  {new Date(r.date + "T12:00:00").toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={() => handleDelete(r.id)}
                disabled={deletingId === r.id}
                className="rounded-md p-1.5 text-placeholder opacity-100 transition-colors hover:text-negative md:opacity-0 md:group-hover:opacity-100 disabled:opacity-50"
                title="Delete"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddForm ? (
        <div className="rounded-xl bg-bg-hover p-3">
          <WeightForm
            onSave={handleAdd}
            onCancel={() => setShowAddForm(false)}
            saving={saving}
          />
        </div>
      ) : (
        <div className="mt-auto flex flex-wrap items-center gap-4">
          {sorted.length > 0 && (
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="text-sm text-accent transition-colors hover:text-accent-hover"
            >
              {showHistory ? "Hide history" : "View progress →"}
            </button>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm text-accent transition-colors hover:text-accent-hover"
          >
            Log weight →
          </button>
        </div>
      )}
    </div>
  );
}
