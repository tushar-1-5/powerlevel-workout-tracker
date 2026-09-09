import { daysBetween, fromDateKey, startOfDay, toDateKey } from './format.ts';

/**
 * The current training streak, in days.
 *
 * The PRD's §7 asks for "consistency calendar heatmap + streak" without
 * defining the algorithm. A strict "did you train every single calendar
 * day" streak resets constantly for a normal 3-5x/week routine, which reads
 * as broken rather than honest. Instead: the streak is the run of training
 * days, counting back from today, allowed up to `graceDays` consecutive
 * rest days between two training days before the streak is considered
 * broken. Today itself doesn't have to be a training day yet — the day
 * isn't over — so a streak that ended yesterday still counts as current.
 *
 * Pure and clock-injectable (`now`) so this is unit-testable without a
 * database, same reasoning as `resolveSuggestedDay` in Block 5.
 */
export function computeStreak(trainingDayKeys: Set<string>, now: number, graceDays = 1): number {
  const today = startOfDay(now);
  const todayKey = toDateKey(today);

  // If you haven't trained yet today, start counting from yesterday instead
  // of treating "no workout logged in the last few hours" as a broken streak.
  let cursor = trainingDayKeys.has(todayKey) ? today : today - 86_400_000;

  let streak = 0;
  let gap = 0;

  while (true) {
    const key = toDateKey(cursor);
    if (trainingDayKeys.has(key)) {
      streak += 1;
      gap = 0;
    } else {
      gap += 1;
      if (gap > graceDays) break;
    }
    cursor -= 86_400_000;

    // Safety valve: never scan more than ~2 years back.
    if (daysBetween(cursor, today) > 730) break;
  }

  return streak;
}

/**
 * The longest streak ever achieved, anywhere in history — not just the run
 * counting back from today (that's `computeStreak`, above). Same grace-day
 * rule: up to `graceDays` consecutive rest days between two training days
 * doesn't break the run.
 *
 * A genuinely different algorithm from `computeStreak`, not a variant of
 * it — that one only ever walks backward from "now" and stops at the first
 * gap it finds, so it can only ever report the *current* run. Finding the
 * best run anywhere means a full scan of every training day, in order,
 * tracking run boundaries as it goes. No clock dependency at all — unlike
 * the current streak, "best ever" doesn't care what today is.
 */
export function computeBestStreak(trainingDayKeys: Set<string>, graceDays = 1): number {
  if (trainingDayKeys.size === 0) return 0;

  const days = [...trainingDayKeys].map(fromDateKey).sort((a, b) => a - b);

  let best = 1;
  let current = 1;
  for (let i = 1; i < days.length; i += 1) {
    // Whole rest days strictly between two consecutive training days.
    const gapDays = daysBetween(days[i - 1], days[i]) - 1;
    current = gapDays <= graceDays ? current + 1 : 1;
    best = Math.max(best, current);
  }
  return best;
}
