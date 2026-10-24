import { londonToday } from "@/lib/training/dates";
import type { RunSport } from "@/lib/training/types";

export interface RawSplit {
  distance?: number;
  moving_time?: number;
}

export interface RawEffort {
  name?: string;
  distance?: number;
  elapsed_time?: number;
  moving_time?: number;
}

/** Summary or detailed Strava activity. Extra fields are ignored. */
export interface RawStravaActivity {
  id?: number;
  name?: string;
  sport_type?: string;
  type?: string;
  start_date?: string;
  start_date_local?: string;
  distance?: number;
  moving_time?: number;
  best_efforts?: RawEffort[];
  splits_metric?: RawSplit[];
  splits_standard?: RawSplit[];
}

export interface NormalizedSplit {
  distanceMeters: number;
  movingTimeSeconds: number;
}

export interface NormalizedEffort {
  name: string;
  distanceMeters: number;
  elapsedTimeSeconds: number;
}

export interface NormalizedRun {
  id: number;
  name: string;
  sport: RunSport;
  date: string;
  startLocal: string;
  distanceMeters: number;
  movingTimeSeconds: number;
  efforts: NormalizedEffort[];
  kmSplits: NormalizedSplit[];
  mileSplits: NormalizedSplit[];
}

export function classifyRunSport(
  sportType: string | undefined,
  legacyType: string | undefined,
): RunSport | null {
  const sport = sportType || legacyType || "";
  if (sport === "Run") return "road";
  if (sport === "TrailRun") return "trail";
  if (sport === "VirtualRun") return "virtual";
  return null;
}

export function activityDate(
  startDateLocal: string | undefined,
  startDate: string | undefined,
): { date: string; startLocal: string } | null {
  if (startDateLocal && /^\d{4}-\d{2}-\d{2}/.test(startDateLocal)) {
    return { date: startDateLocal.slice(0, 10), startLocal: startDateLocal };
  }
  if (startDate) {
    const parsed = new Date(startDate);
    if (!Number.isNaN(parsed.getTime())) {
      return { date: londonToday(parsed), startLocal: startDate };
    }
  }
  return null;
}

function splitsOf(raw: RawSplit[] | undefined): NormalizedSplit[] {
  if (!raw) return [];
  return raw
    .filter((split) => (split.distance ?? 0) > 0 && (split.moving_time ?? 0) > 0)
    .map((split) => ({
      distanceMeters: split.distance ?? 0,
      movingTimeSeconds: split.moving_time ?? 0,
    }));
}

export function normalizeStravaRun(raw: RawStravaActivity): NormalizedRun | null {
  const sport = classifyRunSport(raw.sport_type, raw.type);
  if (sport == null || raw.id == null) return null;
  const distanceMeters = raw.distance ?? 0;
  const movingTimeSeconds = raw.moving_time ?? 0;
  if (distanceMeters <= 0 || movingTimeSeconds <= 0) return null;
  const when = activityDate(raw.start_date_local, raw.start_date);
  if (!when) return null;

  const efforts = (raw.best_efforts ?? [])
    .filter((effort) => (effort.distance ?? 0) > 0 && ((effort.elapsed_time ?? 0) > 0 || (effort.moving_time ?? 0) > 0))
    .map((effort) => ({
      name: effort.name ?? "",
      distanceMeters: effort.distance ?? 0,
      elapsedTimeSeconds: (effort.elapsed_time ?? 0) > 0 ? (effort.elapsed_time ?? 0) : (effort.moving_time ?? 0),
    }));

  return {
    id: raw.id,
    name: raw.name?.trim() || "Run",
    sport,
    date: when.date,
    startLocal: when.startLocal,
    distanceMeters,
    movingTimeSeconds,
    efforts,
    kmSplits: splitsOf(raw.splits_metric),
    mileSplits: splitsOf(raw.splits_standard),
  };
}
