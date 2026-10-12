import assert from 'node:assert/strict';
import test from 'node:test';

import { seededRandom } from '../lib/circuit.js';
import { matrixOf, runHHL } from '../lib/hhl.js';

test('HHL: with eigenvalues the clock can hold exactly, the postselected state is A⁻¹b/‖A⁻¹b‖ and succeeds with probability C²‖A⁻¹b‖²', () => {
  const rng = seededRandom(8);
  for (const [l1, l2, c] of [
    [1, 2, 2],
    [1, 3, 3],
    [2, 5, 3],
    [1, 7, 3],
    [3, 11, 4],
  ]) {
    for (let k = 0; k < 4; k++) {
      const phi = Math.PI * rng();
      const beta = Math.PI * rng();
      const r = runHHL({ l1, l2, phi, beta, c });
      assert.ok(Math.abs(r.fidelity - 1) < 1e-10, `λ=${l1},${l2} c=${c}: fidelity ${r.fidelity}`);
      const C = Math.min(l1, l2, 1);
      assert.ok(Math.abs(r.success - C * C * r.exactNorm ** 2) < 1e-10, `success ${r.success} vs ${C * C * r.exactNorm ** 2}`);
    }
  }
  // the matrix really has the requested eigenvalues
  const A = matrixOf(2, 5, 0.7);
  const tr = A[0][0] + A[1][1];
  const det = A[0][0] * A[1][1] - A[0][1] ** 2;
  assert.ok(Math.abs(tr - 7) < 1e-12 && Math.abs(det - 10) < 1e-12);
});

test('HHL: eigenvalues between clock values give an imperfect answer, and ill-conditioned systems succeed rarely', () => {
  const r = runHHL({ l1: 1, l2: 2.5, phi: 0.4, beta: 1.1, c: 3 });
  assert.ok(r.fidelity < 1 - 1e-6, `fidelity ${r.fidelity}`);
  const good = runHHL({ l1: 1, l2: 2, phi: 0.4, beta: 1.1, c: 4 });
  const bad = runHHL({ l1: 1, l2: 15, phi: 0.4, beta: 1.1, c: 4 });
  assert.ok(bad.success < good.success, 'larger condition number, lower success');
});
