import { getDb } from '@/db/client';
import type { SetType, Workout, WorkoutExercise, WorkoutSet } from '@/db/types';
import { newId } from '@/lib/id';
import { round2 } from '@/lib/units';

const WORKOUT_COLS =
  'id, split_id, split_day_id, day_name, started_at, finished_at, duration_seconds, notes';
const WE_COLS =
  'id, workout_id, exercise_id, position, substituted_for_exercise_id, is_ad_hoc, skipped, notes';
const SET_COLS =
  'id, workout_exercise_id, position, weight_kg, reps, set_type, to_failure, parent_set_id, notes, logged_at';

/* ------------------------------------------------------------------ sessions */

/**
 * The in-progress workout, if there is one.
 *
 * "In progress" means started but not finished. There can only be one at a
 * time — `startWorkout` refuses to create a second.
 */
export async function getActiveWorkout(): Promise<Workout | null> {
  return getDb().getFirstAsync<Workout>(
    `SELECT ${WORKOUT_COLS} FROM workouts
      WHERE finished_at IS NULL AND deleted_at IS NULL
      ORDER BY started_at DESC LIMIT 1;`,
  );
}

export interface StartWorkoutInput {
  splitId: string | null;
  splitDayId: string | null;
  dayName: string;
  /** Exercise ids in the order they should appear, from the split day. */
  exerciseIds: string[];
  /** Set only when backfilling a workout you forgot to log. */
  startedAt?: number;
}

/**
 * Creates a session and copies the day's exercises into it.
 *
 * The copy is deliberate: `workout_exercises` is a snapshot. Reordering the
 * split next week must not rewrite what you actually did today, and deleting an
 * exercise from a split must not erase it from history.
 */
export async function startWorkout(input: StartWorkoutInput): Promise<string> {
  const db = getDb();
  const id = newId();
  const now = Date.now();
  const startedAt = input.startedAt ?? now;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO workouts
         (id, split_id, split_day_id, day_name, started_at, created_at, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1);`,
      [id, input.splitId, input.splitDayId, input.dayName, startedAt, now, now],
    );

    for (let i = 0; i < input.exerciseIds.length; i += 1) {
      await db.runAsync(
        `INSERT INTO workout_exercises
           (id, workout_id, exercise_id, position, is_ad_hoc, skipped, created_at, updated_at, dirty)
         VALUES (?, ?, ?, ?, 0, 0, ?, ?, 1);`,
        [newId(), id, input.exerciseIds[i], i, now, now],
      );
    }
  });

  return id;
}

/**
 * Stamps the finish time and stores the elapsed duration.
 *
 * `durationSecondsOverride` exists for backfilled workouts only — a session
 * you're logging after the fact has a `started_at` days in the past, so
 * `finishedAt - started_at` would compute a "duration" of days, not the
 * actual time the session took. The backfill flow asks for a real duration
 * up front and threads it through here instead.
 */
export async function finishWorkout(
  workoutId: string,
  /**
   * `undefined` (a real, just-finished session): compute from wall-clock
   * elapsed time. A number (backfill, a remembered duration): use it as-is.
   * `null` (backfill, "I don't remember"): store NULL rather than falling
   * back to wall-clock — for a backfilled session `started_at` is a past
   * date, so that fallback would compute a nonsensical multi-hour/day
   * "duration" instead of an honest unknown. Plain `??` can't express this,
   * since it treats `null` and `undefined` the same.
   */
  durationSecondsOverride?: number | null,
): Promise<void> {
  const db = getDb();
  const workout = await db.getFirstAsync<{ started_at: number }>(
    `SELECT started_at FROM workouts WHERE id = ?;`,
    [workoutId],
  );
  if (!workout) return;

  const finishedAt = Date.now();
  const duration =
    durationSecondsOverride === null
      ? null
      : (durationSecondsOverride ?? Math.max(0, Math.round((finishedAt - workout.started_at) / 1000)));

  await db.runAsync(
    `UPDATE workouts
        SET finished_at = ?, duration_seconds = ?, updated_at = ?, dirty = 1
      WHERE id = ?;`,
    [finishedAt, duration, finishedAt, workoutId],
  );
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  const now = Date.now();
  await getDb().runAsync(
    `UPDATE workouts SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
    [now, now, workoutId],
  );
}

export async function updateWorkoutNotes(workoutId: string, notes: string | null): Promise<void> {
  const now = Date.now();
  await getDb().runAsync(
    `UPDATE workouts SET notes = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
    [notes, now, workoutId],
  );
}

export async function listWorkouts(limit = 50, offset = 0): Promise<Workout[]> {
  return getDb().getAllAsync<Workout>(
    `SELECT ${WORKOUT_COLS} FROM workouts
      WHERE deleted_at IS NULL AND finished_at IS NOT NULL
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?;`,
    [limit, offset],
  );
}

export async function getWorkout(workoutId: string): Promise<Workout | null> {
  return getDb().getFirstAsync<Workout>(
    `SELECT ${WORKOUT_COLS} FROM workouts WHERE id = ? AND deleted_at IS NULL;`,
    [workoutId],
  );
}

/* ----------------------------------------------------------- finish summary */

export interface WorkoutSummaryExercise {
  exerciseId: string;
  exerciseName: string;
  /** The heaviest top-level working set for this exercise this session. */
  topWeightKg: number;
  topReps: number;
  /** True if `topWeightKg` beats every prior finished session's best. */
  isPr: boolean;
}

export interface WorkoutSummary {
  workout: Workout;
  /** Working sets only, drop-chain links included — see the PRD's volume rule. */
  totalVolumeKg: number;
  /** Every logged set, warm-ups and drop links included — "how much you did". */
  setCount: number;
  exercises: WorkoutSummaryExercise[];
}

/**
 * Everything the finish screen shows. Computed fresh from `sets` every call,
 * same as `getBestWeightKg` — never cached, so editing a set after the fact
 * can't leave a stale volume or a PR flag that's no longer true.
 */
export async function getWorkoutSummary(workoutId: string): Promise<WorkoutSummary | null> {
  const workout = await getWorkout(workoutId);
  if (!workout) return null;

  const rows = await getDb().getAllAsync<{
    workout_exercise_id: string;
    exercise_id: string;
    exercise_name: string;
    weight_kg: number;
    reps: number;
    set_type: SetType;
    parent_set_id: string | null;
  }>(
    `SELECT s.workout_exercise_id, we.exercise_id, ex.name AS exercise_name,
            s.weight_kg, s.reps, s.set_type, s.parent_set_id
       FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN exercises ex ON ex.id = we.exercise_id
      WHERE we.workout_id = ? AND we.deleted_at IS NULL AND s.deleted_at IS NULL
      ORDER BY we.position ASC, s.position ASC;`,
    [workoutId],
  );

  const workingRows = rows.filter((r) => r.set_type === 'working');
  const totalVolumeKg = round2(workingRows.reduce((sum, r) => sum + r.weight_kg * r.reps, 0));

  // Keyed by workout_exercise, not exercise_id, so an exercise trained twice
  // in one session (swapped back in, say) gets its own line instead of being
  // silently merged into the first. Map insertion order follows the query's
  // ORDER BY, so this also comes out in the order you actually trained.
  const topByWorkoutExercise = new Map<
    string,
    { exerciseId: string; exerciseName: string; weightKg: number; reps: number }
  >();
  for (const r of workingRows) {
    if (r.parent_set_id !== null) continue; // PRs only ever consider the top link.
    const current = topByWorkoutExercise.get(r.workout_exercise_id);
    if (!current || r.weight_kg > current.weightKg) {
      topByWorkoutExercise.set(r.workout_exercise_id, {
        exerciseId: r.exercise_id,
        exerciseName: r.exercise_name,
        weightKg: r.weight_kg,
        reps: r.reps,
      });
    }
  }

  const exercises: WorkoutSummaryExercise[] = [];
  for (const top of topByWorkoutExercise.values()) {
    const previousBest = await getBestWeightKg(top.exerciseId, workoutId);
    exercises.push({
      exerciseId: top.exerciseId,
      exerciseName: top.exerciseName,
      topWeightKg: top.weightKg,
      topReps: top.reps,
      isPr: previousBest === null || top.weightKg > previousBest,
    });
  }

  return { workout, totalVolumeKg, setCount: rows.length, exercises };
}

/* --------------------------------------------------- exercises in a workout */

export async function getWorkoutExercises(workoutId: string): Promise<WorkoutExercise[]> {
  return getDb().getAllAsync<WorkoutExercise>(
    `SELECT ${WE_COLS} FROM workout_exercises
      WHERE workout_id = ? AND deleted_at IS NULL
      ORDER BY position ASC;`,
    [workoutId],
  );
}

/** Appends an exercise to the end of a running session. */
export async function addExerciseToWorkout(
  workoutId: string,
  exerciseId: string,
  options: { isAdHoc?: boolean } = {},
): Promise<string> {
  const db = getDb();
  const now = Date.now();

  const last = await db.getFirstAsync<{ max_position: number | null }>(
    `SELECT MAX(position) AS max_position FROM workout_exercises
      WHERE workout_id = ? AND deleted_at IS NULL;`,
    [workoutId],
  );
  const position = (last?.max_position ?? -1) + 1;

  const id = newId();
  await db.runAsync(
    `INSERT INTO workout_exercises
       (id, workout_id, exercise_id, position, is_ad_hoc, skipped, created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1);`,
    [id, workoutId, exerciseId, position, options.isAdHoc ? 1 : 0, now, now],
  );

  return id;
}

export async function removeExerciseFromWorkout(workoutExerciseId: string): Promise<void> {
  const now = Date.now();
  await getDb().runAsync(
    `UPDATE workout_exercises SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
    [now, now, workoutExerciseId],
  );
}

/**
 * Substitutes a different exercise for today only.
 *
 * The original id moves into `substituted_for_exercise_id` rather than being
 * discarded, so history can say "Dumbbell Bench, in place of Barbell Bench".
 */
export async function swapWorkoutExercise(
  workoutExerciseId: string,
  newExerciseId: string,
): Promise<void> {
  const db = getDb();
  const now = Date.now();

  const current = await db.getFirstAsync<{ exercise_id: string }>(
    `SELECT exercise_id FROM workout_exercises WHERE id = ?;`,
    [workoutExerciseId],
  );
  if (!current) return;

  await db.runAsync(
    `UPDATE workout_exercises
        SET exercise_id = ?, substituted_for_exercise_id = ?, updated_at = ?, dirty = 1
      WHERE id = ?;`,
    [newExerciseId, current.exercise_id, now, workoutExerciseId],
  );
}

/** Writes a new drag order. `orderedIds` is the full list, top to bottom. */
export async function reorderWorkoutExercises(orderedIds: string[]): Promise<void> {
  const db = getDb();
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await db.runAsync(
        `UPDATE workout_exercises SET position = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
        [i, now, orderedIds[i]],
      );
    }
  });
}

/* --------------------------------------------------------------------- sets */

export async function getSetsFor(workoutExerciseId: string): Promise<WorkoutSet[]> {
  return getDb().getAllAsync<WorkoutSet>(
    `SELECT ${SET_COLS} FROM sets
      WHERE workout_exercise_id = ? AND deleted_at IS NULL
      ORDER BY position ASC;`,
    [workoutExerciseId],
  );
}

export interface LogSetInput {
  workoutExerciseId: string;
  weightKg: number;
  reps: number;
  setType?: SetType;
  toFailure?: boolean;
  /** Set to attach this as the next link in an existing set's drop chain. */
  parentSetId?: string | null;
  notes?: string | null;
}

export async function logSet(input: LogSetInput): Promise<string> {
  const db = getDb();
  const now = Date.now();
  const parentSetId = input.parentSetId ?? null;

  // Top-level sets are numbered within the exercise; drop-chain links are
  // numbered within their parent. Both start at 0.
  const last = await db.getFirstAsync<{ max_position: number | null }>(
    parentSetId
      ? `SELECT MAX(position) AS max_position FROM sets
           WHERE parent_set_id = ? AND deleted_at IS NULL;`
      : `SELECT MAX(position) AS max_position FROM sets
           WHERE workout_exercise_id = ? AND parent_set_id IS NULL AND deleted_at IS NULL;`,
    [parentSetId ?? input.workoutExerciseId],
  );
  const position = (last?.max_position ?? -1) + 1;

  const id = newId();
  await db.runAsync(
    `INSERT INTO sets
       (id, workout_exercise_id, position, weight_kg, reps, set_type, to_failure,
        parent_set_id, notes, logged_at, created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);`,
    [
      id,
      input.workoutExerciseId,
      position,
      input.weightKg,
      input.reps,
      input.setType ?? 'working',
      input.toFailure ? 1 : 0,
      parentSetId,
      input.notes ?? null,
      now,
      now,
      now,
    ],
  );

  return id;
}

export async function updateSet(
  setId: string,
  patch: {
    weightKg?: number;
    reps?: number;
    setType?: SetType;
    toFailure?: boolean;
    notes?: string | null;
  },
): Promise<void> {
  const assignments: string[] = [];
  const values: (string | number | null)[] = [];

  const set = (column: string, value: string | number | null) => {
    assignments.push(`${column} = ?`);
    values.push(value);
  };

  if (patch.weightKg !== undefined) set('weight_kg', patch.weightKg);
  if (patch.reps !== undefined) set('reps', patch.reps);
  if (patch.setType !== undefined) set('set_type', patch.setType);
  if (patch.toFailure !== undefined) set('to_failure', patch.toFailure ? 1 : 0);
  if (patch.notes !== undefined) set('notes', patch.notes);

  if (assignments.length === 0) return;

  set('updated_at', Date.now());
  set('dirty', 1);
  values.push(setId);

  await getDb().runAsync(`UPDATE sets SET ${assignments.join(', ')} WHERE id = ?;`, values);
}

/** Soft-deletes a set, and any drop-chain links hanging off it. */
export async function deleteSet(setId: string): Promise<void> {
  const db = getDb();
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE sets SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;`, [
      now,
      now,
      setId,
    ]);
    await db.runAsync(
      `UPDATE sets SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE parent_set_id = ?;`,
      [now, now, setId],
    );
  });
}

/* ------------------------------------------------------------ last session */

export interface LastSessionSet {
  position: number;
  weight_kg: number;
  reps: number;
}

/**
 * The working sets of this exercise from your most recent FINISHED session.
 *
 * This drives two things on the logging screen: the set-1 prefill, and the
 * "last 57.5" comparison line under every set. Deliberate exclusions:
 *
 *  - warm-up sets, so a 20 kg bar warm-up never becomes the number to beat
 *  - drop-chain links (`parent_set_id IS NOT NULL`), which are lighter by design
 *  - unfinished sessions, so an abandoned workout is not "last time"
 *  - the session in progress, so today's own sets don't become their own reference
 */
export async function getLastSessionSets(
  exerciseId: string,
  excludeWorkoutId?: string | null,
): Promise<LastSessionSet[]> {
  const db = getDb();
  const exclude = excludeWorkoutId ?? '';

  // Step 1: find WHICH session was the last one. Done separately from step 2
  // because "the most recent workout" and "its sets" are two different
  // questions, and one query answering both is far harder to read or debug.
  const lastWorkout = await db.getFirstAsync<{ workout_id: string }>(
    `SELECT w.id AS workout_id
       FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id
       JOIN sets s ON s.workout_exercise_id = we.id
      WHERE we.exercise_id = ?
        AND w.id != ?
        AND w.finished_at IS NOT NULL
        AND w.deleted_at IS NULL
        AND we.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND s.set_type = 'working'
        AND s.parent_set_id IS NULL
      ORDER BY w.started_at DESC
      LIMIT 1;`,
    [exerciseId, exclude],
  );

  if (!lastWorkout) return [];

  // Step 2: that session's working sets, in the order they were performed.
  return db.getAllAsync<LastSessionSet>(
    `SELECT s.position, s.weight_kg, s.reps
       FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
      WHERE we.workout_id = ?
        AND we.exercise_id = ?
        AND we.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND s.set_type = 'working'
        AND s.parent_set_id IS NULL
      ORDER BY s.position ASC;`,
    [lastWorkout.workout_id, exerciseId],
  );
}

/**
 * Heaviest working weight ever lifted on this exercise — the PR rule you chose.
 *
 * Computed on demand rather than cached in a table, so editing or deleting a
 * past workout can never leave a stale record behind. Pass the running workout
 * id to get "the record to beat", excluding today's own sets.
 */
export async function getBestWeightKg(
  exerciseId: string,
  excludeWorkoutId?: string | null,
): Promise<number | null> {
  const row = await getDb().getFirstAsync<{ best: number | null }>(
    `SELECT MAX(s.weight_kg) AS best
       FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN workouts w ON w.id = we.workout_id
      WHERE we.exercise_id = ?
        AND w.id != ?
        AND w.deleted_at IS NULL
        AND we.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND s.set_type = 'working'
        AND s.parent_set_id IS NULL;`,
    [exerciseId, excludeWorkoutId ?? ''],
  );

  return row?.best ?? null;
}

/**
 * The most recently finished session, used by rotation mode to work out which
 * day-group comes next.
 */
export async function getLastFinishedWorkout(splitId?: string | null): Promise<Workout | null> {
  if (splitId) {
    return getDb().getFirstAsync<Workout>(
      `SELECT ${WORKOUT_COLS} FROM workouts
        WHERE deleted_at IS NULL AND finished_at IS NOT NULL AND split_id = ?
        ORDER BY started_at DESC LIMIT 1;`,
      [splitId],
    );
  }

  return getDb().getFirstAsync<Workout>(
    `SELECT ${WORKOUT_COLS} FROM workouts
      WHERE deleted_at IS NULL AND finished_at IS NOT NULL
      ORDER BY started_at DESC LIMIT 1;`,
  );
}
