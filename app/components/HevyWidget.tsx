"use client";

import { useEffect, useState } from "react";
import type { HevyStats } from "@/lib/hevy/types";

const GYM_SESSION_GOAL = 12;

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function VolumeChart({ data }: { data: HevyStats["recent_volume"] }) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-zinc-500 text-center py-4">No workouts in the last 30 days</p>
    );
  }

  const max = Math.max(...data.map((d) => d.total_volume_kg), 1);

  return (
    <div className="flex items-end gap-0.5 h-16 w-full" aria-label="30-day volume chart">
      {data.map((d) => (
        <div
          key={d.date}
          title={`${d.date}: ${d.total_volume_kg.toLocaleString()} kg`}
          className="flex-1 rounded-t bg-emerald-500 opacity-80 hover:opacity-100 transition-opacity min-w-0"
          style={{ height: `${Math.max(4, (d.total_volume_kg / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  accent = false,
  danger = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  danger?: boolean;
}) {
  const colorClass = danger
    ? "text-red-400"
    : accent
    ? "text-emerald-400"
    : "text-zinc-100";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
      <span className={`text-xl font-semibold ${colorClass}`}>{value}</span>
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

type Status = "idle" | "loading" | "ok" | "error";

export default function HevyWidget() {
  const [stats, setStats] = useState<HevyStats | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setStatus("loading");
    fetch("/api/hevy/stats")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to load Hevy stats");
        return json as HevyStats;
      })
      .then((data) => {
        setStats(data);
        setStatus("ok");
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      });
  }, []);

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏋️</span>
          <h2 className="text-sm font-semibold text-zinc-200 tracking-wide uppercase">
            Hevy Workouts
          </h2>
        </div>
        {status === "loading" && (
          <span className="text-xs text-zinc-500 animate-pulse">Loading…</span>
        )}
        {status === "ok" && stats?.last_workout_at && (
          <span className="text-xs text-zinc-500">
            Last:{" "}
            {new Date(stats.last_workout_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })}
          </span>
        )}
      </div>

      {/* Error state */}
      {status === "error" && (
        <div className="rounded-lg bg-red-950/40 border border-red-900/60 px-3 py-2 text-xs text-red-400">
          {errorMsg.includes("HEVY_API_KEY")
            ? "Add your HEVY_API_KEY to .env.local to connect Hevy."
            : errorMsg}
        </div>
      )}

      {/* Stats grid */}
      {status === "ok" && stats && (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <StatPill label="Total" value={stats.total_workouts.toLocaleString()} accent />
            <StatPill label="This week" value={stats.workouts_this_week} />
            <StatPill
              label="This month"
              value={`${stats.workouts_this_month} / ${GYM_SESSION_GOAL}`}
              danger={stats.workouts_this_month < GYM_SESSION_GOAL}
            />
            <StatPill label="Avg duration" value={`${stats.avg_duration_minutes}m`} />
          </div>

          {stats.latest_weight_kg != null && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="text-zinc-500">Weight</span>
              <span className="text-zinc-100 font-medium">
                {stats.latest_weight_kg.toFixed(1)} kg
              </span>
              {stats.latest_weight_date && (
                <span className="text-zinc-600 text-xs">
                  (
                  {new Date(stats.latest_weight_date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                  )
                </span>
              )}
            </div>
          )}

          {/* 30-day volume chart */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500 uppercase tracking-wide">
              30-day volume (kg lifted)
            </span>
            <VolumeChart data={stats.recent_volume} />
          </div>
        </>
      )}

      {/* Skeleton */}
      {status === "loading" && (
        <div className="flex flex-col gap-3 animate-pulse">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 rounded bg-zinc-800" />
            ))}
          </div>
          <div className="h-16 rounded bg-zinc-800" />
        </div>
      )}
    </div>
  );
}
