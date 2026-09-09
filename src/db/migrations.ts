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
];
