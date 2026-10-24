import type { WeightReading } from "@/lib/services/weight";
import type { HevyStats, HevyWorkout } from "@/lib/hevy/types";
import type { HevyCheckinMetric } from "@/lib/fitness/types";

function set(index: number, weight: number, reps: number) {
  return {
    index,
    set_type: "normal" as const,
    weight_kg: weight,
    reps,
    distance_meters: null,
    duration_seconds: null,
    rpe: null,
  };
}

function exercise(index: number, title: string, sets: ReturnType<typeof set>[]) {
  return {
    index,
    title,
    notes: null,
    exercise_template_id: `tmpl-${index}`,
    supersets_id: null,
    sets,
  };
}

/** Frozen sample workouts for the dev-only fitness preview. Not live Hevy data. */
export function previewWorkouts(): HevyWorkout[] {
  return [
    {
      id: "w-3",
      title: "Upper body",
      description: null,
      start_time: "2026-10-23T18:05:00.000Z",
      end_time: "2026-10-23T19:02:00.000Z",
      created_at: "2026-10-23T19:02:00.000Z",
      updated_at: "2026-10-23T19:02:00.000Z",
      exercises: [
        exercise(0, "Bench press", [set(0, 80, 8), set(1, 80, 8), set(2, 80, 6)]),
        exercise(1, "Bent-over row", [set(0, 70, 8), set(1, 70, 8)]),
        exercise(2, "Overhead press", [set(0, 40, 8), set(1, 40, 8)]),
      ],
    },
    {
      id: "w-2",
      title: "Lower body",
      description: null,
      start_time: "2026-10-21T17:40:00.000Z",
      end_time: "2026-10-21T18:35:00.000Z",
      created_at: "2026-10-21T18:35:00.000Z",
      updated_at: "2026-10-21T18:35:00.000Z",
      exercises: [
        exercise(0, "Back squat", [set(0, 100, 5), set(1, 100, 5), set(2, 100, 5)]),
        exercise(1, "Romanian deadlift", [set(0, 90, 8), set(1, 90, 8)]),
      ],
    },
    {
      id: "w-1",
      title: "Full body",
      description: null,
      start_time: "2026-10-19T09:10:00.000Z",
      end_time: "2026-10-19T10:00:00.000Z",
      created_at: "2026-10-19T10:00:00.000Z",
      updated_at: "2026-10-19T10:00:00.000Z",
      exercises: [
        exercise(0, "Deadlift", [set(0, 120, 5), set(1, 120, 5)]),
        exercise(1, "Pull-up", [set(0, 0, 8), set(1, 0, 6)]),
      ],
    },
  ];
}

export function previewWeightReadings(): WeightReading[] {
  return [
    { id: "wt-1", date: "2026-06-01", weightKg: 84.2, snapshotId: "s1" },
    { id: "wt-2", date: "2026-07-01", weightKg: 83.4, snapshotId: "s2" },
    { id: "wt-3", date: "2026-08-01", weightKg: 82.8, snapshotId: "s3" },
    { id: "wt-4", date: "2026-09-01", weightKg: 82.1, snapshotId: "s4" },
    { id: "wt-5", date: "2026-10-01", weightKg: 81.6, snapshotId: "s5" },
  ];
}

export function previewHevyStats(): HevyStats {
  return {
    total_workouts: 214,
    workouts_this_week: 4,
    workouts_this_month: 12,
    workouts_last_30d: 12,
    avg_duration_minutes: 58,
    latest_weight_kg: 81.6,
    latest_weight_date: "2026-10-20",
    recent_volume: [
      { date: "2026-10-02", total_volume_kg: 12400, duration_minutes: 55, set_count: 18 },
      { date: "2026-10-04", total_volume_kg: 15100, duration_minutes: 62, set_count: 22 },
      { date: "2026-10-07", total_volume_kg: 9800, duration_minutes: 48, set_count: 16 },
      { date: "2026-10-09", total_volume_kg: 16300, duration_minutes: 64, set_count: 24 },
      { date: "2026-10-12", total_volume_kg: 14200, duration_minutes: 58, set_count: 20 },
      { date: "2026-10-14", total_volume_kg: 17100, duration_minutes: 66, set_count: 23 },
      { date: "2026-10-16", total_volume_kg: 11000, duration_minutes: 50, set_count: 17 },
      { date: "2026-10-19", total_volume_kg: 15800, duration_minutes: 60, set_count: 21 },
      { date: "2026-10-21", total_volume_kg: 18400, duration_minutes: 68, set_count: 25 },
      { date: "2026-10-23", total_volume_kg: 13200, duration_minutes: 57, set_count: 19 },
    ],
    last_workout_at: "2026-10-23T18:05:00.000Z",
  };
}

export function previewHevyMetrics(): HevyCheckinMetric[] {
  return [
    { id: "m-sessions", name: "Workout Sessions (30d)", unit: "sessions", value: 12 },
    { id: "m-volume", name: "Training Volume (30d)", unit: "kg", value: 48200 },
    { id: "m-prs", name: "Personal Records (30d)", unit: "PRs", value: 3 },
  ];
}
