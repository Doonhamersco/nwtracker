export type RunSport = "road" | "trail" | "virtual";

export type OnTrackStatus = "on_track" | "building" | "off_track";

export interface RecentRun {
  id: number;
  name: string;
  date: string;
  sport: RunSport;
  distanceKm: number;
  paceSecPerKm: number;
  movingTimeSeconds: number;
}

export interface WeekPace {
  weekStart: string;
  /** Distance-weighted average for road and treadmill runs. Null when that week has none. */
  paceSecPerKm: number | null;
  distanceKm: number;
  sessions: number;
}

export interface PaceTrend {
  direction: "faster" | "slower" | "steady" | "insufficient";
  recentSecPerKm: number | null;
  previousSecPerKm: number | null;
  /** Recent pace minus the previous 4 weeks. Negative means faster. */
  deltaSecPerKm: number | null;
}

export type EffortSource = "activity" | "best_effort" | "splits";

export interface BestEffort {
  timeSeconds: number;
  date: string;
  source: EffortSource;
}

export interface CardioSummary {
  weeklyDistanceKm: number;
  weeklySessions: number;
  weekStart: string;
  runsLast7Days: number;
  onTrack: OnTrackStatus;
  targetRunsPerWeek: number;
  paceTrend: PaceTrend;
  /** Oldest week first, eight ISO weeks ending this week. */
  weeklyPace: WeekPace[];
  recentRuns: RecentRun[];
  bestOnePointFiveMile: BestEffort | null;
  bestFiveK: BestEffort | null;
}

export interface HevyTrainingAvailable {
  available: true;
  streakDays: number;
  streakCapped: boolean;
  weeklyVolumeKg: number;
  workoutsThisWeek: number;
}

export interface HevyTrainingUnavailable {
  available: false;
  reason: "unconfigured" | "error";
}

export type HevyTraining = HevyTrainingAvailable | HevyTrainingUnavailable;

export type StravaState =
  | { configured: false }
  | { configured: true; summary: CardioSummary }
  | { configured: true; error: string };

export interface TrainingPayload {
  testDate: string;
  testLabel: string;
  countdownDays: number;
  strava: StravaState;
  hevy: HevyTraining;
}
