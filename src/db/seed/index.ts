import { getDb } from '@/db/client';
import { newId } from '@/lib/id';
import { addExerciseToDay, createSplit, createSplitDay } from '@/queries/splits';
import { listExercises } from '@/queries/exercises';

import { SEED_EXERCISES } from './exercises';
import type { SeedSplit } from './splits';

/**
 * Populates the stock exercise library on first launch.
 *
 * Guarded by a count rather than a "have I seeded?" flag: if the table has any
 * rows, this is a no-op. That makes it safe to call on every launch, and it
 * cannot resurrect exercises the user has since deleted.
 */
export async function ensureSeeded(): Promise<number> {
  const db = getDb();

  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM exercises;',
  );
  if ((existing?.count ?? 0) > 0) return existing?.count ?? 0;

  const now = Date.now();

  // One transaction for all 157 inserts. Individually they would be 157
  // separate disk commits and take visibly long on a phone; batched, it is
  // one commit and effectively instant.
  await db.withTransactionAsync(async () => {
    for (const [name, muscleGroup, equipment] of SEED_EXERCISES) {
      await db.runAsync(
        `INSERT INTO exercises
           (id, name, muscle_group, equipment, is_custom, archived, created_at, updated_at, dirty)
         VALUES (?, ?, ?, ?, 0, 0, ?, ?, 1);`,
        [newId(), name, muscleGroup, equipment, now, now],
      );
    }
  });

  return SEED_EXERCISES.length;
}

/** How many exercises are currently in the library. Used by the test bench. */
export async function countExercises(): Promise<number> {
  const row = await getDb().getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM exercises WHERE deleted_at IS NULL;',
  );
  return row?.count ?? 0;
}

/**
 * Creates one split from a `SEED_SPLITS` template — what onboarding's
 * template picker calls once you commit to a choice. Superseded the old
 * "seed all 4 templates at boot" behaviour from Block 5, which existed only
 * as a stand-in for onboarding not existing yet; that block's teaching notes
 * said as much at the time ("nothing here is thrown away later") — this is
 * that reuse.
 *
 * Validates every referenced exercise name before writing anything, so a
 * typo in `splits.ts` fails loudly instead of silently producing a shorter
 * split. Does NOT call `setDefaultSplit` — onboarding does that itself,
 * since it's the one place that knows this is the very first split.
 */
export async function createSplitFromTemplate(template: SeedSplit): Promise<string> {
  const db = getDb();

  const exercises = await listExercises({ includeArchived: true });
  const idByName = new Map(exercises.map((e) => [e.name, e.id]));

  const missing = new Set<string>();
  for (const day of template.days) {
    for (const name of day.exercises) {
      if (!idByName.has(name)) missing.add(name);
    }
  }
  if (missing.size > 0) {
    throw new Error(`"${template.name}" references unknown exercises: ${[...missing].join(', ')}`);
  }

  let splitId = '';

  await db.withTransactionAsync(async () => {
    splitId = await createSplit(template.name, template.scheduleMode);
    for (const day of template.days) {
      const dayId = await createSplitDay(splitId, day.name);
      for (const exerciseName of day.exercises) {
        await addExerciseToDay(dayId, idByName.get(exerciseName)!);
      }
    }
  });

  return splitId;
}
