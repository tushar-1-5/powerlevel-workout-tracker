import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SEED_EXERCISES } from './exercises.ts';
import { SEED_SPLITS } from './splits.ts';

describe('SEED_SPLITS', () => {
  it('references only exercise names that exist in SEED_EXERCISES', () => {
    const names = new Set(SEED_EXERCISES.map(([name]) => name));

    for (const split of SEED_SPLITS) {
      for (const day of split.days) {
        for (const exerciseName of day.exercises) {
          assert.ok(
            names.has(exerciseName),
            `${split.name} / ${day.name}: unknown exercise "${exerciseName}"`,
          );
        }
      }
    }
  });

  it('has exactly one default split, and it is first in the array', () => {
    const defaults = SEED_SPLITS.filter((s) => s.isDefault);
    assert.equal(defaults.length, 1);
    assert.equal(SEED_SPLITS[0].isDefault, true);
  });

  it('gives every day at least one exercise', () => {
    for (const split of SEED_SPLITS) {
      for (const day of split.days) {
        assert.ok(day.exercises.length > 0, `${split.name} / ${day.name} has no exercises`);
      }
    }
  });
});
