import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { SplitDay } from '../db/types.ts';
import { peekNextDay, resolveSuggestedDay } from './scheduling.ts';

/** Minimal SplitDay factory — only the fields the scheduler actually reads. */
function day(id: string, position: number, weekday: number | null = null): SplitDay {
  return { id, split_id: 'split-1', name: id, position, weekday, color: null };
}

const PUSH = day('push', 0);
const PULL = day('pull', 1);
const LEGS = day('legs', 2);
const PPL = [PUSH, PULL, LEGS];

describe('rotation mode', () => {
  it('starts at the top of the order when nothing has been logged', () => {
    const result = resolveSuggestedDay({ mode: 'rotation', days: PPL, lastFinishedDayId: null });
    assert.equal(result.day?.id, 'push');
    assert.equal(result.reason, 'first');
  });

  it('suggests the day after the one you last finished', () => {
    const result = resolveSuggestedDay({ mode: 'rotation', days: PPL, lastFinishedDayId: 'push' });
    assert.equal(result.day?.id, 'pull');
    assert.equal(result.reason, 'rotation');
  });

  it('wraps around at the end of the split', () => {
    const result = resolveSuggestedDay({ mode: 'rotation', days: PPL, lastFinishedDayId: 'legs' });
    assert.equal(result.day?.id, 'push');
  });

  it('re-anchors after an override: doing Legs out of turn makes Push next', () => {
    // The user was offered Pull but trained Legs. The rotation follows reality.
    const result = resolveSuggestedDay({ mode: 'rotation', days: PPL, lastFinishedDayId: 'legs' });
    assert.equal(result.day?.id, 'push');
  });

  it('falls back to the first day when the last-trained day was deleted', () => {
    const result = resolveSuggestedDay({ mode: 'rotation', days: PPL, lastFinishedDayId: 'gone' });
    assert.equal(result.day?.id, 'push');
    assert.equal(result.reason, 'first');
  });

  it('ignores the calendar entirely — rest days do not advance the rotation', () => {
    const monday = resolveSuggestedDay({
      mode: 'rotation',
      days: PPL,
      lastFinishedDayId: 'push',
      now: new Date(2026, 7, 24).getTime(),
    });
    const thursday = resolveSuggestedDay({
      mode: 'rotation',
      days: PPL,
      lastFinishedDayId: 'push',
      now: new Date(2026, 7, 27).getTime(),
    });
    assert.equal(monday.day?.id, thursday.day?.id);
  });

  it('reports empty when the split has no days', () => {
    const result = resolveSuggestedDay({ mode: 'rotation', days: [], lastFinishedDayId: null });
    assert.equal(result.day, null);
    assert.equal(result.reason, 'empty');
  });
});

describe('calendar mode', () => {
  const noon = new Date(2026, 7, 29, 12, 0).getTime();
  const todayWeekday = new Date(noon).getDay();

  it('suggests whatever is assigned to that weekday', () => {
    const days = [day('upper', 0, todayWeekday), day('lower', 1, (todayWeekday + 2) % 7)];
    const result = resolveSuggestedDay({
      mode: 'calendar',
      days,
      lastFinishedDayId: null,
      now: noon,
    });
    assert.equal(result.day?.id, 'upper');
    assert.equal(result.reason, 'calendar');
  });

  it('reports a rest day when no group is assigned to this weekday', () => {
    const days = [day('upper', 0, (todayWeekday + 1) % 7)];
    const result = resolveSuggestedDay({
      mode: 'calendar',
      days,
      lastFinishedDayId: null,
      now: noon,
    });
    assert.equal(result.day, null);
    assert.equal(result.reason, 'rest');
  });

  it('ignores what you last trained — the date is the only input', () => {
    const days = [day('upper', 0, todayWeekday), day('lower', 1, (todayWeekday + 3) % 7)];
    const result = resolveSuggestedDay({
      mode: 'calendar',
      days,
      lastFinishedDayId: 'upper',
      now: noon,
    });
    assert.equal(result.day?.id, 'upper');
  });
});

describe('peekNextDay', () => {
  it('returns the following day in rotation mode', () => {
    assert.equal(peekNextDay('rotation', PPL, 'pull')?.id, 'legs');
  });

  it('wraps at the end', () => {
    assert.equal(peekNextDay('rotation', PPL, 'legs')?.id, 'push');
  });

  it('returns null in calendar mode, where next depends on the date', () => {
    assert.equal(peekNextDay('calendar', PPL, 'push'), null);
  });

  it('returns null when the day is unknown', () => {
    assert.equal(peekNextDay('rotation', PPL, 'gone'), null);
  });
});
