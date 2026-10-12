import assert from 'node:assert/strict';
import test from 'node:test';

import { circuitCost } from '../lib/dynamics.js';
import { schwingerTerms, trotterStudy } from '../lib/schwinger.js';

test('Schwinger gate count per first-order Trotter step equals the hand count 4(N − 1) + (N − 1)(N − 2)', () => {
  for (const N of [2, 3, 4, 7, 12, 20]) assert.equal(circuitCost(schwingerTerms(N).terms, 1).cnots, 4 * (N - 1) + (N - 1) * (N - 2));
});

test('Trotter infidelity falls as steps⁻² at first order and steps⁻⁴ at second order', () => {
  const st = trotterStudy({ N: 6, T: 3, stepsList: [40, 80] });
  const r1 = st[1][0].infidelity / st[1][1].infidelity;
  const r2 = st[2][0].infidelity / st[2][1].infidelity;
  assert.ok(Math.abs(r1 - 4) < 0.4, `first order ratio ${r1}`);
  assert.ok(Math.abs(r2 - 16) < 1.6, `second order ratio ${r2}`);
});
