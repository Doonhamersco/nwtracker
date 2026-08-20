// ─── Set ─────────────────────────────────────────────────────────────────────

export type SetType =
  | "normal"
  | "warmup"
  | "drop_set"
  | "failure"
  | "myorep"
  | "myorep_match"
  | "partial";

export interface HevySet {
  index: number;
  set_type: SetType;
  /** Weight in kilograms */
  weight_kg: number | null;
  reps: number | null;
  /** Distance in meters */
  distance_meters: number | null;
  /** Duration in seconds */
  duration_seconds: number | null;
  /** Rate of perceived exertion (1–10) */
  rpe: number | null;
}

// ─── Exercise ─────────────────────────────────────────────────────────────────

export type MuscleGroup =
  | "abdominals"
  | "abductors"
  | "adductors"
  | "biceps"
  | "calves"
  | "cardiovascular_system"
  | "delts"
  | "forearms"
  | "glutes"
  | "hamstrings"
  | "lats"
  | "levator_scapulae"
  | "pectorals"
  | "quads"
  | "serratus_anterior"
  | "spine"
  | "traps"
  | "triceps"
  | "upper_back"
  | string;

export type EquipmentCategory =
  | "barbell"
  | "dumbbell"
  | "weight_plate"
  | "ezbar"
  | "kettlebell"
  | "machine"
  | "cable"
  | "smith_machine"
  | "resistance_band"
  | "suspension"
  | "other"
  | "body_only"
  | "cardio"
  | string;

export type CustomExerciseType =
  | "weight_reps"
  | "assisted_weight_reps"
  | "weighted_bodyweight"
  | "bodyweight_reps"
  | "duration"
  | "distance_duration"
  | "weight_distance"
  | string;

export interface HevyExercise {
  index: number;
  title: string;
  notes: string | null;
  exercise_template_id: string;
  supersets_id: number | null;
  sets: HevySet[];
}

// ─── Workout ──────────────────────────────────────────────────────────────────

export interface HevyWorkout {
  id: string;
  title: string;
  description: string | null;
  /** ISO 8601 */
  start_time: string;
  /** ISO 8601 */
  end_time: string;
  created_at: string;
  updated_at: string;
  exercises: HevyExercise[];
}

// ─── Workout events ───────────────────────────────────────────────────────────

export interface UpdatedWorkoutEvent {
  type: "updated";
  workout: HevyWorkout;
}

export interface DeletedWorkoutEvent {
  type: "deleted";
  workout_id: string;
  deleted_at: string;
}

export type WorkoutEvent = UpdatedWorkoutEvent | DeletedWorkoutEvent;

export interface PaginatedWorkoutEvents {
  page: number;
  page_count: number;
  events: WorkoutEvent[];
}

// ─── Exercise template ────────────────────────────────────────────────────────

export interface HevyExerciseTemplate {
  id: string;
  title: string;
  type: CustomExerciseType;
  primary_muscle_group: MuscleGroup;
  secondary_muscle_groups: MuscleGroup[];
  is_custom: boolean;
  equipment_category: EquipmentCategory;
}

// ─── Exercise history ─────────────────────────────────────────────────────────

export interface HevyExerciseHistoryEntry {
  index: number;
  exercise_template_id: string;
  workout_id: string;
  workout_title: string;
  /** ISO 8601 */
  start_time: string;
  /** ISO 8601 */
  end_time: string;
  sets: HevySet[];
}

// ─── Body measurements ────────────────────────────────────────────────────────

export interface HevyBodyMeasurement {
  /** YYYY-MM-DD */
  date: string;
  /** Weight in kilograms */
  weight_kg: number | null;
  body_fat_percentage: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  bicep_cm: number | null;
  thigh_cm: number | null;
  calf_cm: number | null;
  shoulder_cm: number | null;
  forearm_cm: number | null;
  neck_cm: number | null;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface HevyUserInfo {
  id: string;
  email: string;
  username: string;
  /** ISO 8601 */
  created_at: string;
}

export interface HevyUserInfoResponse {
  user: HevyUserInfo;
}

// ─── Routines ────────────────────────────────────────────────────────────────

export interface HevyRoutineSet {
  type: SetType;
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  custom_weight?: number | null;
}

export interface HevyRoutineExercise {
  exercise_template_id: string;
  supersets_id: number | null;
  rest_seconds: number | null;
  notes: string | null;
  sets: HevyRoutineSet[];
}

export interface HevyRoutine {
  id: number;
  title: string;
  notes: string | null;
  folder_id: number | null;
  updated_at: string;
  created_at: string;
  exercises: HevyRoutineExercise[];
}

// ─── Pagination wrappers ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  page: number;
  page_count: number;
  data: T[];
}

export interface WorkoutsResponse {
  page: number;
  page_count: number;
  workouts: HevyWorkout[];
}

export interface WorkoutsCountResponse {
  workout_count: number;
}

export interface RoutinesResponse {
  page: number;
  page_count: number;
  routines: HevyRoutine[];
}

export interface ExerciseTemplatesResponse {
  page: number;
  page_count: number;
  exercise_templates: HevyExerciseTemplate[];
}

export interface ExerciseHistoryResponse {
  page: number;
  page_count: number;
  exercise_history: HevyExerciseHistoryEntry[];
}

export interface BodyMeasurementsResponse {
  page: number;
  page_count: number;
  body_measurements: HevyBodyMeasurement[];
}

// ─── Derived / aggregated types (used by our dashboard) ──────────────────────

/** Workout volume metric for charting */
export interface WorkoutVolumeSeries {
  /** YYYY-MM-DD */
  date: string;
  /** Total kg lifted (sum of weight × reps across all sets) */
  total_volume_kg: number;
  /** Duration in minutes */
  duration_minutes: number;
  /** Number of sets performed */
  set_count: number;
}

/** High-level stats summary consumed by the dashboard widget */
export interface HevyStats {
  total_workouts: number;
  workouts_this_week: number;
  workouts_this_month: number;
  /** Workouts whose start_time falls in the last 30 days */
  workouts_last_30d: number;
  /** In minutes, average over last 12 workouts */
  avg_duration_minutes: number;
  /** Most recent body weight in kg (null if not tracked in Hevy) */
  latest_weight_kg: number | null;
  /** Most recent body weight date */
  latest_weight_date: string | null;
  /** Volume series for the last 30 days (one entry per workout day) */
  recent_volume: WorkoutVolumeSeries[];
  /** ISO 8601 timestamp of the last synced workout */
  last_workout_at: string | null;
}
