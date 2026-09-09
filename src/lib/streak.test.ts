import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeBestStreak, computeStreak } from './streak.ts';
import { toDateKey } from './format.ts';

const DAY = 86_400_000;

describe('computeStreak', () => {
  it('counts consecutive training days ending today', () => {
    const now = Date.now();
    const days = new Set([toDateKey(now), toDateKey(now - DAY), toDateKey(now - 2 * DAY)]);
    assert.equal(computeStreak(days, now), 3);
  });

  it('still counts as current if today has no workout logged yet', () => {
    const now = Date.now();
    const days = new Set([toDateKey(now - DAY), toDateKey(now - 2 * DAY)]);
    assert.equal(computeStreak(days, now), 2);
  });

  it('bridges a single rest day within the default grace window', () => {
    const now = Date.now();
    // Trained today and 2 days ago, rested yesterday.
    const days = new Set([toDateKey(now), toDateKey(now - 2 * DAY)]);
    assert.equal(computeStreak(days, now), 2);
  });

  it('breaks the streak once the gap exceeds the grace window', () => {
    const now = Date.now();
    const days = new Set([toDateKey(now), toDateKey(now - 3 * DAY)]);
    assert.equal(computeStreak(days, now, 1), 1);
  });

  it('returns 0 for an empty history', () => {
    assert.equal(computeStreak(new Set(), Date.now()), 0);
  });
});

describe('computeBestStreak', () => {
  it('finds a run buried in the past, longer than the current one', () => {
    const now = Date.now();
    // A 5-day run two weeks ago, then a lone training day today (streak of 1 now).
    const days = new Set([
      toDateKey(now),
      toDateKey(now - 14 * DAY),
      toDateKey(now - 15 * DAY),
      toDateKey(now - 16 * DAY),
      toDateKey(now - 17 * DAY),
      toDateKey(now - 18 * DAY),
    ]);
    assert.equal(computeBestStreak(days), 5);
    // Confirms this genuinely differs from computeStreak, not just a relabel.
    assert.equal(computeStreak(days, now), 1);
  });

  it('bridges single rest days within a run, same grace rule as computeStreak', () => {
    const now = Date.now();
    // Trained day 0, 2, 4 — one rest day between each — should read as one run of 3.
    const days = new Set([toDateKey(now), toDateKey(now - 2 * DAY), toDateKey(now - 4 * DAY)]);
    assert.equal(computeBestStreak(days), 3);
  });

  it('does not merge two runs separated by a gap beyond the grace window', () => {
    const now = Date.now();
    const days = new Set([
      toDateKey(now), toDateKey(now - DAY),           // a 2-day run
      toDateKey(now - 10 * DAY), toDateKey(now - 11 * DAY), toDateKey(now - 12 * DAY), // a 3-day run, far away
    ]);
    assert.equal(computeBestStreak(days), 3);
  });

  it('has no clock dependency — order of insertion or which day is "today" does not matter', () => {
    const days = new Set(['2026-01-01', '2026-01-02', '2026-01-03']);
    assert.equal(computeBestStreak(days), 3);
  });

  it('returns 0 for an empty history', () => {
    assert.equal(computeBestStreak(new Set()), 0);
  });

  it('returns 1 for a single isolated training day', () => {
    assert.equal(computeBestStreak(new Set(['2026-06-15'])), 1);
  });
});
