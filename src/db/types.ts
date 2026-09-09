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
export type SetType = 'working' | 'warmup';
export type Units = 'kg' | 'lb';

export interface Exercise {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  is_custom: number;
  rep_chips: string | null;
  notes: string | null;
  archived: number;
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
