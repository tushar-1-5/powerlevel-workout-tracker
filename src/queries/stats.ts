import { getDb } from '@/db/client';
import { formatMonthYear, startOfDay, toDateKey } from '@/lib/format';
import { round2 } from '@/lib/units';

/* -------------------------------------------------------- exercise progress */

export interface ProgressPoint {
  startedAt: number;
  topWeightKg: number;
}

/**
 * One point per finished session that included this exercise — the heaviest
 * top-level working set that session. Grouped by workout, not by
 * workout_exercise: an exercise trained twice in one session (Block 7's
 * swap-and-back-again case) still contributes a single point for that day,
 * because a progress chart plots "how strong were you on this day," not
 * "how many times did you touch this exercise."
 */
export async function getExerciseProgress(exerciseId: string): Promise<ProgressPoint[]> {
  const rows = await getDb().getAllAsync<{ started_at: number; top_weight: number }>(
    `SELECT w.started_at AS started_at, MAX(s.weight_kg) AS top_weight
       FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN workouts w ON w.id = we.workout_id
      WHERE we.exercise_id = ?
        AND w.deleted_at IS NULL AND w.finished_at IS NOT NULL
        AND we.deleted_at IS NULL AND s.deleted_at IS NULL
        AND s.set_type = 'working' AND s.parent_set_id IS NULL
      GROUP BY w.id
      ORDER BY w.started_at ASC;`,
    [exerciseId],
  );

  return rows.map((r) => ({ startedAt: r.started_at, topWeightKg: r.top_weight }));
}

export interface ExercisePR {
  weightKg: number;
  reps: number;
  achievedAt: number;
}

/** The heaviest working set ever, at any rep count — ties go to the earliest date. */
export async function getExercisePR(exerciseId: string): Promise<ExercisePR | null> {
  const row = await getDb().getFirstAsync<{ weight_kg: number; reps: number; achieved_at: number }>(
    `SELECT s.weight_kg AS weight_kg, s.reps AS reps, w.started_at AS achieved_at
       FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN workouts w ON w.id = we.workout_id
      WHERE we.exercise_id = ?
        AND w.deleted_at IS NULL AND w.finished_at IS NOT NULL
        AND we.deleted_at IS NULL AND s.deleted_at IS NULL
        AND s.set_type = 'working' AND s.parent_set_id IS NULL
      ORDER BY s.weight_kg DESC, w.started_at ASC
      LIMIT 1;`,
    [exerciseId],
  );

  return row ? { weightKg: row.weight_kg, reps: row.reps, achievedAt: row.achieved_at } : null;
}

export interface AllTimePR {
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  achievedAt: number;
}

/**
 * Every exercise's heaviest-ever top-level working set, one row per
 * exercise — the all-time PR board. One grouped query rather than N calls
 * to `getExercisePR` above; same tie-break rule (heaviest wins, earliest
 * date breaks a tie), via a window function so the "which row is the max
 * for this exercise" question is answered once per exercise instead of
 * needing a correlated subquery per row.
 */
export async function getAllTimePRs(): Promise<AllTimePR[]> {
  const rows = await getDb().getAllAsync<{
    exercise_id: string;
    exercise_name: string;
    weight_kg: number;
    reps: number;
    achieved_at: number;
  }>(
    `WITH ranked AS (
       SELECT we.exercise_id AS exercise_id, ex.name AS exercise_name,
              s.weight_kg AS weight_kg, s.reps AS reps, w.started_at AS achieved_at,
              ROW_NUMBER() OVER (
                PARTITION BY we.exercise_id
                ORDER BY s.weight_kg DESC, w.started_at ASC
              ) AS rn
         FROM sets s
         JOIN workout_exercises we ON we.id = s.workout_exercise_id
         JOIN workouts w ON w.id = we.workout_id
         JOIN exercises ex ON ex.id = we.exercise_id
        WHERE w.deleted_at IS NULL AND w.finished_at IS NOT NULL
          AND we.deleted_at IS NULL AND s.deleted_at IS NULL
          AND s.set_type = 'working' AND s.parent_set_id IS NULL
     )
     SELECT exercise_id, exercise_name, weight_kg, reps, achieved_at
       FROM ranked WHERE rn = 1
      ORDER BY exercise_name COLLATE NOCASE ASC;`,
  );

  return rows.map((r) => ({
    exerciseId: r.exercise_id,
    exerciseName: r.exercise_name,
    weightKg: r.weight_kg,
    reps: r.reps,
    achievedAt: r.achieved_at,
  }));
}

/* ------------------------------------------------------------- volume trend */

export interface WeekVolume {
  weekStart: number;
  volumeKg: number;
}

function weekStartOf(ms: number): number {
  const d = new Date(startOfDay(ms));
  d.setDate(d.getDate() - d.getDay()); // back up to Sunday
  return d.getTime();
}

/** Total working-set volume per week (drop-chain links included, same rule as the finish summary), oldest first. */
export async function getWeeklyVolume(weeks = 8): Promise<WeekVolume[]> {
  const since = weekStartOf(Date.now() - weeks * 7 * 86_400_000);

  const rows = await getDb().getAllAsync<{ workout_id: string; started_at: number; volume: number | null }>(
    `SELECT w.id AS workout_id, w.started_at AS started_at, SUM(s.weight_kg * s.reps) AS volume
       FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN workouts w ON w.id = we.workout_id
      WHERE w.deleted_at IS NULL AND w.finished_at IS NOT NULL
        AND we.deleted_at IS NULL AND s.deleted_at IS NULL
        AND s.set_type = 'working'
        AND w.started_at >= ?
      GROUP BY w.id;`,
    [since],
  );

  // Bucket into fixed week-start slots so weeks with zero workouts still
  // show up as a real zero rather than being skipped — a trend with gaps
  // silently removed reads as more consistent than it actually was.
  const buckets = new Map<number, number>();
  const now = Date.now();
  for (let i = 0; i < weeks; i += 1) {
    buckets.set(weekStartOf(now - i * 7 * 86_400_000), 0);
  }
  for (const row of rows) {
    const key = weekStartOf(row.started_at);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + (row.volume ?? 0));
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekStart, volumeKg]) => ({ weekStart, volumeKg: round2(volumeKg) }));
}

/* ---------------------------------------------------------- monthly counts */

export interface MonthCount {
  label: string;
  count: number;
}

/** Finished workouts per calendar month, oldest first, zero-filled. */
export async function getMonthlyWorkoutCounts(months = 6): Promise<MonthCount[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1), 1);
  since.setHours(0, 0, 0, 0);

  const rows = await getDb().getAllAsync<{ started_at: number }>(
    `SELECT started_at FROM workouts
      WHERE deleted_at IS NULL AND finished_at IS NOT NULL AND started_at >= ?
      ORDER BY started_at ASC;`,
    [since.getTime()],
  );

  const buckets = new Map<string, number>();
  const cursor = new Date(since);
  for (let i = 0; i < months; i += 1) {
    buckets.set(formatMonthYear(cursor.getTime()), 0);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  for (const row of rows) {
    const label = formatMonthYear(row.started_at);
    if (buckets.has(label)) buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }

  return [...buckets.entries()].map(([label, count]) => ({ label, count }));
}

/* ------------------------------------------------------------- consistency */

/** Every distinct calendar day with a finished workout, as "YYYY-MM-DD" keys — feeds the heatmap and the streak. */
export async function getTrainingDayKeys(days = 120): Promise<Set<string>> {
  const since = startOfDay(Date.now() - days * 86_400_000);

  const rows = await getDb().getAllAsync<{ started_at: number }>(
    `SELECT started_at FROM workouts
      WHERE deleted_at IS NULL AND finished_at IS NOT NULL AND started_at >= ?;`,
    [since],
  );

  return new Set(rows.map((r) => toDateKey(r.started_at)));
}
