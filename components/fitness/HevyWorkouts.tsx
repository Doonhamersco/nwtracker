"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { workoutVolumeKg } from "@/lib/hevy/metrics";
import type { HevyWorkout, WorkoutsResponse } from "@/lib/hevy/types";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function durationLabel(start: string, end: string): string {
  const minutes = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000),
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function exerciseLine(workout: HevyWorkout): string {
  const titles = workout.exercises.map((exercise) => exercise.title);
  if (titles.length <= 3) return titles.join(" · ");
  return `${titles.slice(0, 3).join(" · ")} · +${titles.length - 3}`;
}

export function HevyWorkouts({ initial }: { initial?: HevyWorkout[] }) {
  const [workouts, setWorkouts] = useState<HevyWorkout[] | null>(initial ?? null);
  const [status, setStatus] = useState<"loading" | "ok" | "empty" | "unconfigured" | "error">(
    initial ? (initial.length > 0 ? "ok" : "empty") : "loading",
  );

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    fetch("/api/hevy/workouts?page=1&pageSize=8")
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as WorkoutsResponse & { error?: string };
        if (!res.ok) {
          const message = json.error ?? "";
          if (message.includes("HEVY_API_KEY") || message.includes("not configured")) {
            return "unconfigured" as const;
          }
          return "error" as const;
        }
        return json.workouts ?? [];
      })
      .then((result) => {
        if (cancelled) return;
        if (result === "unconfigured" || result === "error") {
          setStatus(result);
          return;
        }
        setWorkouts(result);
        setStatus(result.length > 0 ? "ok" : "empty");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  return (
    <Card className="flex flex-col">
      <h2 className="font-display text-xl font-medium text-text">Workouts</h2>
      <p className="mt-1 text-sm text-muted">Recent sessions from Hevy.</p>

      {status === "loading" && (
        <div className="mt-5 animate-pulse space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-12 rounded bg-border" />
          ))}
        </div>
      )}

      {status === "unconfigured" && (
        <p className="mt-5 text-sm text-muted">
          Hevy is not connected.{" "}
          <Link href="/settings?tab=api" className="text-accent hover:text-accent-hover">
            Add an API key
          </Link>
          .
        </p>
      )}

      {status === "error" && (
        <p className="mt-5 text-sm text-negative">Hevy workouts are unavailable right now.</p>
      )}

      {status === "empty" && <p className="mt-5 text-sm text-muted">No workouts yet.</p>}

      {status === "ok" && workouts && (
        <ul className="mt-3 divide-y divide-border">
          {workouts.map((workout) => {
            const volume = Math.round(workoutVolumeKg(workout));
            return (
              <li key={workout.id} className="flex items-baseline justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text">{workout.title}</p>
                  <p className="truncate text-xs text-muted">
                    {formatWhen(workout.start_time)}
                    {workout.exercises.length > 0 ? ` · ${exerciseLine(workout)}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm text-text">
                    {volume.toLocaleString("en-GB")} kg
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {durationLabel(workout.start_time, workout.end_time)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
