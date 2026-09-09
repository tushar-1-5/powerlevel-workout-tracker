import type { AppSettings, Units } from '@/db/types';

const LB_PER_KG = 2.2046226218;

/**
 * Weight is ALWAYS stored in kilograms. Pounds exist only as a display
 * conversion applied at the edge, right before rendering, and reversed the
 * moment a typed value comes back in. Nothing between here and the database
 * ever has to wonder which unit a number is in.
 */
export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/** Storage value (kg) -> the number shown on screen. */
export function toDisplay(kg: number, units: Units): number {
  return units === 'lb' ? round2(kgToLb(kg)) : kg;
}

/** A number the user typed or stepped -> storage value (kg). */
export function fromDisplay(shown: number, units: Units): number {
  return units === 'lb' ? round2(lbToKg(shown)) : shown;
}

/**
 * The arrow step, in DISPLAY units.
 *
 * lb mode gets its own step rather than converting the kg one, so holding the
 * arrow moves in clean 1 lb increments instead of 1.102 lb.
 */
export function displayStep(settings: AppSettings): number {
  return settings.units === 'lb' ? settings.weight_step_lb : settings.weight_step_kg;
}

export const UNIT_LABEL: Record<Units, string> = { kg: 'kg', lb: 'lb' };

/** Two decimals is enough for any real plate, and kills float drift. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Snaps a value onto the step grid.
 *
 * Repeatedly adding 0.5 in floating point drifts (60 + 0.5 ... eventually gives
 * 62.50000000000001), which would render as a nonsense number and break the
 * "same weight as last time" comparison. Every stepper change runs through here.
 */
export function snapToStep(value: number, step: number): number {
  if (step <= 0) return round2(value);
  return round2(Math.round(value / step) * step);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * One press of an arrow.
 *
 * From a value already on the step grid this is a plain add. From an off-grid
 * value — you typed 62.3 with a 0.5 step — it snaps onto the grid in the
 * direction you pressed instead, so up gives 62.5 rather than 62.8. One press
 * always lands somewhere round.
 */
export function stepFrom(current: number, step: number, direction: 1 | -1): number {
  if (step <= 0) return current;

  const units = current / step;
  const onGrid = Math.abs(units - Math.round(units)) < 1e-9;

  if (onGrid) return round2(current + direction * step);
  return round2((direction === 1 ? Math.ceil(units) : Math.floor(units)) * step);
}

/**
 * Renders a weight for display: integers stay bare, fractions keep only the
 * decimals they need. 60 -> "60", 62.5 -> "62.5", 62.25 -> "62.25".
 */
export function formatWeight(value: number): string {
  const r = round2(value);
  if (Number.isInteger(r)) return String(r);
  return String(parseFloat(r.toFixed(2)));
}

/** Total kilograms moved: weight x reps, summed by the caller. */
export function setVolumeKg(weightKg: number, reps: number): number {
  return round2(weightKg * reps);
}
