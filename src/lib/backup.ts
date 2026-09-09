import { getDb } from '@/db/client';

// Dynamic imports, not static ones, for these three specifically — they're
// native modules, and until a fresh dev-client build actually contains their
// native code (see the note on `exportBackup`/`importBackup` below), merely
// bundling a static `import` of them is enough to crash the whole app at
// startup, since `settings.tsx` pulls this file in as part of the normal
// route graph. A dynamic `import()` only resolves the module the moment
// Export/Import is actually tapped, so the rest of the app stays usable in
// the meantime.

const BACKUP_VERSION = 1;

/** Every user-data table. `sync_meta` is excluded — it's Phase 4 device/cursor state, not data worth backing up. */
const TABLES = [
  'exercises',
  'splits',
  'split_days',
  'split_day_exercises',
  'workouts',
  'workout_exercises',
  'sets',
  'bodyweight_logs',
  'settings',
] as const;

export interface BackupFile {
  version: number;
  exportedAt: number;
  tables: Record<string, Record<string, unknown>[]>;
}

/**
 * Dumps every table — including soft-deleted rows, so a restore is a true
 * mirror rather than one that quietly resurrects things you'd deleted — to
 * one JSON file, then opens the native share sheet to save or send it.
 *
 * Requires a dev client built AFTER `expo-file-system`/`expo-sharing` were
 * added — `npx expo start` alone can't add native code to an already-built
 * binary. Rebuild via `eas build --profile development --platform android`.
 */
export async function exportBackup(): Promise<void> {
  const [{ File, Paths }, Sharing] = await Promise.all([
    import('expo-file-system'),
    import('expo-sharing'),
  ]);

  const db = getDb();
  const tables: Record<string, Record<string, unknown>[]> = {};

  for (const table of TABLES) {
    tables[table] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table};`);
  }

  const backup: BackupFile = { version: BACKUP_VERSION, exportedAt: Date.now(), tables };
  const fileName = `powerlevel-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File(Paths.document, fileName);
  file.write(JSON.stringify(backup));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save PowerLevel backup' });
  }
}

export interface ImportResult {
  /** False for a user cancel, not just a real failure — the caller shouldn't show an error for that. */
  ok: boolean;
  error?: string;
}

/**
 * Picks a backup `.json` file and REPLACES every table's contents with it —
 * destructive, and the caller is responsible for confirming with the user
 * before calling this (see the Alert in `settings.tsx`). Same fresh-dev-client
 * requirement as `exportBackup` above.
 */
export async function importBackup(): Promise<ImportResult> {
  const [DocumentPicker, { File }] = await Promise.all([
    import('expo-document-picker'),
    import('expo-file-system'),
  ]);

  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (picked.canceled || picked.assets.length === 0) return { ok: false };

  const raw = await new File(picked.assets[0].uri).text();

  let backup: BackupFile;
  try {
    backup = JSON.parse(raw) as BackupFile;
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (!backup.tables || typeof backup.tables !== 'object') {
    return { ok: false, error: "That file doesn't look like a PowerLevel backup." };
  }

  const db = getDb();

  await db.withTransactionAsync(async () => {
    for (const table of TABLES) {
      await db.runAsync(`DELETE FROM ${table};`);
    }

    for (const table of TABLES) {
      for (const row of backup.tables[table] ?? []) {
        // Column names come from parsed JSON — untrusted input, even though
        // it's a file the user picked themselves rather than anything
        // network-facing. Restricting to identifier-safe characters before
        // they're interpolated into the SQL string closes off the
        // injection vector cheaply, without needing a full per-table schema
        // whitelist for what's still a single-device personal backup file.
        const columns = Object.keys(row).filter((c) => /^[a-z_]+$/.test(c));
        if (columns.length === 0) continue;

        const placeholders = columns.map(() => '?').join(', ');
        await db.runAsync(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders});`,
          columns.map((c) => row[c] as string | number | null),
        );
      }
    }
  });

  return { ok: true };
}
