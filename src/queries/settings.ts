import { getDb } from '@/db/client';
import type { AppSettings, Units } from '@/db/types';
import { setHapticsEnabled } from '@/lib/haptics';

export const DEFAULT_REP_CHIPS = [8, 10, 12];

/** The raw shape SQLite hands back: no booleans, no arrays. */
interface SettingsRow {
  weight_step_kg: number;
  weight_step_lb: number;
  units: Units;
  rep_chips: string;
  haptics_enabled: number;
  animations_enabled: number;
  active_split_id: string | null;
  onboarded: number;
}

/**
 * Settings live in a single row pinned to `id = 1` by a CHECK constraint, so
 * there is never a question of which row is current. Booleans are stored as
 * 0/1 and JSON as text, because SQLite has neither type — this module is the
 * only place that translation happens.
 */
export async function getSettings(): Promise<AppSettings> {
  const row = await getDb().getFirstAsync<SettingsRow>(
    `SELECT weight_step_kg, weight_step_lb, units, rep_chips,
            haptics_enabled, animations_enabled, active_split_id, onboarded
       FROM settings WHERE id = 1;`,
  );

  if (!row) throw new Error('Settings row missing — the initial migration did not run.');

  const settings: AppSettings = {
    weight_step_kg: row.weight_step_kg,
    weight_step_lb: row.weight_step_lb,
    units: row.units,
    rep_chips: parseChips(row.rep_chips),
    haptics_enabled: row.haptics_enabled === 1,
    animations_enabled: row.animations_enabled === 1,
    active_split_id: row.active_split_id,
    onboarded: row.onboarded === 1,
  };

  // Keep the haptics module in step without every caller remembering to.
  setHapticsEnabled(settings.haptics_enabled);
  return settings;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const assignments: string[] = [];
  const values: (string | number | null)[] = [];

  const set = (column: string, value: string | number | null) => {
    assignments.push(`${column} = ?`);
    values.push(value);
  };

  if (patch.weight_step_kg !== undefined) set('weight_step_kg', patch.weight_step_kg);
  if (patch.weight_step_lb !== undefined) set('weight_step_lb', patch.weight_step_lb);
  if (patch.units !== undefined) set('units', patch.units);
  if (patch.rep_chips !== undefined) set('rep_chips', JSON.stringify(patch.rep_chips));
  if (patch.haptics_enabled !== undefined) set('haptics_enabled', patch.haptics_enabled ? 1 : 0);
  if (patch.animations_enabled !== undefined) {
    set('animations_enabled', patch.animations_enabled ? 1 : 0);
  }
  if (patch.active_split_id !== undefined) set('active_split_id', patch.active_split_id);
  if (patch.onboarded !== undefined) set('onboarded', patch.onboarded ? 1 : 0);

  if (assignments.length === 0) return;

  set('updated_at', Date.now());
  set('dirty', 1);

  // Values are bound as parameters (the `?` placeholders); only column names,
  // which come from this function's own literals, are interpolated.
  await getDb().runAsync(`UPDATE settings SET ${assignments.join(', ')} WHERE id = 1;`, values);

  if (patch.haptics_enabled !== undefined) setHapticsEnabled(patch.haptics_enabled);
}

/**
 * Chips are user-editable, so a corrupt or empty value must not take the
 * logging screen down mid-workout — fall back to the default row instead.
 */
function parseChips(raw: string): number[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_REP_CHIPS;
    const chips = parsed.filter((n): n is number => typeof n === 'number' && n > 0);
    return chips.length > 0 ? chips : DEFAULT_REP_CHIPS;
  } catch {
    return DEFAULT_REP_CHIPS;
  }
}
