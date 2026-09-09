import type { Href } from 'expo-router';

/**
 * Typed routes doesn't generate a bare "/" href for an index route nested in
 * the (tabs) group on this project's `src/app` layout (a generation quirk —
 * `/` is the correct, standard runtime path for it regardless, and is how
 * every screen in the app links back to Today). The double cast is
 * deliberate: `Href`'s generated union genuinely omits "/", so a single-step
 * cast is rejected too. Named once here so every screen that links back to
 * Today shares one cast instead of repeating the workaround.
 */
export const TODAY = '/' as unknown as Href;

/**
 * Same generation quirk, one level down: `app/exercises/index.tsx` gets typed
 * as `/exercises/index` only — the bare `/exercises` alias every other
 * index route gets is missing from the generated union. `/exercises` is
 * still the correct runtime path (and the one every push to this screen
 * should use, params or not), so it gets the same cast rather than
 * navigating everyone to the technically-typed-but-non-canonical `/index` form.
 */
export const EXERCISES = '/exercises' as unknown as Href;

/** Same gap, same fix — `app/splits/index.tsx` has no bare `/splits` alias either. */
export const SPLITS = '/splits' as unknown as Href;

/** Same gap, same fix — `app/onboarding/index.tsx` has no bare `/onboarding` alias either. */
export const ONBOARDING = '/onboarding' as unknown as Href;

/**
 * The exercise library, opened in picker mode (§9): tapping a row adds it to
 * this day and pops back. `router.push({ pathname: EXERCISES, params })`
 * doesn't type-check on its own — the object form's `pathname` field is
 * checked against a narrower per-route union than a plain `Href` satisfies,
 * even though `EXERCISES` itself is already a valid `Href`. Building and
 * casting the whole push target here, once, keeps that cast from being
 * repeated at every call site that needs the picker.
 */
export function exercisesPickerHref(dayId: string): Href {
  return { pathname: '/exercises', params: { dayId } } as unknown as Href;
}

/** The exercise library in "add ad-hoc exercise to this running workout" mode (§5). */
export function exercisesAddToWorkoutHref(workoutId: string): Href {
  return { pathname: '/exercises', params: { workoutId } } as unknown as Href;
}

/** The exercise library in "swap this workout slot for a different exercise" mode (§5). */
export function exercisesSwapHref(workoutExerciseId: string): Href {
  return { pathname: '/exercises', params: { swapId: workoutExerciseId } } as unknown as Href;
}

/**
 * The exercise library in "swap this split-day slot for a different
 * exercise" mode — reachable from Today, before any workout exists. Distinct
 * param name from `exercisesSwapHref` above: that one swaps a
 * `workout_exercises` row (a single session), this one swaps a
 * `split_day_exercises` row (the split itself, so it persists to every
 * future suggestion of this day).
 */
export function exercisesSwapDayHref(dayExerciseId: string): Href {
  return { pathname: '/exercises', params: { swapDayExerciseId: dayExerciseId } } as unknown as Href;
}
