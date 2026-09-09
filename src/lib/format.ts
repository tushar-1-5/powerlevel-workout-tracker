/** Date and duration formatting. All dates are handled in the device's local zone. */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const WEEKDAY_LABELS = DAY_SHORT;
export const WEEKDAY_FULL = DAY_NAMES;

/** "Tue 29 Aug" */
export function formatShortDate(ms: number): string {
  const d = new Date(ms);
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** "Tuesday, 29 August 2026" */
export function formatLongDate(ms: number): string {
  const d = new Date(ms);
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "August 2026" — History section headers. */
export function formatMonthYear(ms: number): string {
  const d = new Date(ms);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "1:04:12" while a workout runs, "48:20" when under an hour. */
/** `null` means "unknown" (a backfilled session logged without a remembered duration) — renders as "-", never "0:00". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** "Today", "Yesterday", "4 days ago", then falls back to a date. */
export function formatRelativeDay(ms: number): string {
  const days = daysBetween(startOfDay(ms), startOfDay(Date.now()));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatShortDate(ms);
}

/** Midnight local time for the day containing `ms`. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Whole days between two midnights.
 *
 * Divides by 24h AFTER both sides have been floored to local midnight, so a
 * daylight-saving shift (a 23- or 25-hour day) still rounds to a whole number
 * instead of drifting to 0 or 2.
 */
export function daysBetween(fromMs: number, toMs: number): number {
  return Math.round((toMs - fromMs) / 86_400_000);
}

/** "YYYY-MM-DD" in local time — the storage format for bodyweight entries. */
export function toDateKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses "YYYY-MM-DD" back to local midnight. */
export function fromDateKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}
