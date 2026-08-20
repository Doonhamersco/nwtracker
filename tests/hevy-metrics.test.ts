import { describe, it, expect } from "vitest";
import { hevyValueForMetric, readingsFromHevyStats, hevyMetricsAsOf } from "@/lib/hevy/metrics";
import type { HevyStats } from "@/lib/hevy/types";

const stats: HevyStats = {
  total_workouts: 120,
  workouts_this_week: 3,
  workouts_this_month: 8,
  workouts_last_30d: 11,
  avg_duration_minutes: 62,
  latest_weight_kg: 82.1,
  latest_weight_date: "2026-08-20",
  recent_volume: [
    { date: "2026-08-19", total_volume_kg: 5000.4, duration_minutes: 60, set_count: 20 },
    { date: "2026-08-18", total_volume_kg: 4000.2, duration_minutes: 55, set_count: 18 },
  ],
  last_workout_at: "2026-08-19T18:00:00.000Z",
};

describe("readingsFromHevyStats", () => {
  it("maps builtin Hevy metric names to 30-day stats", () => {
    const readings = readingsFromHevyStats(
      [
        { id: "s", name: "Workout Sessions (30d)" },
        { id: "v", name: "Training Volume (30d)" },
        { id: "p", name: "Personal Records (30d)" },
        { id: "other", name: "Body Weight" },
      ],
      stats,
    );

    expect(readings).toEqual([
      { metricId: "s", value: 11 },
      { metricId: "v", value: 9000.6 },
      { metricId: "p", value: 0 },
    ]);
  });
});

describe("hevyValueForMetric", () => {
  it("returns null for unknown metric names", () => {
    expect(hevyValueForMetric("Monthly Income", stats)).toBeNull();
  });
});

describe("hevyMetricsAsOf", () => {
  it("counts sessions and rounded volume in the 30 days up to asOf", () => {
    const workouts = [
      workout("2026-06-01T10:00:00.000Z", 1000.4),
      workout("2026-06-13T12:00:00.000Z", 2000.4),
      workout("2026-05-01T10:00:00.000Z", 9999),
      workout("2026-06-14T10:00:00.000Z", 500),
    ];

    const result = hevyMetricsAsOf(workouts, new Date("2026-06-13T13:32:50.920Z"));
    expect(result.sessions).toBe(2);
    expect(result.volumeKg).toBe(1000 + 2000);
  });
});

function workout(start_time: string, volume: number) {
  return {
    id: start_time,
    title: "Test",
    description: null,
    start_time,
    end_time: start_time,
    created_at: start_time,
    updated_at: start_time,
    exercises: [
      {
        index: 0,
        title: "Squat",
        notes: null,
        exercise_template_id: "x",
        supersets_id: null,
        sets: [
          {
            index: 0,
            set_type: "normal" as const,
            weight_kg: volume,
            reps: 1,
            distance_meters: null,
            duration_seconds: null,
            rpe: null,
          },
        ],
      },
    ],
  };
}
