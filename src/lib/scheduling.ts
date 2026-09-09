import type { ScheduleMode, SplitDay } from '@/db/types';

/**
 * Which day-group does the app suggest today?
 *
 * Deliberately a pure function — no database, no clock of its own — so the rule
 * can be reasoned about and unit-tested in isolation. The Today screen fetches
 * the ingredients and calls this; if the wrong day is being suggested, this file
 * is the only place the logic lives.
 */

export type SuggestionReason =
  /** Rotation mode: the group after the one you last finished. */
  | 'rotation'
  /** Rotation mode: nothing logged yet, so start at the top of the order. */
  | 'first'
  /** Calendar mode: this weekday has a group assigned. */
  | 'calendar'
  /** Calendar mode: this weekday has nothing assigned. */
  | 'rest'
  /** The split has no day-groups at all. */
  | 'empty';

export interface DaySuggestion {
  day: SplitDay | null;
  reason: SuggestionReason;
}

export interface ResolveInput {
  mode: ScheduleMode;
  /** The split's day-groups, already ordered by `position`. */
  days: SplitDay[];
  /** `split_day_id` of the most recent FINISHED workout in this split. */
  lastFinishedDayId: string | null;
  /** Injected so tests can pin a weekday. Defaults to now. */
  now?: number;
}

export function resolveSuggestedDay(input: ResolveInput): DaySuggestion {
  const { mode, days, lastFinishedDayId } = input;
  const now = input.now ?? Date.now();

  if (days.length === 0) return { day: null, reason: 'empty' };

  if (mode === 'calendar') {
    // 0 = Sunday … 6 = Saturday, matching JavaScript's getDay().
    const weekday = new Date(now).getDay();
    const match = days.find((d) => d.weekday === weekday);
    return match ? { day: match, reason: 'calendar' } : { day: null, reason: 'rest' };
  }

  // Rotation mode. The rotation advances on what you ACTUALLY finished, not on
  // the calendar — so rest days, skipped days and holidays are all irrelevant,
  // and an override re-anchors the sequence automatically.
  if (!lastFinishedDayId) return { day: days[0], reason: 'first' };

  const lastIndex = days.findIndex((d) => d.id === lastFinishedDayId);

  // The day you last trained has since been deleted from the split. Falling
  // back to the start beats crashing or suggesting nothing.
  if (lastIndex === -1) return { day: days[0], reason: 'first' };

  return { day: days[(lastIndex + 1) % days.length], reason: 'rotation' };
}

/**
 * What the header says above the group buttons.
 *
 * Calendar mode names the weekday because that is the rule in force; rotation
 * mode does not, because in rotation mode the date is genuinely irrelevant.
 */
export function describeSuggestion(suggestion: DaySuggestion, mode: ScheduleMode): string {
  switch (suggestion.reason) {
    case 'rotation':
      return 'Next in your rotation';
    case 'first':
      return mode === 'rotation' ? 'Starting your rotation' : 'First workout';
    case 'calendar':
      return 'Scheduled for today';
    case 'rest':
      return 'Rest day — pick a group to train anyway';
    case 'empty':
      return 'This split has no days yet';
  }
}

/**
 * After finishing `dayId`, what comes next? Used by the summary screen to tell
 * you what tomorrow looks like. Returns null in calendar mode, where "next"
 * depends on the date rather than on what you just did.
 */
export function peekNextDay(
  mode: ScheduleMode,
  days: SplitDay[],
  dayId: string | null,
): SplitDay | null {
  if (mode !== 'rotation' || days.length === 0 || !dayId) return null;

  const index = days.findIndex((d) => d.id === dayId);
  if (index === -1) return null;

  return days[(index + 1) % days.length];
}
