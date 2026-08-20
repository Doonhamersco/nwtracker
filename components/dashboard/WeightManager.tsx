"use client";

import { useState } from "react";

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
          <label className="block text-xs text-[#94A3B8] mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full bg-[#1C1C1E] border border-[#333333] rounded-lg px-3 py-2 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#6366f1] transition-colors"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs text-[#94A3B8] mb-1.5">Weight (kg)</label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            step="0.1"
            min="1"
            max="500"
            placeholder="e.g. 80.5"
            required
            className="w-full bg-[#1C1C1E] border border-[#333333] rounded-lg px-3 py-2 text-sm font-mono text-[#F1F5F9] placeholder-[#4B5563] focus:outline-none focus:border-[#6366f1] transition-colors"
          />
        </div>
      </div>
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-[#6366f1] text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-[#4f46e5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Log Weight"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-sm text-[#94A3B8] hover:text-[#F1F5F9] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function WeightManager({ readings, onReadingsChange }: WeightManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Show the 8 most recent readings
  const recentReadings = [...readings]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={handleSyncHevy}
          disabled={syncing}
          className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:text-[#818cf8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={syncing ? "animate-spin" : ""}
          >
            <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.36-2.64" />
            <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.36 2.64" />
            <polyline points="21 3 21 9 15 9" />
            <polyline points="3 21 3 15 9 15" />
          </svg>
          {syncing ? "Syncing…" : "Sync from Hevy"}
        </button>
        {syncMsg && (
          <span className="text-xs text-[#94A3B8]">{syncMsg}</span>
        )}
      </div>

      {readings.length === 0 && !showAddForm && (
        <p className="text-xs text-[#4B5563] italic">
          No weight logs yet. Log your first entry to see it on the chart.
        </p>
      )}

      <div className="space-y-1">
        {recentReadings.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 group px-3 py-2 rounded-xl hover:bg-[#1C1C1E] transition-colors"
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: "#6366f1" }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#F1F5F9] font-mono">{r.weightKg} kg</p>
              <p className="text-xs text-[#4B5563]">
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
              className="p-1.5 text-[#4B5563] hover:text-[#EF4444] transition-colors rounded-md hover:bg-[#222222] opacity-0 group-hover:opacity-100 disabled:opacity-50"
              title="Delete"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>
        ))}
        {readings.length > 8 && (
          <p className="text-xs text-[#4B5563] px-3 py-1">
            +{readings.length - 8} more entries
          </p>
        )}
      </div>

      {showAddForm ? (
        <div className="bg-[#1C1C1E] border border-[#333333] rounded-xl p-3">
          <WeightForm
            onSave={handleAdd}
            onCancel={() => setShowAddForm(false)}
            saving={saving}
          />
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-[#333333] text-sm text-[#4B5563] hover:text-[#94A3B8] hover:border-[#555555] transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Log Weight
        </button>
      )}
    </div>
  );
}
