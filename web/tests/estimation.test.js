import assert from 'node:assert/strict';
import test from 'node:test';

import { registerProbs } from '../lib/algorithms.js';
import { probabilities, runOps } from '../lib/circuit.js';
import { bhmtBound, classicalQuantileError, qaeCircuit, qaeDistribution, qaeQuantileError, qaeRmse } from '../lib/estimation.js';

test('amplitude estimation: the circuit’s outcome distribution equals the Brassard–Høyer–Mosca–Tapp formula', () => {
  for (const m of [3, 5, 6]) {
    for (const a of [0.05, 0.3, 0.5, 0.82]) {
      const { ops, count } = qaeCircuit(m, a);
      const { state } = runOps(m + 1, ops);
      const got = registerProbs(probabilities(state), count);
      const want = qaeDistribution(m, a);
      want.forEach((p, y) => assert.ok(Math.abs(got[y] - p) < 1e-12, `m=${m} a=${a} y=${y}: ${got[y]} vs ${p}`));
      assert.ok(Math.abs(want.reduce((s, p) => s + p, 0) - 1) < 1e-12);
    }
  }
});

test('with probability ≥ 8/π² the estimate is within the Brassard et al. bound; that error falls as 1/calls, sampling as 1/√calls', () => {
  for (const a of [0.1, 0.3, 0.7]) {
    for (let m = 2; m <= 10; m++) assert.ok(qaeQuantileError(m, a) <= bhmtBound(m, a) + 1e-12, `a=${a} m=${m}`);
    assert.ok(Math.abs(classicalQuantileError(63, a) / classicalQuantileError(511, a) - Math.sqrt(511 / 63)) < 1e-9);
  }
  // for a single a the error jumps with how well Mθ/π lands on the grid; averaged over a, 8× more
  // calls shrink it about 8×
  let [s6, s9] = [0, 0];
  for (let i = 1; i < 200; i++) {
    s6 += qaeQuantileError(6, i / 200);
    s9 += qaeQuantileError(9, i / 200);
  }
  assert.ok(s6 / s9 > 5.5 && s6 / s9 < 10, `averaged ratio ${s6 / s9}`);
  // the root-mean-square error does not fall as fast: the distribution has 1/δ² tails
  assert.ok(qaeRmse(6, 0.3) / qaeRmse(9, 0.3) < 3);
});
