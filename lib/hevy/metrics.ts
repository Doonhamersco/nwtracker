import type { HevyStats, HevyWorkout } from "./types";

export interface HevyMetricDef {
  id: string;
  name: string;
}

export interface HevyMetricReading {
  metricId: string;
  value: number;
}

export function trainingVolumeFromStats(stats: HevyStats): number {
  const total = stats.recent_volume.reduce((sum, v) => sum + v.total_volume_kg, 0);
  return Math.round(total * 10) / 10;
}

export function hevyValueForMetric(metricName: string, stats: HevyStats): number | null {
  if (metricName.includes("Workout Sessions")) return stats.workouts_last_30d;
  if (metricName.includes("Training Volume")) return trainingVolumeFromStats(stats);
  if (metricName.includes("Personal Records")) return 0;
  return null;
}

export function readingsFromHevyStats(
  defs: HevyMetricDef[],
  stats: HevyStats,
): HevyMetricReading[] {
  const readings: HevyMetricReading[] = [];
  for (const def of defs) {
    const value = hevyValueForMetric(def.name, stats);
    if (value !== null) {
      readings.push({ metricId: def.id, value });
    }
  }
  return readings;
}

export function workoutVolumeKg(workout: HevyWorkout): number {
  return workout.exercises.reduce((exSum, ex) => {
    return (
      exSum +
      ex.sets.reduce((sSum, set) => {
        if (set.weight_kg != null && set.reps != null) {
          return sSum + set.weight_kg * set.reps;
        }
        return sSum;
      }, 0)
    );
  }, 0);
}

/** Rolling 30-day Hevy totals as of a check-in timestamp. */
export function hevyMetricsAsOf(
  workouts: HevyWorkout[],
  asOf: Date,
  windowDays = 30,
): { sessions: number; volumeKg: number } {
  const windowStart = new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const inWindow = workouts.filter((w) => {
    const start = new Date(w.start_time);
    return start >= windowStart && start <= asOf;
  });

  return {
    sessions: inWindow.length,
    volumeKg: inWindow.reduce((sum, w) => sum + Math.round(workoutVolumeKg(w)), 0),
  };
}
