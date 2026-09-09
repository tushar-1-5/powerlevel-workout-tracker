import { getDb } from '@/db/client';
import type { ScheduleMode, Split, SplitDay } from '@/db/types';
import { newId } from '@/lib/id';

const SPLIT_COLS = 'id, name, is_default, schedule_mode';
const DAY_COLS = 'id, split_id, name, position, weekday, color';

/* ------------------------------------------------------------------- splits */

export async function listSplits(): Promise<Split[]> {
  return getDb().getAllAsync<Split>(
    `SELECT ${SPLIT_COLS} FROM splits
      WHERE deleted_at IS NULL
      ORDER BY is_default DESC, name COLLATE NOCASE ASC;`,
  );
}

export async function getSplit(id: string): Promise<Split | null> {
  return getDb().getFirstAsync<Split>(
    `SELECT ${SPLIT_COLS} FROM splits WHERE id = ? AND deleted_at IS NULL;`,
    [id],
  );
}

/**
 * The split the Today screen follows.
 *
 * Falls back to any split if the default flag was somehow lost (the last
 * default was deleted, say), so Today is never blank while splits exist.
 */
export async function getDefaultSplit(): Promise<Split | null> {
  const flagged = await getDb().getFirstAsync<Split>(
    `SELECT ${SPLIT_COLS} FROM splits
      WHERE is_default = 1 AND deleted_at IS NULL LIMIT 1;`,
  );
  if (flagged) return flagged;

  return getDb().getFirstAsync<Split>(
    `SELECT ${SPLIT_COLS} FROM splits
      WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;`,
  );
}

export async function createSplit(
  name: string,
  scheduleMode: ScheduleMode = 'rotation',
): Promise<string> {
  const id = newId();
  const now = Date.now();

  await getDb().runAsync(
    `INSERT INTO splits (id, name, is_default, schedule_mode, created_at, updated_at, dirty)
     VALUES (?, ?, 0, ?, ?, ?, 1);`,
    [id, name.trim(), scheduleMode, now, now],
  );

  return id;
}

export async function updateSplit(
  id: string,
  patch: { name?: string; scheduleMode?: ScheduleMode },
): Promise<void> {
  const assignments: string[] = [];
  const values: (string | number)[] = [];

  if (patch.name !== undefined) {
    assignments.push('name = ?');
    values.push(patch.name.trim());
  }
  if (patch.scheduleMode !== undefined) {
    assignments.push('schedule_mode = ?');
    values.push(patch.scheduleMode);
  }
  if (assignments.length === 0) return;

  assignments.push('updated_at = ?', 'dirty = 1');
  values.push(Date.now(), id);

  await getDb().runAsync(`UPDATE splits SET ${assignments.join(', ')} WHERE id = ?;`, values);
}

/**
 * Exactly one split is the default, enforced here rather than by the schema:
 * clear the flag everywhere, then set it on one row, both inside a transaction
 * so a crash can't leave you with zero defaults or two.
 */
export async function setDefaultSplit(id: string): Promise<void> {
  const db = getDb();
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE splits SET is_default = 0, updated_at = ?, dirty = 1 WHERE is_default = 1;`,
      [now],
    );
    await db.runAsync(
      `UPDATE splits SET is_default = 1, updated_at = ?, dirty = 1 WHERE id = ?;`,
      [now, id],
    );
  });
}

/**
 * Deep-copies a split — every day-group and every exercise within each —
 * into a new, non-default split named "<Name> copy". Used by the Splits list
 * to let you branch off an existing plan (try a variant of PPL) without
 * touching the original or its history.
 */
export async function duplicateSplit(id: string): Promise<string | null> {
  const db = getDb();
  const original = await getSplit(id);
  if (!original) return null;

  const days = await getSplitDays(id);
  const dayExercisesByDay = await Promise.all(days.map((d) => getDayExercises(d.id)));

  const now = Date.now();
  const newSplitId = newId();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO splits (id, name, is_default, schedule_mode, created_at, updated_at, dirty)
       VALUES (?, ?, 0, ?, ?, ?, 1);`,
      [newSplitId, `${original.name} copy`, original.schedule_mode, now, now],
    );

    for (let i = 0; i < days.length; i += 1) {
      const day = days[i];
      const newDayId = newId();
      await db.runAsync(
        `INSERT INTO split_days
           (id, split_id, name, position, weekday, color, created_at, updated_at, dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1);`,
        [newDayId, newSplitId, day.name, day.position, day.weekday, day.color, now, now],
      );

      for (const de of dayExercisesByDay[i]) {
        await db.runAsync(
          `INSERT INTO split_day_exercises
             (id, split_day_id, exercise_id, position, created_at, updated_at, dirty)
           VALUES (?, ?, ?, ?, ?, ?, 1);`,
          [newId(), newDayId, de.exercise_id, de.position, now, now],
        );
      }
    }
  });

  return newSplitId;
}

/** Soft-deletes a split and everything under it. */
export async function deleteSplit(id: string): Promise<void> {
  const db = getDb();
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE split_day_exercises SET deleted_at = ?, updated_at = ?, dirty = 1
        WHERE split_day_id IN (SELECT id FROM split_days WHERE split_id = ?);`,
      [now, now, id],
    );
    await db.runAsync(
      `UPDATE split_days SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE split_id = ?;`,
      [now, now, id],
    );
    await db.runAsync(`UPDATE splits SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;`, [
      now,
      now,
      id,
    ]);
  });
}

/* --------------------------------------------------------------- day groups */

export async function getSplitDays(splitId: string): Promise<SplitDay[]> {
  return getDb().getAllAsync<SplitDay>(
    `SELECT ${DAY_COLS} FROM split_days
      WHERE split_id = ? AND deleted_at IS NULL
      ORDER BY position ASC;`,
    [splitId],
  );
}

export async function createSplitDay(
  splitId: string,
  name: string,
  options: { weekday?: number | null; color?: string | null } = {},
): Promise<string> {
  const db = getDb();
  const now = Date.now();

  const last = await db.getFirstAsync<{ max_position: number | null }>(
    `SELECT MAX(position) AS max_position FROM split_days
      WHERE split_id = ? AND deleted_at IS NULL;`,
    [splitId],
  );
  const position = (last?.max_position ?? -1) + 1;

  const id = newId();
  await db.runAsync(
    `INSERT INTO split_days
       (id, split_id, name, position, weekday, color, created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1);`,
    [id, splitId, name.trim(), position, options.weekday ?? null, options.color ?? null, now, now],
  );

  return id;
}

export async function updateSplitDay(
  id: string,
  patch: { name?: string; weekday?: number | null; color?: string | null },
): Promise<void> {
  const assignments: string[] = [];
  const values: (string | number | null)[] = [];

  if (patch.name !== undefined) {
    assignments.push('name = ?');
    values.push(patch.name.trim());
  }
  if (patch.weekday !== undefined) {
    assignments.push('weekday = ?');
    values.push(patch.weekday);
  }
  if (patch.color !== undefined) {
    assignments.push('color = ?');
    values.push(patch.color);
  }
  if (assignments.length === 0) return;

  assignments.push('updated_at = ?', 'dirty = 1');
  values.push(Date.now(), id);

  await getDb().runAsync(`UPDATE split_days SET ${assignments.join(', ')} WHERE id = ?;`, values);
}

export async function deleteSplitDay(id: string): Promise<void> {
  const db = getDb();
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE split_day_exercises SET deleted_at = ?, updated_at = ?, dirty = 1
        WHERE split_day_id = ?;`,
      [now, now, id],
    );
    await db.runAsync(
      `UPDATE split_days SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
      [now, now, id],
    );
  });
}

/**
 * Writes a new day order. In rotation mode this order IS the rotation, so
 * dragging "Legs" above "Pull" genuinely changes what the app suggests next.
 */
export async function reorderSplitDays(orderedIds: string[]): Promise<void> {
  const db = getDb();
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await db.runAsync(
        `UPDATE split_days SET position = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
        [i, now, orderedIds[i]],
      );
    }
  });
}

/* --------------------------------------------------- exercises within a day */

export interface DayExercise {
  /** The join row's id — what you delete or reorder. */
  id: string;
  exercise_id: string;
  position: number;
}

export async function getDayExercises(splitDayId: string): Promise<DayExercise[]> {
  return getDb().getAllAsync<DayExercise>(
    `SELECT id, exercise_id, position FROM split_day_exercises
      WHERE split_day_id = ? AND deleted_at IS NULL
      ORDER BY position ASC;`,
    [splitDayId],
  );
}

export async function addExerciseToDay(splitDayId: string, exerciseId: string): Promise<string> {
  const db = getDb();
  const now = Date.now();

  const last = await db.getFirstAsync<{ max_position: number | null }>(
    `SELECT MAX(position) AS max_position FROM split_day_exercises
      WHERE split_day_id = ? AND deleted_at IS NULL;`,
    [splitDayId],
  );
  const position = (last?.max_position ?? -1) + 1;

  const id = newId();
  await db.runAsync(
    `INSERT INTO split_day_exercises
       (id, split_day_id, exercise_id, position, created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, 1);`,
    [id, splitDayId, exerciseId, position, now, now],
  );

  return id;
}

export async function removeExerciseFromDay(dayExerciseId: string): Promise<void> {
  const now = Date.now();
  await getDb().runAsync(
    `UPDATE split_day_exercises SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
    [now, now, dayExerciseId],
  );
}

/**
 * Swaps this day-group slot for a different exercise, in place — an UPDATE,
 * not a remove+`addExerciseToDay`. `addExerciseToDay` always appends at
 * `MAX(position)+1`, so a delete-then-add "swap" would silently move the
 * exercise to the end of the day's order. Mirrors `swapWorkoutExercise`'s
 * own in-place `UPDATE`, the same fix for the same reason on the
 * active-workout side.
 */
export async function swapExerciseInDay(dayExerciseId: string, newExerciseId: string): Promise<void> {
  const now = Date.now();
  await getDb().runAsync(
    `UPDATE split_day_exercises SET exercise_id = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
    [newExerciseId, now, dayExerciseId],
  );
}

export async function reorderDayExercises(orderedIds: string[]): Promise<void> {
  const db = getDb();
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await db.runAsync(
        `UPDATE split_day_exercises SET position = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
        [i, now, orderedIds[i]],
      );
    }
  });
}
