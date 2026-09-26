import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ModeSubject } from './weightMode.ts';
import {
  sideNoun,
  toggledMode,
  volumeFactor,
  weightCaption,
  weightModeChipLabel,
  weightModeMenuLabel,
  weightSuffix,
} from './weightMode.ts';

const hammerCurl: ModeSubject = { weight_mode: 'per_side', muscle_group: 'biceps' };
const lunge: ModeSubject = { weight_mode: 'per_side', muscle_group: 'quads' };
const woodChop: ModeSubject = { weight_mode: 'per_side', muscle_group: 'core' };
const squat: ModeSubject = { weight_mode: 'total', muscle_group: 'quads' };

describe('volumeFactor', () => {
  it('counts a per-side set twice, since both limbs did the work', () => {
    assert.equal(volumeFactor('per_side'), 2);
    // The user's own example: 7.5 kg × 10 of Hammer Curl is 150 kg of volume.
    assert.equal(7.5 * 10 * volumeFactor('per_side'), 150);
  });

  it('leaves a total-load set as it is', () => {
    assert.equal(volumeFactor('total'), 1);
  });
});

describe('sideNoun', () => {
  it('calls upper-body sides arms', () => {
    for (const g of ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'traps'] as const) {
      assert.equal(sideNoun(g), 'arm', g);
    }
  });

  it('calls lower-body sides legs', () => {
    for (const g of ['quads', 'hamstrings', 'glutes', 'calves'] as const) {
      assert.equal(sideNoun(g), 'leg', g);
    }
  });

  it('falls back to "side" where there is no single limb', () => {
    for (const g of ['core', 'full_body', 'cardio'] as const) {
      assert.equal(sideNoun(g), 'side', g);
    }
  });
});

describe('labels', () => {
  it('suffixes a per-side weight and leaves a total one bare', () => {
    assert.equal(weightSuffix(hammerCurl, 'kg'), 'kg/arm');
    assert.equal(weightSuffix(lunge, 'lb'), 'lb/leg');
    assert.equal(weightSuffix(woodChop, 'kg'), 'kg/side');
    assert.equal(weightSuffix(squat, 'kg'), 'kg');
  });

  it('spells the stepper caption out in full', () => {
    assert.equal(weightCaption(hammerCurl, 'kg'), 'kg · each arm');
    assert.equal(weightCaption(squat, 'kg'), 'kg');
  });

  it('labels the chip with the current state', () => {
    assert.equal(weightModeChipLabel(hammerCurl), 'EACH ARM');
    assert.equal(weightModeChipLabel(lunge), 'EACH LEG');
    assert.equal(weightModeChipLabel(squat), 'TOTAL');
  });

  it('labels the menu item with the action, i.e. the OTHER state', () => {
    assert.equal(weightModeMenuLabel(hammerCurl), 'Switch to total weight');
    assert.equal(weightModeMenuLabel(squat), 'Switch to each-leg weight');
  });
});

describe('toggledMode', () => {
  it('flips both ways', () => {
    assert.equal(toggledMode('total'), 'per_side');
    assert.equal(toggledMode('per_side'), 'total');
  });
});
