import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clamp,
  formatWeight,
  fromDisplay,
  kgToLb,
  lbToKg,
  round2,
  snapToStep,
  stepFrom,
  toDisplay,
} from './units.ts';

describe('stepFrom', () => {
  it('adds one step when the value is already on the grid', () => {
    assert.equal(stepFrom(60, 0.5, 1), 60.5);
    assert.equal(stepFrom(60, 0.5, -1), 59.5);
    assert.equal(stepFrom(60, 2.5, 1), 62.5);
  });

  it('snaps onto the grid in the pressed direction from an off-grid value', () => {
    // Typed 62.3 with a 0.5 step: up should land on 62.5, not 62.8.
    assert.equal(stepFrom(62.3, 0.5, 1), 62.5);
    assert.equal(stepFrom(62.3, 0.5, -1), 62);
  });

  it('survives repeated addition without floating-point drift', () => {
    // Plain `value += 0.5` sixty times ends at 62.50000000000001, which would
    // render as a nonsense number and never compare equal to a stored 62.5.
    let value = 40;
    for (let i = 0; i < 45; i += 1) value = stepFrom(value, 0.5, 1);
    assert.equal(value, 62.5);
  });

  it('handles a zero or negative step without looping or crashing', () => {
    assert.equal(stepFrom(60, 0, 1), 60);
  });
});

describe('snapToStep', () => {
  it('rounds onto the nearest grid point', () => {
    assert.equal(snapToStep(62.3, 0.5), 62.5);
    assert.equal(snapToStep(62.2, 0.5), 62);
    assert.equal(snapToStep(61, 2.5), 60);
  });
});

describe('clamp', () => {
  it('holds the value inside its bounds', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-3, 0, 10), 0);
    assert.equal(clamp(99, 0, 10), 10);
  });
});

describe('unit conversion', () => {
  it('round-trips kg -> lb -> kg within display precision', () => {
    assert.equal(round2(lbToKg(kgToLb(60))), 60);
    assert.equal(round2(lbToKg(kgToLb(62.5))), 62.5);
  });

  it('leaves values untouched in kg mode', () => {
    assert.equal(toDisplay(62.5, 'kg'), 62.5);
    assert.equal(fromDisplay(62.5, 'kg'), 62.5);
  });

  it('converts for display in lb mode', () => {
    assert.equal(toDisplay(100, 'lb'), 220.46);
    // Typing 220.46 lb should come back as ~100 kg.
    assert.equal(Math.round(fromDisplay(220.46, 'lb')), 100);
  });
});

describe('formatWeight', () => {
  it('drops the decimal on whole numbers', () => {
    assert.equal(formatWeight(60), '60');
    assert.equal(formatWeight(60.0), '60');
  });

  it('keeps only the decimals the value needs', () => {
    assert.equal(formatWeight(62.5), '62.5');
    assert.equal(formatWeight(62.25), '62.25');
  });

  it('cleans up float drift rather than printing it', () => {
    assert.equal(formatWeight(62.50000000000001), '62.5');
  });
});
