import type { Exercise, MuscleGroup, WeightMode } from '@/db/types';

/**
 * Per-side weight: what the number on screen means, and what it costs in volume.
 *
 * Lives next to `units.ts` and follows the same discipline — one place decides
 * how a stored number becomes a displayed one, so no screen has to remember the
 * rule. The split of responsibility is deliberate:
 *
 *   volume  ×2 for per-side, because both limbs really did the work
 *   PRs     unchanged, because 7.5 kg/arm is the weight you actually held
 *
 * `getExercisePR`, `getAllTimePRs`, `getExerciseProgress` and `getBestWeightKg`
 * therefore never call `volumeFactor`. They compare one exercise against itself,
 * so per-side numbers are already on a consistent scale; doubling them would
 * only print a PR nobody lifted.
 */

/**
 * The two fields every label below needs. A full `Exercise` row satisfies it,
 * but so does a small object built from a query row that only selected these
 * two columns (the PR board, the finish summary) — no need to load the whole
 * exercise just to decide between "kg" and "kg/arm".
 */
export type ModeSubject = Pick<Exercise, 'weight_mode' | 'muscle_group'>;

/** The multiplier a volume sum applies to `weight_kg * reps`. */
export function volumeFactor(mode: WeightMode): 1 | 2 {
  return mode === 'per_side' ? 2 : 1;
}

/**
 * What one side is called, so the label reads "each arm" on a curl and "each
 * leg" on a lunge instead of a generic "per side" everywhere.
 *
 * Derived from the muscle group rather than stored: there is exactly one sensible
 * answer per group, and a column for it would be another thing to keep in sync.
 * Core/full-body/cardio have no single limb, so they fall back to "side".
 */
export function sideNoun(group: MuscleGroup): 'arm' | 'leg' | 'side' {
  switch (group) {
    case 'quads':
    case 'hamstrings':
    case 'glutes':
    case 'calves':
      return 'leg';
    case 'core':
    case 'full_body':
    case 'cardio':
      return 'side';
    default:
      return 'arm';
  }
}

/** True when this exercise's weights are entered one side at a time. */
export function isPerSide(exercise: ModeSubject): boolean {
  return exercise.weight_mode === 'per_side';
}

/**
 * The caption under the weight Stepper: "kg · each arm", or plain "kg".
 *
 * `unitLabel` is passed in rather than read from settings here, so this stays a
 * pure function and the caller keeps using the same `UNIT_LABEL[units]` it
 * already has in scope.
 */
export function weightCaption(exercise: ModeSubject, unitLabel: string): string {
  if (!isPerSide(exercise)) return unitLabel;
  return `${unitLabel} · each ${sideNoun(exercise.muscle_group)}`;
}

/**
 * The compact suffix for a logged-set row: "kg/arm", or plain "kg".
 *
 * Shorter than `weightCaption` because it sits inline next to the reps in a row
 * that also carries an index and WU/TF tags — "7.5 kg/arm × 10".
 */
export function weightSuffix(exercise: ModeSubject, unitLabel: string): string {
  if (!isPerSide(exercise)) return unitLabel;
  return `${unitLabel}/${sideNoun(exercise.muscle_group)}`;
}

/** The toggle's own label, e.g. "EACH ARM" when on, "TOTAL" when off. */
export function weightModeChipLabel(exercise: ModeSubject): string {
  if (!isPerSide(exercise)) return 'TOTAL';
  return `EACH ${sideNoun(exercise.muscle_group).toUpperCase()}`;
}

/**
 * The overflow-menu item, phrased as the action rather than the current state —
 * "Switch to total weight" can only mean one thing, where a ticked "Each arm"
 * leaves you guessing whether the tick is the state or the result of tapping.
 */
export function weightModeMenuLabel(exercise: ModeSubject): string {
  if (isPerSide(exercise)) return 'Switch to total weight';
  return `Switch to each-${sideNoun(exercise.muscle_group)} weight`;
}

/** The mode a toggle press lands on. */
export function toggledMode(mode: WeightMode): WeightMode {
  return mode === 'per_side' ? 'total' : 'per_side';
}
