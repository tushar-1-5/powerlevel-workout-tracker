import * as SQLite from 'expo-sqlite';

import { MIGRATIONS } from './migrations';

const DB_NAME = 'powerlevel.db';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Opens the database and brings it up to the latest schema version.
 *
 * Migration state lives in SQLite's own `user_version` pragma, so there is no
 * bookkeeping table to keep in sync and no build-time codegen step. Each entry
 * in MIGRATIONS is one version; every statement in an entry runs inside a single
 * transaction, so a failed migration leaves the previous version intact.
 */
export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  const handle = await SQLite.openDatabaseAsync(DB_NAME);

  // WAL keeps reads from blocking the writes we do mid-set.
  await handle.execAsync('PRAGMA journal_mode = WAL;');
  await handle.execAsync('PRAGMA foreign_keys = ON;');

  const row = await handle.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  let version = row?.user_version ?? 0;

  while (version < MIGRATIONS.length) {
    const statements = MIGRATIONS[version];
    await handle.withTransactionAsync(async () => {
      for (const sql of statements) {
        await handle.execAsync(sql);
      }
    });
    version += 1;
    // PRAGMA cannot be parameterised, and `version` is a loop counter we own.
    await handle.execAsync(`PRAGMA user_version = ${version};`);
  }

  db = handle;
  return db;
}

/**
 * The open handle. Throws if called before {@link openDatabase} has resolved —
 * the root layout gates the whole app on that, so in practice this is safe
 * everywhere below it.
 */
export function getDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('Database accessed before openDatabase() completed.');
  return db;
}

/** Test/debug helper: wipes the database file and forces a fresh migrate. */
export async function resetDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
  await SQLite.deleteDatabaseAsync(DB_NAME);
}
