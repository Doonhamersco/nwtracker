import type { HevyStats } from "./types";

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
