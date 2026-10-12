import assert from 'node:assert/strict';
import test from 'node:test';

import { anneal, isingInstance, spectrum } from '../lib/aqc.js';

test('adiabatic interpolation: the spectrum starts at −ΣX and ends on the sorted cost values', () => {
  const inst = isingInstance(6, 192);
  const sp = spectrum(inst, { points: 3, count: 8 });
  const start = [-6, -4, -4, -4, -4, -4, -4, -2];
  sp.rows[0].values.forEach((v, i) => assert.ok(Math.abs(v - start[i]) < 1e-9));
  const end = [...inst.diag].sort((a, b) => a - b).slice(0, 8);
  sp.rows[2].values.forEach((v, i) => assert.ok(Math.abs(v - end[i]) < 1e-9));
});

test('annealing: the sudden limit gives 1/2ⁿ, slow runs find the answer, and a small gap demands a long run', () => {
  const easy = isingInstance(6, 192);
  const hard = isingInstance(6, 59);
  assert.ok(Math.abs(anneal(easy, 1e-6, { steps: 1 }).success - 1 / 64) < 1e-9);
  assert.ok(anneal(easy, 64).success > 0.99);
  const gap = spectrum(hard).minGap;
  assert.ok(gap < 0.06, `hard gap ${gap}`);
  assert.ok(anneal(hard, 512, { steps: 1000 }).success < 0.7, 'T ≈ 1/Δ² is not enough');
  assert.ok(anneal(hard, 2048, { steps: 2000 }).success > 0.95, 'T ≫ 1/Δ² is');
});
