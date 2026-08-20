"use client";

import { useState } from "react";
import type { NotableEvent } from "./NetWorthChart";

interface NotableEventsManagerProps {
  events: NotableEvent[];
  onEventsChange: (events: NotableEvent[]) => void;
}

const QUICK_EMOJIS = [
  "⭐", "🎉", "💼", "🏠", "🚗", "✈️", "💒", "👶", "🎓", "💰",
  "📈", "📉", "🏋️", "🌍", "💔", "❤️", "🏆", "🎯", "🔑", "💡",
];

function EmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (emoji: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowPicker((p) => !p)}
        className="w-10 h-10 text-xl bg-[#1C1C1E] border border-[#333333] rounded-lg flex items-center justify-center hover:border-[#555555] transition-colors"
      >
        {value || "😀"}
      </button>
      {showPicker && (
        <div className="absolute z-50 top-12 left-0 bg-[#111111] border border-[#333333] rounded-xl p-2 shadow-2xl grid grid-cols-5 gap-1 w-48">
          {QUICK_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => {
                onChange(em);
                setShowPicker(false);
              }}
              className="w-8 h-8 text-base flex items-center justify-center hover:bg-[#222222] rounded-md transition-colors"
            >
              {em}
            </button>
          ))}
          {/* Also allow typing a custom emoji */}
          <input
            type="text"
            placeholder="✏️"
            maxLength={2}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="col-span-5 mt-1 bg-[#1C1C1E] border border-[#333333] rounded-md px-2 py-1 text-sm text-[#F1F5F9] placeholder-[#4B5563] focus:outline-none focus:border-[#22c55e]"
          />
        </div>
      )}
    </div>
  );
}

interface EventFormData {
  date: string;
  emoji: string;
  label: string;
}

function EventForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: EventFormData;
  onSave: (data: EventFormData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(initial?.date ?? today);
  const [emoji, setEmoji] = useState(initial?.emoji ?? "⭐");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setError("Please enter a label.");
      return;
    }
    setError(null);
    await onSave({ date, emoji, label: label.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-3">
        {/* Emoji picker */}
        <div className="shrink-0">
          <label className="block text-xs text-[#94A3B8] mb-1.5">Icon</label>
          <EmojiPicker value={emoji} onChange={setEmoji} />
        </div>
        {/* Date */}
        <div className="flex-1">
          <label className="block text-xs text-[#94A3B8] mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full bg-[#1C1C1E] border border-[#333333] rounded-lg px-3 py-2 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#22c55e] transition-colors"
          />
        </div>
      </div>
      {/* Label */}
      <div>
        <label className="block text-xs text-[#94A3B8] mb-1.5">Description</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Started new job"
          maxLength={200}
          required
          className="w-full bg-[#1C1C1E] border border-[#333333] rounded-lg px-3 py-2 text-sm text-[#F1F5F9] placeholder-[#4B5563] focus:outline-none focus:border-[#22c55e] transition-colors"
        />
      </div>
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-[#22c55e] text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Save Event"}
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

export function NotableEventsManager({
  events = [],
  onEventsChange,
}: NotableEventsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(data: EventFormData) {
    setSaving(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create event");
      const created: NotableEvent = await res.json();
      onEventsChange(
        [...events, created].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )
      );
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(id: string, data: EventFormData) {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update event");
      const updated: NotableEvent = await res.json();
      onEventsChange(
        events
          .map((ev) => (ev.id === id ? updated : ev))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      );
      setEditingId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete event");
      onEventsChange(events.filter((ev) => ev.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Event list */}
      {events.length === 0 && !showAddForm && (
        <p className="text-xs text-[#4B5563] italic">No events yet. Add one to mark milestones on the chart.</p>
      )}
      <div className="space-y-2">
        {events.map((ev) => (
          <div key={ev.id}>
            {editingId === ev.id ? (
              <div className="bg-[#1C1C1E] border border-[#333333] rounded-xl p-3">
                <EventForm
                  initial={{ date: ev.date, emoji: ev.emoji, label: ev.label }}
                  onSave={(data) => handleEdit(ev.id, data)}
                  onCancel={() => setEditingId(null)}
                  saving={saving}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 group px-3 py-2 rounded-xl hover:bg-[#1C1C1E] transition-colors">
                <span className="text-lg shrink-0">{ev.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#F1F5F9] truncate">{ev.label}</p>
                  <p className="text-xs text-[#4B5563]">
                    {new Date(ev.date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingId(ev.id);
                    }}
                    className="p-1.5 text-[#4B5563] hover:text-[#94A3B8] transition-colors rounded-md hover:bg-[#222222]"
                    title="Edit"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(ev.id)}
                    disabled={deletingId === ev.id}
                    className="p-1.5 text-[#4B5563] hover:text-[#EF4444] transition-colors rounded-md hover:bg-[#222222] disabled:opacity-50"
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
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAddForm ? (
        <div className="bg-[#1C1C1E] border border-[#333333] rounded-xl p-3">
          <EventForm
            onSave={handleAdd}
            onCancel={() => setShowAddForm(false)}
            saving={saving}
          />
        </div>
      ) : (
        <button
          onClick={() => {
            setEditingId(null);
            setShowAddForm(true);
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-[#333333] text-sm text-[#4B5563] hover:text-[#94A3B8] hover:border-[#555555] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Event
        </button>
      )}
    </div>
  );
}
