import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SEED_EXERCISES } from './exercises.ts';
import { PER_SIDE_SEED_NAMES } from './weightModes.ts';

describe('PER_SIDE_SEED_NAMES', () => {
  // A typo here fails silently in the app — migration v3's `WHERE name IN`
  // and the seeder's `.has(name)` would both just match nothing, leaving
  // that exercise on 'total' with no error anywhere. This is the only
  // place that mistake can be caught.
  it('names only exercises that exist in the seed library', () => {
    const seedNames = new Set(SEED_EXERCISES.map(([name]) => name));
    const unknown = [...PER_SIDE_SEED_NAMES].filter((name) => !seedNames.has(name));
    assert.deepEqual(unknown, []);
  });

  it('keeps single-implement exercises on total', () => {
    for (const name of ['Goblet Squat', 'Overhead Dumbbell Extension', 'Rope Hammer Curl', 'Back Squat', 'Leg Press']) {
      assert.equal(PER_SIDE_SEED_NAMES.has(name), false, name);
    }
  });

  it('puts the user-named example on per-side', () => {
    assert.equal(PER_SIDE_SEED_NAMES.has('Hammer Curl'), true);
  });
});
