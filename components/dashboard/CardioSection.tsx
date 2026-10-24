"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatKm, formatPace, formatRaceTime } from "@/lib/strava/metrics";
import { daysUntil, FITNESS_TEST_DATE, FITNESS_TEST_LABEL, londonToday } from "@/lib/training/dates";
import type {
  BestEffort,
  CardioSummary,
  OnTrackStatus,
  PaceTrend,
  TrainingPayload,
  WeekPace,
} from "@/lib/training/types";

function formatShortDate(iso: string, withYear = false): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

function countdownCopy(days: number): { value: string; label: string } {
  if (days > 1) return { value: String(days), label: "days to go" };
  if (days === 1) return { value: "1", label: "day to go" };
  if (days === 0) return { value: "Today", label: "fitness test" };
  const ago = Math.abs(days);
  return { value: String(ago), label: ago === 1 ? "day since the test" : "days since the test" };
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium tabular-nums text-text">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function trendHint(trend: PaceTrend): string {
  if (trend.direction === "insufficient" || trend.deltaSecPerKm == null) {
    return "Need two road or treadmill runs in each of the last two 4-week blocks";
  }
  const seconds = Math.abs(Math.round(trend.deltaSecPerKm));
  if (trend.direction === "steady") return "In line with the previous 4 weeks";
  const word = trend.direction === "faster" ? "faster" : "slower";
  return `${seconds}s/km ${word} than the previous 4 weeks`;
}

function effortHint(effort: BestEffort | null, empty: string): string {
  if (!effort) return empty;
  const source =
    effort.source === "activity"
      ? "Time trial"
      : effort.source === "best_effort"
        ? "Strava best effort"
        : "Estimated from splits";
  return `${source} · ${formatShortDate(effort.date)}`;
}

function statusVariant(status: OnTrackStatus): "positive" | "neutral" | "negative" {
  if (status === "on_track") return "positive";
  if (status === "building") return "neutral";
  return "negative";
}

function statusLabel(status: OnTrackStatus): string {
  if (status === "on_track") return "On track";
  if (status === "building") return "Building";
  return "Off track";
}

function sportLabel(sport: CardioSummary["recentRuns"][number]["sport"]): string | null {
  if (sport === "trail") return "Trail";
  if (sport === "virtual") return "Treadmill";
  return null;
}

function PaceChart({ weeks }: { weeks: WeekPace[] }) {
  const known = weeks.filter((week) => week.paceSecPerKm != null);
  if (known.length < 2) {
    return <p className="text-xs text-muted">Not enough weeks of road pace yet.</p>;
  }

  const width = 560;
  const height = 72;
  const pad = 8;
  const paces = known.map((week) => week.paceSecPerKm ?? 0);
  const min = Math.min(...paces);
  const max = Math.max(...paces);
  const span = Math.max(max - min, 8);
  const step = (width - pad * 2) / Math.max(weeks.length - 1, 1);
  const points = weeks.flatMap((week, index) => {
    if (week.paceSecPerKm == null) return [];
    return [
      {
        weekStart: week.weekStart,
        x: pad + index * step,
        y: pad + ((max - week.paceSecPerKm) / span) * (height - pad * 2),
      },
    ];
  });
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Weekly pace</p>
        <p className="text-xs text-muted">Lower is faster</p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-16 w-full text-accent"
        role="img"
        aria-label="Weekly average pace over the last eight weeks. Lower is faster."
      >
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((point) => (
          <circle key={point.weekStart} cx={point.x} cy={point.y} r="3" className="fill-accent" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-placeholder">
        <span>{formatShortDate(weeks[0]?.weekStart ?? "")}</span>
        <span>{formatShortDate(weeks[weeks.length - 1]?.weekStart ?? "")}</span>
      </div>
    </div>
  );
}

function SummaryBody({ summary }: { summary: CardioSummary }) {
  const sessionWord = summary.weeklySessions === 1 ? "run" : "runs";
  const recentWord = summary.runsLast7Days === 1 ? "run" : "runs";

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={statusVariant(summary.onTrack)}>{statusLabel(summary.onTrack)}</Badge>
        <p className="text-sm text-muted">
          {summary.runsLast7Days} {recentWord} in the last 7 days
          <span className="text-placeholder"> · target {summary.targetRunsPerWeek}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        <Stat
          label="This week"
          value={`${formatKm(summary.weeklyDistanceKm)} km`}
          hint={`${summary.weeklySessions} ${sessionWord}`}
        />
        <Stat
          label="Pace trend"
          value={summary.paceTrend.recentSecPerKm != null ? formatPace(summary.paceTrend.recentSecPerKm) : "—"}
          hint={trendHint(summary.paceTrend)}
        />
        <Stat
          label="Best 1.5 mi"
          value={
            summary.bestOnePointFiveMile ? formatRaceTime(summary.bestOnePointFiveMile.timeSeconds) : "—"
          }
          hint={effortHint(summary.bestOnePointFiveMile, "No 1.5-mile effort in the last 6 months")}
        />
        <Stat
          label="Best 5K"
          value={summary.bestFiveK ? formatRaceTime(summary.bestFiveK.timeSeconds) : "—"}
          hint={effortHint(summary.bestFiveK, "No 5K effort in the last 6 months")}
        />
      </div>

      <PaceChart weeks={summary.weeklyPace} />

      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Recent runs</p>
        {summary.recentRuns.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No runs in the last 6 months.</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {summary.recentRuns.map((run) => {
              const sport = sportLabel(run.sport);
              return (
                <li key={run.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text">{run.name}</p>
                    <p className="text-xs text-muted">
                      {formatShortDate(run.date)}
                      {sport ? ` · ${sport}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm text-text">{formatKm(run.distanceKm)} km</p>
                    <p className="font-mono text-xs text-muted">
                      {formatPace(run.paceSecPerKm)} · {formatRaceTime(run.movingTimeSeconds)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function HevyStrip({ hevy }: { hevy: TrainingPayload["hevy"] }) {
  if (!hevy.available) {
    if (hevy.reason === "error") {
      return <p className="mt-6 text-xs text-muted">Hevy training stats are unavailable right now.</p>;
    }
    return null;
  }

  const streak =
    hevy.streakDays === 0
      ? "0 days"
      : hevy.streakCapped
        ? `${hevy.streakDays}+ days`
        : `${hevy.streakDays} ${hevy.streakDays === 1 ? "day" : "days"}`;

  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Strength · Hevy</p>
      <div className="mt-3 grid grid-cols-3 gap-4">
        <Stat
          label="Streak"
          value={streak}
          hint={hevy.streakDays === 0 ? "No workout yesterday or today" : "Consecutive training days"}
        />
        <Stat
          label="Weekly volume"
          value={`${hevy.weeklyVolumeKg.toLocaleString("en-GB")} kg`}
        />
        <Stat label="Sessions" value={String(hevy.workoutsThisWeek)} hint="This week" />
      </div>
    </div>
  );
}

export function CardioSection({ initial }: { initial?: TrainingPayload }) {
  const [data, setData] = useState<TrainingPayload | null>(initial ?? null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">(initial ? "ok" : "loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    fetch("/api/training")
      .then(async (res) => {
        const json = (await res.json()) as TrainingPayload & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Could not load training");
        return json;
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setStatus("ok");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Could not load training");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const countdownDays =
    data?.countdownDays ?? daysUntil(londonToday(new Date()), FITNESS_TEST_DATE);
  const countdown = countdownCopy(countdownDays);
  const testDate = data?.testDate ?? FITNESS_TEST_DATE;

  return (
    <section
      aria-labelledby="cardio-heading"
      className="rounded-2xl border border-border bg-bg-card px-5 py-6 sm:px-8 sm:py-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">Training</p>
          <h2 id="cardio-heading" className="mt-1 font-display text-xl font-medium text-text">
            Cardio
          </h2>
          <p className="mt-1 text-sm text-muted">
            {FITNESS_TEST_LABEL} · {formatShortDate(testDate, true)}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="font-display text-4xl font-medium tabular-nums text-text">{countdown.value}</p>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">{countdown.label}</p>
        </div>
      </div>

      {status === "loading" && (
        <div className="mt-6 animate-pulse space-y-3">
          <div className="h-6 w-40 rounded bg-border" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-14 rounded bg-border" />
            ))}
          </div>
          <div className="h-16 rounded bg-border" />
        </div>
      )}

      {status === "error" && (
        <p className="mt-6 rounded-xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
          {errorMsg}
        </p>
      )}

      {status === "ok" && data && !data.strava.configured && (
        <p className="mt-6 rounded-xl border border-border bg-bg-base px-4 py-3 text-sm text-muted">
          Strava is not connected. Set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, and STRAVA_REFRESH_TOKEN
          with the activity:read_all scope. The countdown stays either way.
        </p>
      )}

      {status === "ok" && data && data.strava.configured && "error" in data.strava && (
        <p className="mt-6 rounded-xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
          {data.strava.error}
        </p>
      )}

      {status === "ok" && data && data.strava.configured && "summary" in data.strava && (
        <SummaryBody summary={data.strava.summary} />
      )}

      {status === "ok" && data && <HevyStrip hevy={data.hevy} />}
    </section>
  );
}
