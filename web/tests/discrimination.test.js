import assert from 'node:assert/strict';
import test from 'node:test';

import { helstrom, ket, neumarkUnitary, overlap, unambiguous } from '../lib/discrimination.js';
import { symmetricEigen } from '../lib/linalg.js';

const close = (a, b, what, tol = 1e-12) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);
const pairs = [
  [0, 0.4],
  [-0.6, 0.6],
  [0.3, 2.2],
  [-1.5, 1.5],
  [1, 1 + Math.PI],
];

test('the Helstrom measurement reaches ½(1 + √(1 − 4 q0 q1 s²)) for any priors', () => {
  for (const [t0, t1] of pairs) {
    for (const q0 of [0.5, 0.2, 0.85]) {
      const h = helstrom(t0, t1, q0);
      close(h.success, h.formula, `t=(${t0},${t1}) q0=${q0}`);
      // the two projectors form a complete measurement
      [0, 1, 2, 3].forEach((i) => close(h.projectors[0][i] + h.projectors[1][i], [1, 0, 0, 1][i], 'P0 + P1 = I'));
    }
  }
});

test('the unambiguous POVM is never wrong, is conclusive with probability 1 − s, and is a valid POVM', () => {
  for (const [t0, t1] of pairs) {
    const u = unambiguous(t0, t1);
    const s = overlap(t0, t1);
    close(u.table[0][1], 0, 'psi0 never called psi1');
    close(u.table[1][0], 0, 'psi1 never called psi0');
    close(u.table[0][0], 1 - s, 'conclusive for psi0');
    close(u.table[1][1], 1 - s, 'conclusive for psi1');
    for (const E of u.elements) {
      const { values } = symmetricEigen(Float64Array.from(E), 2);
      assert.ok(values[0] > -1e-12, 'positive semidefinite');
    }
  }
});

test('Neumark: one projective measurement on qubit + ancilla realises the three-outcome POVM', () => {
  for (const [t0, t1] of pairs) {
    const { U } = neumarkUnitary(t0, t1);
    // orthogonal
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let d = 0;
        for (let k = 0; k < 4; k++) d += U[k * 4 + i] * U[k * 4 + j];
        close(d, i === j ? 1 : 0, `U^T U (${i},${j})`, 1e-10);
      }
    }
    const s = overlap(t0, t1);
    [t0, t1].forEach((t, k) => {
      const [a, b] = ket(t);
      const input = [a, b, 0, 0]; // index = system + 2 * ancilla
      const out = [0, 1, 2, 3].map((r) => U[r * 4] * input[0] + U[r * 4 + 1] * input[1]);
      const p = out.map((x) => x * x);
      close(p[k], 1 - s, `state ${k}: conclusive and right`, 1e-10);
      close(p[1 - k], 0, `state ${k}: never wrong`, 1e-10);
      close(p[2] + p[3], s, `state ${k}: inconclusive`, 1e-10);
    });
  }
});
