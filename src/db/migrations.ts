/**
 * Schema migrations, applied in order and tracked via SQLite's `user_version`.
 *
 * Every user table carries `created_at` / `updated_at` / `deleted_at` (soft
 * delete) / `dirty`, and uses a UUID primary key. That combination is what makes
 * the Phase 4 Supabase sync additive rather than a rewrite: two devices can
 * create rows without colliding, deletes survive a pull, and `dirty` marks the
 * push queue. Nothing in Phase 1 reads those columns except the writers that
 * maintain them.
 *
 * Timestamps are epoch milliseconds (INTEGER). Weight is ALWAYS kilograms;
 * pounds exist only as a display conversion.
 */

import { PER_SIDE_SEED_NAMES } from './seed/weightModes';

/**
 * The v3 backfill's `IN (...)` list, as SQL string literals.
 *
 * Reads the same frozen set the first-launch seeder uses, so an upgraded install
 * and a fresh one end up with identical defaults. They genuinely need both
 * paths: `ensureSeeded` no-ops when the table has rows, so on an upgrade this
 * UPDATE is what applies the presets — while on a fresh install migrations run
 * against an empty table, this matches nothing, and the seeder's INSERT carries
 * the mode instead.
 */
function perSideNameList(): string {
  return [...PER_SIDE_SEED_NAMES].map((name) => `'${name.replace(/'/g, "''")}'`).join(', ');
}

/** Bump by appending to this array. Never edit a released migration in place. */
export const MIGRATIONS: string[][] = [
  // ---------------------------------------------------------------- v1
  [
    `CREATE TABLE exercises (
      id            TEXT PRIMARY KEY NOT NULL,
      name          TEXT NOT NULL,
      muscle_group  TEXT NOT NULL,
      equipment     TEXT NOT NULL,
      is_custom     INTEGER NOT NULL DEFAULT 0,
      rep_chips     TEXT,
      notes         TEXT,
      archived      INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      deleted_at    INTEGER,
      dirty         INTEGER NOT NULL DEFAULT 1
    );`,
    `CREATE INDEX idx_exercises_lookup ON exercises (archived, deleted_at, name);`,

    `CREATE TABLE splits (
      id            TEXT PRIMARY KEY NOT NULL,
      name          TEXT NOT NULL,
      is_default    INTEGER NOT NULL DEFAULT 0,
      schedule_mode TEXT NOT NULL DEFAULT 'rotation',
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      deleted_at    INTEGER,
      dirty         INTEGER NOT NULL DEFAULT 1
    );`,

    `CREATE TABLE split_days (
      id          TEXT PRIMARY KEY NOT NULL,
      split_id    TEXT NOT NULL,
      name        TEXT NOT NULL,
      position    INTEGER NOT NULL,
      weekday     INTEGER,
      color       TEXT,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      deleted_at  INTEGER,
      dirty       INTEGER NOT NULL DEFAULT 1
    );`,
    `CREATE INDEX idx_split_days_split ON split_days (split_id, deleted_at, position);`,

    `CREATE TABLE split_day_exercises (
      id            TEXT PRIMARY KEY NOT NULL,
      split_day_id  TEXT NOT NULL,
      exercise_id   TEXT NOT NULL,
      position      INTEGER NOT NULL,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      deleted_at    INTEGER,
      dirty         INTEGER NOT NULL DEFAULT 1
    );`,
    `CREATE INDEX idx_sde_day ON split_day_exercises (split_day_id, deleted_at, position);`,

    `CREATE TABLE workouts (
      id            TEXT PRIMARY KEY NOT NULL,
      split_id      TEXT,
      split_day_id  TEXT,
      day_name      TEXT NOT NULL,
      started_at    INTEGER NOT NULL,
      finished_at   INTEGER,
      duration_seconds INTEGER,
      notes         TEXT,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      deleted_at    INTEGER,
      dirty         INTEGER NOT NULL DEFAULT 1
    );`,
    `CREATE INDEX idx_workouts_started ON workouts (deleted_at, started_at DESC);`,
    `CREATE INDEX idx_workouts_finished ON workouts (deleted_at, finished_at DESC);`,

    `CREATE TABLE workout_exercises (
      id            TEXT PRIMARY KEY NOT NULL,
      workout_id    TEXT NOT NULL,
      exercise_id   TEXT NOT NULL,
      position      INTEGER NOT NULL,
      substituted_for_exercise_id TEXT,
      is_ad_hoc     INTEGER NOT NULL DEFAULT 0,
      skipped       INTEGER NOT NULL DEFAULT 0,
      notes         TEXT,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      deleted_at    INTEGER,
      dirty         INTEGER NOT NULL DEFAULT 1
    );`,
    `CREATE INDEX idx_we_workout ON workout_exercises (workout_id, deleted_at, position);`,
    `CREATE INDEX idx_we_exercise ON workout_exercises (exercise_id, deleted_at);`,

    `CREATE TABLE sets (
      id                  TEXT PRIMARY KEY NOT NULL,
      workout_exercise_id TEXT NOT NULL,
      position            INTEGER NOT NULL,
      weight_kg           REAL NOT NULL,
      reps                INTEGER NOT NULL,
      set_type            TEXT NOT NULL DEFAULT 'working',
      to_failure          INTEGER NOT NULL DEFAULT 0,
      parent_set_id       TEXT,
      notes               TEXT,
      logged_at           INTEGER NOT NULL,
      created_at          INTEGER NOT NULL,
      updated_at          INTEGER NOT NULL,
      deleted_at          INTEGER,
      dirty               INTEGER NOT NULL DEFAULT 1
    );`,
    `CREATE INDEX idx_sets_we ON sets (workout_exercise_id, deleted_at, position);`,
    `CREATE INDEX idx_sets_parent ON sets (parent_set_id);`,

    `CREATE TABLE bodyweight_logs (
      id          TEXT PRIMARY KEY NOT NULL,
      weight_kg   REAL NOT NULL,
      logged_on   TEXT NOT NULL,
      note        TEXT,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      deleted_at  INTEGER,
      dirty       INTEGER NOT NULL DEFAULT 1
    );`,
    `CREATE INDEX idx_bw_date ON bodyweight_logs (deleted_at, logged_on DESC);`,

    `CREATE TABLE settings (
      id                 INTEGER PRIMARY KEY CHECK (id = 1),
      weight_step_kg     REAL NOT NULL DEFAULT 0.5,
      weight_step_lb     REAL NOT NULL DEFAULT 1,
      units              TEXT NOT NULL DEFAULT 'kg',
      rep_chips          TEXT NOT NULL DEFAULT '[8,10,12]',
      haptics_enabled    INTEGER NOT NULL DEFAULT 1,
      animations_enabled INTEGER NOT NULL DEFAULT 1,
      active_split_id    TEXT,
      onboarded          INTEGER NOT NULL DEFAULT 0,
      updated_at         INTEGER NOT NULL,
      dirty              INTEGER NOT NULL DEFAULT 1
    );`,

    `INSERT INTO settings (id, updated_at) VALUES (1, CAST(strftime('%s','now') AS INTEGER) * 1000);`,

    /** Phase 4 scaffolding: last successful pull cursor, device identity. */
    `CREATE TABLE sync_meta (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );`,
  ],

  // ---------------------------------------------------------------- v2
  // Links a session's copy of an exercise back to the split-day slot it was
  // copied from (or later synced to), so mid-workout add/swap/reorder/remove
  // can write the same change back into the split. Nullable and no default:
  // every row created before this migration has no known split link, which
  // is the correct, honest value for it — not an error state.
  [
    `ALTER TABLE workout_exercises ADD COLUMN source_split_day_exercise_id TEXT;`,
  ],

  // ---------------------------------------------------------------- v3
  // Whether an exercise's logged weight is the total load or the load per side.
  // Defaults to 'total' — the literal meaning every already-logged row had
  // before this column existed — and the backfill below then flips the stock
  // exercises where 'per_side' is the honest reading (a pair of dumbbells, a
  // single arm on a cable).
  //
  // Matched by `name`, which is already this schema's cross-reference for
  // exercises: `seed/splits.ts` resolves its templates by name too. Custom rows
  // are included deliberately — someone who typed their own "Hammer Curl" meant
  // the same exercise and wants the same default.
  //
  // `updated_at`/`dirty` are bumped so the Phase 4 sync push queue sees rows it
  // needs to send, same as any ordinary write would.
  [
    `ALTER TABLE exercises ADD COLUMN weight_mode TEXT NOT NULL DEFAULT 'total';`,
    `UPDATE exercises
        SET weight_mode = 'per_side',
            updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000,
            dirty = 1
      WHERE name IN (${perSideNameList()});`,
  ],
];
