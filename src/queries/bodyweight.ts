import { getDb } from '@/db/client';
import type { BodyweightLog } from '@/db/types';
import { newId } from '@/lib/id';

const COLS = 'id, weight_kg, logged_on, note';

export async function listBodyweightLogs(limit = 90): Promise<BodyweightLog[]> {
  return getDb().getAllAsync<BodyweightLog>(
    `SELECT ${COLS} FROM bodyweight_logs
      WHERE deleted_at IS NULL
      ORDER BY logged_on DESC
      LIMIT ?;`,
    [limit],
  );
}

export async function getLatestBodyweight(): Promise<BodyweightLog | null> {
  return getDb().getFirstAsync<BodyweightLog>(
    `SELECT ${COLS} FROM bodyweight_logs
      WHERE deleted_at IS NULL
      ORDER BY logged_on DESC LIMIT 1;`,
  );
}

/**
 * Logs today's (or any day's) weight. One entry per `logged_on` — logging
 * again for a date that already has an entry updates it in place rather than
 * creating a second row, so re-weighing yourself the same morning doesn't
 * double up the trend chart.
 */
export async function logBodyweight(
  weightKg: number,
  loggedOn: string,
  note: string | null = null,
): Promise<string> {
  const db = getDb();
  const now = Date.now();

  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM bodyweight_logs WHERE logged_on = ? AND deleted_at IS NULL LIMIT 1;`,
    [loggedOn],
  );

  if (existing) {
    await db.runAsync(
      `UPDATE bodyweight_logs SET weight_kg = ?, note = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
      [weightKg, note, now, existing.id],
    );
    return existing.id;
  }

  const id = newId();
  await db.runAsync(
    `INSERT INTO bodyweight_logs (id, weight_kg, logged_on, note, created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, 1);`,
    [id, weightKg, loggedOn, note, now, now],
  );
  return id;
}

export async function deleteBodyweightLog(id: string): Promise<void> {
  const now = Date.now();
  await getDb().runAsync(
    `UPDATE bodyweight_logs SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
    [now, now, id],
  );
}
