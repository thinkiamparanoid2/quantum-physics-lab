import assert from 'node:assert/strict';
import test from 'node:test';

import { asymptotic, chargeBasisLevels, dispersion, phaseBasis } from '../lib/transmon.js';

test('transmon: the charge basis and a twisted grid in φ give the same levels', () => {
  for (const [ratio, ng] of [
    [1, 0.3],
    [10, 0.25],
    [50, 0.5],
  ]) {
    const a = chargeBasisLevels(ratio, ng, { count: 4 });
    const b = phaseBasis(ratio, ng, { M: 160, count: 4 }).levels;
    a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 5e-4 * Math.max(1, Math.abs(v)), `ratio ${ratio} n_g ${ng} level ${i}: ${v} vs ${b[i]}`));
    const c = chargeBasisLevels(ratio, ng, { N: 40, count: 4 });
    a.forEach((v, i) => assert.ok(Math.abs(v - c[i]) < 1e-10));
  }
  // without the junction the levels are the charging parabolas 4(n − n_g)²
  const free = chargeBasisLevels(0, 0.3, { count: 3 });
  [0.36, 1.96, 6.76].forEach((v, i) => assert.ok(Math.abs(free[i] - v) < 1e-12, `${free[i]} vs ${v}`));
});

test('transmon: Koch et al.’s asymptotic frequency, anharmonicity and charge dispersion are approached at large E_J/E_C', () => {
  const r = 100;
  const L = chargeBasisLevels(r, 0.25, { count: 3 });
  assert.ok(Math.abs((L[1] - L[0]) / asymptotic.f01(r) - 1) < 0.005);
  assert.ok(Math.abs(L[2] - 2 * L[1] + L[0] + 1) < 0.15);
  assert.ok(Math.abs(dispersion(r, 0) / asymptotic.dispersion(r, 0) - 1) < 0.05);
  assert.ok(Math.abs(dispersion(r, 1) / asymptotic.dispersion(r, 1) - 1) < 0.15);
  // the exponential suppression: ten times smaller dispersion well before E_J/E_C = 50
  assert.ok(dispersion(50, 0) < 1e-3 * dispersion(10, 0));
});
