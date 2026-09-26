export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'traps'
  | 'full_body'
  | 'cardio';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'other';

export type ScheduleMode = 'rotation' | 'calendar';

/**
 * What a logged `weight_kg` means for a given exercise.
 *
 * `total` — the number is the whole load: 40 kg on your shoulders for a squat.
 * `per_side` — the number is the load on ONE side: 7.5 kg of Hammer Curl is
 * 7.5 in each hand, so 15 kg is actually moving.
 *
 * Volume multiplies by 2 for `per_side` (see `volumeFactor`); PRs and progress
 * charts deliberately do not, so a PR always reads as a weight you really
 * handled. Lives on the exercise, not the set, so one toggle reinterprets that
 * exercise's whole history consistently instead of leaving a step in the chart
 * on the day it was flipped.
 */
export type WeightMode = 'total' | 'per_side';
export type SetType = 'working' | 'warmup';
export type Units = 'kg' | 'lb';

export interface Exercise {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  is_custom: number;
  rep_chips: string | null;
  /** The sticky per-exercise remark: setup cues that outlive any one session. */
  notes: string | null;
  archived: number;
  /** Whether a logged weight is the total load or the load per side. v3+. */
  weight_mode: WeightMode;
}

export interface Split {
  id: string;
  name: string;
  is_default: number;
  schedule_mode: ScheduleMode;
}

export interface SplitDay {
  id: string;
  split_id: string;
  name: string;
  position: number;
  /** 0 = Sunday … 6 = Saturday. Null unless the split is in calendar mode. */
  weekday: number | null;
  color: string | null;
}

export interface Workout {
  id: string;
  split_id: string | null;
  split_day_id: string | null;
  /** Snapshot of the day-group name, so history survives renames and deletes. */
  day_name: string;
  started_at: number;
  finished_at: number | null;
  duration_seconds: number | null;
  notes: string | null;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
  substituted_for_exercise_id: string | null;
  is_ad_hoc: number;
  skipped: number;
  notes: string | null;
  /** The split_day_exercises row this was copied from, or later synced to. Null before v2 or if never linked to a split. */
  source_split_day_exercise_id: string | null;
}

export interface WorkoutSet {
  id: string;
  workout_exercise_id: string;
  position: number;
  weight_kg: number;
  reps: number;
  set_type: SetType;
  to_failure: number;
  /** Set if this row is a link in a drop-set chain hanging off the top set. */
  parent_set_id: string | null;
  notes: string | null;
  logged_at: number;
}

export interface AppSettings {
  weight_step_kg: number;
  weight_step_lb: number;
  units: Units;
  rep_chips: number[];
  haptics_enabled: boolean;
  animations_enabled: boolean;
  active_split_id: string | null;
  onboarded: boolean;
}

export interface BodyweightLog {
  id: string;
  weight_kg: number;
  /** YYYY-MM-DD, local date. */
  logged_on: string;
  note: string | null;
}

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
  traps: 'Traps',
  full_body: 'Full Body',
  cardio: 'Cardio',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  other: 'Other',
};
