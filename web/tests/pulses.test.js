import assert from 'node:assert/strict';
import test from 'node:test';

import { gateQuality, simulatePulse } from '../lib/pulses.js';

test('pulses: a two-level system obeys the area theorem for any pulse length, and the time step is converged', () => {
  for (const T of [3, 10, 40]) {
    const r = simulatePulse({ T, lambda: 0, steps: 600 });
    assert.ok(Math.abs(r.U.re[3] ** 2 + r.U.im[3] ** 2 - 1) < 1e-10, `T=${T}`);
  }
  const a = gateQuality(simulatePulse({ T: 8, beta: 0.5, steps: 1000 }).U).error;
  const b = gateQuality(simulatePulse({ T: 8, beta: 0.5, steps: 4000 }).U).error;
  assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, a / 1e-3));
});

test('DRAG on a transmon: β ≈ 1 suppresses leakage, β ≈ 0.5 minimises the gate error, and slower pulses leak less', () => {
  const T = 8;
  const q = (beta) => gateQuality(simulatePulse({ T, beta, steps: 600 }).U);
  const [none, half, one] = [q(0), q(0.5), q(1)];
  assert.ok(one.leakage < none.leakage / 100, `leakage ${none.leakage} → ${one.leakage}`);
  assert.ok(half.error < none.error / 10, `error ${none.error} → ${half.error}`);
  assert.ok(half.error < one.error);
  const leak = [4, 8, 20].map((t) => gateQuality(simulatePulse({ T: t, beta: 0, steps: 600 }).U).leakage);
  assert.ok(leak[0] > leak[1] && leak[1] > leak[2]);
});
