import assert from 'node:assert/strict';
import test from 'node:test';

import { cliffords, fitDecay, mul, NOISE, runRB, twirledF } from '../lib/rb.js';

const LENGTHS = [1, 10, 25, 50, 100, 150, 200, 300, 400, 500];

test('the single-qubit Clifford group has 24 elements and is closed under multiplication', () => {
  const { list, index } = cliffords();
  assert.equal(list.length, 24);
  for (const a of list) for (const b of list) assert.ok(index(mul(a.U, b.U)) >= 0);
});

test('twirled noise parameters match their closed forms', () => {
  assert.ok(Math.abs(twirledF(NOISE.depolarizing(0.02)) - 0.98) < 1e-12);
  const g = 0.03;
  assert.ok(Math.abs(twirledF(NOISE.damping(g)) - (2 * Math.sqrt(1 - g) + 1 - g) / 3) < 1e-12);
  const e = 0.2;
  assert.ok(Math.abs(twirledF(NOISE.overrotation(e)) - (1 + 2 * Math.cos(e)) / 3) < 1e-12);
});

test('randomized benchmarking recovers the twirled decay rate, independent of SPAM errors, even for coherent errors', () => {
  for (const [noise, samples] of [
    [NOISE.depolarizing(0.01), 100],
    [NOISE.damping(0.01), 100],
    [NOISE.overrotation(0.1), 600],
  ]) {
    const fit = fitDecay(runRB({ noise, lengths: LENGTHS, samples, seed: 4 }));
    assert.ok(Math.abs(fit.f - twirledF(noise)) < 1e-3, `${fit.f} vs ${twirledF(noise)}`);
  }
  const noisy = fitDecay(runRB({ noise: NOISE.depolarizing(0.01), lengths: LENGTHS, samples: 100, prepError: 0.03, readError: 0.04, seed: 4 }));
  assert.ok(Math.abs(noisy.f - 0.99) < 1e-3, 'SPAM errors leave f unchanged');
  assert.ok(noisy.A < 0.47, 'but shrink the amplitude A');
});
