import type {
  BodyMeasurementsResponse,
  ExerciseHistoryResponse,
  ExerciseTemplatesResponse,
  HevyBodyMeasurement,
  HevyExerciseHistoryEntry,
  HevyExerciseTemplate,
  HevyRoutine,
  HevyStats,
  HevyUserInfoResponse,
  HevyWorkout,
  RoutinesResponse,
  WorkoutVolumeSeries,
  WorkoutsCountResponse,
  WorkoutsResponse,
} from "./types";

const BASE_URL = "https://api.hevyapp.com";

/** Workouts, measurements, and routines reject pageSize > 10. Templates allow 100. */
const HEVY_LIST_PAGE_SIZE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.HEVY_API_KEY;
  if (!key) throw new Error("HEVY_API_KEY environment variable is not set.");
  return key;
}

function buildHeaders(): HeadersInit {
  return {
    "api-key": getApiKey(),
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), { headers: buildHeaders(), cache: "no-store" });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HevyApiError(res.status, path, text);
  }

  return res.json() as Promise<T>;
}

export class HevyApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: string,
  ) {
    super(`Hevy API ${status} at ${path}: ${body}`);
    this.name = "HevyApiError";
  }
}

// ─── Paginated fetch helpers ──────────────────────────────────────────────────

async function fetchAllWorkouts(): Promise<HevyWorkout[]> {
  const all: HevyWorkout[] = [];
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const res = await get<WorkoutsResponse>("/v1/workouts", {
      page,
      pageSize: HEVY_LIST_PAGE_SIZE,
    });
    all.push(...res.workouts);
    pageCount = res.page_count;
    page++;
  }

  return all;
}

/** Newest-first pages until a workout is older than `oldestNeeded`. */
async function fetchWorkoutsUntil(oldestNeeded: Date): Promise<HevyWorkout[]> {
  const all: HevyWorkout[] = [];
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const res = await get<WorkoutsResponse>("/v1/workouts", {
      page,
      pageSize: HEVY_LIST_PAGE_SIZE,
    });
    all.push(...res.workouts);
    pageCount = res.page_count;

    if (res.workouts.length === 0) break;
    const oldestOnPage = res.workouts[res.workouts.length - 1];
    if (new Date(oldestOnPage.start_time) < oldestNeeded) break;
    page++;
  }

  return all;
}

async function fetchAllMeasurements(): Promise<HevyBodyMeasurement[]> {
  const all: HevyBodyMeasurement[] = [];
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const res = await get<BodyMeasurementsResponse>("/v1/body_measurements", {
      page,
      pageSize: 10,
    });
    all.push(...res.body_measurements);
    pageCount = res.page_count;
    page++;
  }

  return all;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfISOWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Public client ────────────────────────────────────────────────────────────

export const hevyClient = {
  async getUserInfo(): Promise<HevyUserInfoResponse> {
    return get<HevyUserInfoResponse>("/v1/user/info");
  },

  async getWorkoutCount(): Promise<number> {
    const res = await get<WorkoutsCountResponse>("/v1/workouts/count");
    return res.workout_count;
  },

  async getWorkouts(page = 1, pageSize = 10): Promise<WorkoutsResponse> {
    return get<WorkoutsResponse>("/v1/workouts", { page, pageSize });
  },

  async getAllWorkouts(): Promise<HevyWorkout[]> {
    return fetchAllWorkouts();
  },

  async getWorkout(id: string): Promise<HevyWorkout> {
    const res = await get<{ workout: HevyWorkout }>(`/v1/workouts/${id}`);
    return res.workout;
  },

  async getBodyMeasurements(page = 1, pageSize = 10): Promise<BodyMeasurementsResponse> {
    return get<BodyMeasurementsResponse>("/v1/body_measurements", { page, pageSize });
  },

  async getAllBodyMeasurements(): Promise<HevyBodyMeasurement[]> {
    return fetchAllMeasurements();
  },

  async getBodyMeasurementByDate(date: string): Promise<HevyBodyMeasurement> {
    const res = await get<{ body_measurement: HevyBodyMeasurement }>(
      `/v1/body_measurements/${date}`,
    );
    return res.body_measurement;
  },

  async getExerciseTemplates(page = 1, pageSize = 100): Promise<ExerciseTemplatesResponse> {
    return get<ExerciseTemplatesResponse>("/v1/exercise_templates", { page, pageSize });
  },

  async getExerciseHistory(
    exerciseTemplateId: string,
    page = 1,
    pageSize = HEVY_LIST_PAGE_SIZE,
  ): Promise<ExerciseHistoryResponse> {
    return get<ExerciseHistoryResponse>(`/v1/exercise_history/${exerciseTemplateId}`, {
      page,
      pageSize,
    });
  },

  async getAllExerciseHistory(exerciseTemplateId: string): Promise<HevyExerciseHistoryEntry[]> {
    const all: HevyExerciseHistoryEntry[] = [];
    let page = 1;
    let pageCount = 1;

    while (page <= pageCount) {
      const res = await this.getExerciseHistory(exerciseTemplateId, page, HEVY_LIST_PAGE_SIZE);
      all.push(...res.exercise_history);
      pageCount = res.page_count;
      page++;
    }

    return all;
  },

  async getRoutines(page = 1, pageSize = HEVY_LIST_PAGE_SIZE): Promise<RoutinesResponse> {
    return get<RoutinesResponse>("/v1/routines", { page, pageSize });
  },

  async getAllRoutines(): Promise<HevyRoutine[]> {
    const all: HevyRoutine[] = [];
    let page = 1;
    let pageCount = 1;

    while (page <= pageCount) {
      const res = await this.getRoutines(page, HEVY_LIST_PAGE_SIZE);
      all.push(...res.routines);
      pageCount = res.page_count;
      page++;
    }

    return all;
  },

  /**
   * Aggregated stats used by the dashboard widget.
   * Fetches recent workouts + latest body measurement in parallel.
   */
  async getStats(): Promise<HevyStats> {
    const now = new Date();
    const startOfWeek = startOfISOWeek(now);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oldestNeeded = new Date(Math.min(startOfMonth.getTime(), thirtyDaysAgo.getTime()));

    const [workouts, countRes, measurementsRes] = await Promise.all([
      fetchWorkoutsUntil(oldestNeeded),
      get<WorkoutsCountResponse>("/v1/workouts/count"),
      get<BodyMeasurementsResponse>("/v1/body_measurements", {
        page: 1,
        pageSize: HEVY_LIST_PAGE_SIZE,
      }),
    ]);

    const workoutsThisWeek = workouts.filter(
      (w) => new Date(w.start_time) >= startOfWeek,
    ).length;

    const workoutsThisMonth = workouts.filter(
      (w) => new Date(w.start_time) >= startOfMonth,
    ).length;

    const recent12 = workouts.slice(0, 12);
    const avgDuration =
      recent12.length === 0
        ? 0
        : recent12.reduce((sum, w) => {
            const ms = new Date(w.end_time).getTime() - new Date(w.start_time).getTime();
            return sum + ms / 1000 / 60;
          }, 0) / recent12.length;

    const recentVolume: WorkoutVolumeSeries[] = workouts
      .filter((w) => new Date(w.start_time) >= thirtyDaysAgo)
      .map((w) => {
        const durationMs =
          new Date(w.end_time).getTime() - new Date(w.start_time).getTime();
        const totalVolume = w.exercises.reduce((exSum, ex) => {
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
        const setCount = w.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

        return {
          date: w.start_time.slice(0, 10),
          total_volume_kg: Math.round(totalVolume),
          duration_minutes: Math.round(durationMs / 1000 / 60),
          set_count: setCount,
        };
      })
      .reverse();

    const measurements = measurementsRes.body_measurements;
    const latestWithWeight = measurements.find((m) => m.weight_kg != null) ?? null;

    return {
      total_workouts: countRes.workout_count,
      workouts_this_week: workoutsThisWeek,
      workouts_this_month: workoutsThisMonth,
      workouts_last_30d: recentVolume.length,
      avg_duration_minutes: Math.round(avgDuration),
      latest_weight_kg: latestWithWeight?.weight_kg ?? null,
      latest_weight_date: latestWithWeight?.date ?? null,
      recent_volume: recentVolume,
      last_workout_at: workouts[0]?.start_time ?? null,
    };
  },
};

// Re-export types consumed by server components / route handlers
export type { HevyExerciseTemplate };
