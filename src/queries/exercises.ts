import { getDb } from '@/db/client';
import type { Equipment, Exercise, MuscleGroup } from '@/db/types';
import { newId } from '@/lib/id';

/**
 * Columns selected everywhere an Exercise is returned. Kept in one constant so
 * a schema addition can't leave one query returning a half-populated object.
 */
const COLS = 'id, name, muscle_group, equipment, is_custom, rep_chips, notes, archived';

export interface ExerciseFilter {
  search?: string;
  muscleGroup?: MuscleGroup;
  equipment?: Equipment;
  includeArchived?: boolean;
}

export async function listExercises(filter: ExerciseFilter = {}): Promise<Exercise[]> {
  // Every read filters on `deleted_at IS NULL`. Soft-deleted rows stay in the
  // table for sync but must never reach the UI.
  const where: string[] = ['deleted_at IS NULL'];
  const params: (string | number)[] = [];

  if (!filter.includeArchived) where.push('archived = 0');

  if (filter.search?.trim()) {
    where.push('name LIKE ?');
    params.push(`%${filter.search.trim()}%`);
  }
  if (filter.muscleGroup) {
    where.push('muscle_group = ?');
    params.push(filter.muscleGroup);
  }
  if (filter.equipment) {
    where.push('equipment = ?');
    params.push(filter.equipment);
  }

  return getDb().getAllAsync<Exercise>(
    `SELECT ${COLS} FROM exercises
      WHERE ${where.join(' AND ')}
      ORDER BY name COLLATE NOCASE ASC;`,
    params,
  );
}

export async function getExercise(id: string): Promise<Exercise | null> {
  return getDb().getFirstAsync<Exercise>(
    `SELECT ${COLS} FROM exercises WHERE id = ? AND deleted_at IS NULL;`,
    [id],
  );
}

/**
 * Bulk lookup for screens that already hold a list of ids (a split day, a
 * workout). One query with an IN clause instead of N round-trips.
 */
export async function getExercisesByIds(ids: string[]): Promise<Map<string, Exercise>> {
  if (ids.length === 0) return new Map();

  const placeholders = ids.map(() => '?').join(', ');
  const rows = await getDb().getAllAsync<Exercise>(
    `SELECT ${COLS} FROM exercises
      WHERE id IN (${placeholders}) AND deleted_at IS NULL;`,
    ids,
  );

  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Turns a list of join rows (a split day's exercises, a workout's exercises —
 * anything with an `exercise_id`) into the `Exercise`s they point at, in the
 * same order, dropping any that resolved to nothing (soft-deleted since).
 * Paired with `getExercisesByIds` everywhere an ordered list is rendered.
 */
export function resolveOrderedExercises(
  rows: { exercise_id: string }[],
  byId: Map<string, Exercise>,
): Exercise[] {
  return rows.map((row) => byId.get(row.exercise_id)).filter((e): e is Exercise => e != null);
}

export interface NewExercise {
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  notes?: string | null;
  repChips?: number[] | null;
}

export async function createExercise(input: NewExercise): Promise<string> {
  const id = newId();
  const now = Date.now();

  await getDb().runAsync(
    `INSERT INTO exercises
       (id, name, muscle_group, equipment, is_custom, rep_chips, notes, archived,
        created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, 1, ?, ?, 0, ?, ?, 1);`,
    [
      id,
      input.name.trim(),
      input.muscle_group,
      input.equipment,
      input.repChips ? JSON.stringify(input.repChips) : null,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return id;
}

export async function updateExercise(
  id: string,
  patch: Partial<Pick<Exercise, 'name' | 'muscle_group' | 'equipment' | 'notes' | 'archived'>> & {
    repChips?: number[] | null;
  },
): Promise<void> {
  const assignments: string[] = [];
  const values: (string | number | null)[] = [];

  const set = (column: string, value: string | number | null) => {
    assignments.push(`${column} = ?`);
    values.push(value);
  };

  if (patch.name !== undefined) set('name', patch.name.trim());
  if (patch.muscle_group !== undefined) set('muscle_group', patch.muscle_group);
  if (patch.equipment !== undefined) set('equipment', patch.equipment);
  if (patch.notes !== undefined) set('notes', patch.notes);
  if (patch.archived !== undefined) set('archived', patch.archived);
  if (patch.repChips !== undefined) {
    set('rep_chips', patch.repChips ? JSON.stringify(patch.repChips) : null);
  }

  if (assignments.length === 0) return;

  set('updated_at', Date.now());
  set('dirty', 1);
  values.push(id);

  await getDb().runAsync(`UPDATE exercises SET ${assignments.join(', ')} WHERE id = ?;`, values);
}

/**
 * Soft delete. The row survives so the change can be pushed to the server, and
 * so any historical set that references it still resolves to a name.
 */
export async function deleteExercise(id: string): Promise<void> {
  const now = Date.now();
  await getDb().runAsync(
    `UPDATE exercises SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
    [now, now, id],
  );
}

/** Per-exercise rep chips, or null to mean "use the global setting". */
export function parseExerciseChips(exercise: Exercise): number[] | null {
  if (!exercise.rep_chips) return null;
  try {
    const parsed: unknown = JSON.parse(exercise.rep_chips);
    if (!Array.isArray(parsed)) return null;
    const chips = parsed.filter((n): n is number => typeof n === 'number' && n > 0);
    return chips.length > 0 ? chips : null;
  } catch {
    return null;
  }
}
