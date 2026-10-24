import { addDays, CARDIO_RUNS_PER_WEEK, weekStart, londonToday } from "@/lib/training/dates";
import type {
  BestEffort,
  CardioSummary,
  OnTrackStatus,
  PaceTrend,
  RecentRun,
  WeekPace,
} from "@/lib/training/types";
import type { NormalizedEffort, NormalizedRun, NormalizedSplit } from "./normalize";

const MILE_METERS = 1609.344;
const ONE_POINT_FIVE_MILE_METERS = MILE_METERS * 1.5;
const FIVE_K_METERS = 5000;
/** Fraction of the third kilometre needed to reach 1.5 miles (2.414 km). */
const KM_SPLIT_FRACTION = (ONE_POINT_FIVE_MILE_METERS - 2000) / 1000;

export const MIN_EFFORT_DISTANCE_METERS = ONE_POINT_FIVE_MILE_METERS * 0.97;
const PACE_CHANGE_SECONDS = 2;

function within(distance: number, target: number, tolerance: number): boolean {
  if (distance <= 0) return false;
  const ratio = distance / target;
  return ratio >= 1 - tolerance && ratio <= 1 + tolerance;
}

export function isTimeTrialDistance(meters: number): boolean {
  return within(meters, ONE_POINT_FIVE_MILE_METERS, 0.03) || within(meters, FIVE_K_METERS, 0.02);
}

function scaledTime(
  distanceMeters: number,
  movingTimeSeconds: number,
  targetMeters: number,
  tolerance: number,
): number | null {
  if (!within(distanceMeters, targetMeters, tolerance) || movingTimeSeconds <= 0) return null;
  return movingTimeSeconds * (targetMeters / distanceMeters);
}

function isFiveKEffort(effort: NormalizedEffort): boolean {
  const name = effort.name.trim();
  if (/^5\s?k(m)?$/i.test(name)) return true;
  return within(effort.distanceMeters, FIVE_K_METERS, 0.01) && /5\s?k/i.test(name);
}

function isOnePointFiveEffort(effort: NormalizedEffort): boolean {
  return /1\.5\s?-?\s?(mile|mi)\b/i.test(effort.name);
}

function fullSplit(split: NormalizedSplit, expectedMeters: number): boolean {
  return (
    split.movingTimeSeconds > 0 &&
    split.distanceMeters >= expectedMeters * 0.95 &&
    split.distanceMeters <= expectedMeters * 1.05
  );
}

/** Fastest 1.5 miles estimated from 1 km splits. Even pace is assumed on the partial kilometre. */
export function estimateOnePointFiveFromKmSplits(splits: NormalizedSplit[]): number | null {
  let best: number | null = null;
  for (let i = 0; i + 2 < splits.length; i++) {
    const first = splits[i];
    const second = splits[i + 1];
    const third = splits[i + 2];
    if (!fullSplit(first, 1000) || !fullSplit(second, 1000) || !fullSplit(third, 1000)) continue;
    const time = first.movingTimeSeconds + second.movingTimeSeconds + KM_SPLIT_FRACTION * third.movingTimeSeconds;
    if (best == null || time < best) best = time;
  }
  return best;
}

/** Fastest 1.5 miles estimated from mile splits. Even pace is assumed on the half mile. */
export function estimateOnePointFiveFromMileSplits(splits: NormalizedSplit[]): number | null {
  let best: number | null = null;
  for (let i = 0; i + 1 < splits.length; i++) {
    const first = splits[i];
    const second = splits[i + 1];
    if (!fullSplit(first, MILE_METERS) || !fullSplit(second, MILE_METERS)) continue;
    const time = first.movingTimeSeconds + 0.5 * second.movingTimeSeconds;
    if (best == null || time < best) best = time;
  }
  return best;
}

function paceEligible(run: NormalizedRun): boolean {
  return run.sport !== "trail" && run.distanceMeters >= 1000;
}

function weightedPace(runs: NormalizedRun[], minRuns: number): number | null {
  const eligible = runs.filter(paceEligible);
  if (eligible.length < minRuns) return null;
  const distance = eligible.reduce((sum, run) => sum + run.distanceMeters, 0);
  const time = eligible.reduce((sum, run) => sum + run.movingTimeSeconds, 0);
  if (distance <= 0) return null;
  return time / (distance / 1000);
}

function pickFaster(current: BestEffort | null, next: BestEffort | null): BestEffort | null {
  if (!current) return next;
  if (!next) return current;
  return next.timeSeconds < current.timeSeconds ? next : current;
}

function bestMeasured(
  runs: NormalizedRun[],
  kind: "5k" | "1.5",
): BestEffort | null {
  let best: BestEffort | null = null;
  for (const run of runs) {
    if (run.sport === "trail") continue;
    if (kind === "5k") {
      const fromActivity = scaledTime(run.distanceMeters, run.movingTimeSeconds, FIVE_K_METERS, 0.02);
      if (fromActivity != null) {
        best = pickFaster(best, { timeSeconds: fromActivity, date: run.date, source: "activity" });
      }
      for (const effort of run.efforts) {
        if (!isFiveKEffort(effort)) continue;
        best = pickFaster(best, {
          timeSeconds: effort.elapsedTimeSeconds,
          date: run.date,
          source: "best_effort",
        });
      }
    } else {
      const fromActivity = scaledTime(
        run.distanceMeters,
        run.movingTimeSeconds,
        ONE_POINT_FIVE_MILE_METERS,
        0.03,
      );
      if (fromActivity != null) {
        best = pickFaster(best, { timeSeconds: fromActivity, date: run.date, source: "activity" });
      }
      for (const effort of run.efforts) {
        if (!isOnePointFiveEffort(effort)) continue;
        best = pickFaster(best, {
          timeSeconds: effort.elapsedTimeSeconds,
          date: run.date,
          source: "best_effort",
        });
      }
    }
  }
  return best;
}

function bestOnePointFiveFromSplits(runs: NormalizedRun[]): BestEffort | null {
  let best: BestEffort | null = null;
  for (const run of runs) {
    if (run.sport === "trail") continue;
    const fromKm = estimateOnePointFiveFromKmSplits(run.kmSplits);
    const estimated = fromKm ?? estimateOnePointFiveFromMileSplits(run.mileSplits);
    if (estimated == null) continue;
    best = pickFaster(best, { timeSeconds: estimated, date: run.date, source: "splits" });
  }
  return best;
}

function onTrackStatus(runsLast7Days: number): OnTrackStatus {
  if (runsLast7Days >= CARDIO_RUNS_PER_WEEK) return "on_track";
  if (runsLast7Days >= 1) return "building";
  return "off_track";
}

function paceTrend(runs: NormalizedRun[], today: string): PaceTrend {
  const recentStart = addDays(today, -27);
  const previousEnd = addDays(today, -28);
  const previousStart = addDays(today, -55);
  const recent = weightedPace(
    runs.filter((run) => run.date >= recentStart && run.date <= today),
    2,
  );
  const previous = weightedPace(
    runs.filter((run) => run.date >= previousStart && run.date <= previousEnd),
    2,
  );
  if (recent == null || previous == null) {
    return {
      direction: "insufficient",
      recentSecPerKm: recent,
      previousSecPerKm: previous,
      deltaSecPerKm: null,
    };
  }
  const delta = recent - previous;
  const direction = delta <= -PACE_CHANGE_SECONDS ? "faster" : delta >= PACE_CHANGE_SECONDS ? "slower" : "steady";
  return {
    direction,
    recentSecPerKm: recent,
    previousSecPerKm: previous,
    deltaSecPerKm: delta,
  };
}

function weeklySeries(runs: NormalizedRun[], today: string): WeekPace[] {
  const thisWeek = weekStart(today);
  const weeks: WeekPace[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 6);
    const inWeek = runs.filter((run) => run.date >= start && run.date <= end);
    const distanceMeters = inWeek.reduce((sum, run) => sum + run.distanceMeters, 0);
    weeks.push({
      weekStart: start,
      paceSecPerKm: weightedPace(inWeek, 1),
      distanceKm: distanceMeters / 1000,
      sessions: inWeek.length,
    });
  }
  return weeks;
}

function recentRuns(runs: NormalizedRun[]): RecentRun[] {
  return [...runs]
    .sort((a, b) => (a.startLocal < b.startLocal ? 1 : a.startLocal > b.startLocal ? -1 : b.id - a.id))
    .slice(0, 5)
    .map((run) => ({
      id: run.id,
      name: run.name,
      date: run.date,
      sport: run.sport,
      distanceKm: run.distanceMeters / 1000,
      paceSecPerKm: run.movingTimeSeconds / (run.distanceMeters / 1000),
      movingTimeSeconds: run.movingTimeSeconds,
    }));
}

export function summarizeCardio(runs: NormalizedRun[], now: Date): CardioSummary {
  const today = londonToday(now);
  const weeks = weeklySeries(runs, today);
  const current = weeks[weeks.length - 1];
  const last7Start = addDays(today, -6);
  const runsLast7Days = runs.filter((run) => run.date >= last7Start && run.date <= today).length;

  return {
    weeklyDistanceKm: current?.distanceKm ?? 0,
    weeklySessions: current?.sessions ?? 0,
    weekStart: current?.weekStart ?? weekStart(today),
    runsLast7Days,
    onTrack: onTrackStatus(runsLast7Days),
    targetRunsPerWeek: CARDIO_RUNS_PER_WEEK,
    paceTrend: paceTrend(runs, today),
    weeklyPace: weeks,
    recentRuns: recentRuns(runs),
    bestOnePointFiveMile: bestMeasured(runs, "1.5") ?? bestOnePointFiveFromSplits(runs),
    bestFiveK: bestMeasured(runs, "5k"),
  };
}

export function formatPace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}/km`;
}

export function formatRaceTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function formatKm(km: number): string {
  return km.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
