import assert from 'node:assert/strict';
import test from 'node:test';

import { seededRandom } from '../lib/circuit.js';
import { hermitianEigen, svd } from '../lib/linalg.js';

function randomHermitian(n, rng) {
  const re = new Float64Array(n * n);
  const im = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    re[i * n + i] = rng() * 4 - 2;
    for (let j = i + 1; j < n; j++) {
      const a = rng() * 2 - 1;
      const b = rng() * 2 - 1;
      re[i * n + j] = a;
      im[i * n + j] = b;
      re[j * n + i] = a;
      im[j * n + i] = -b;
    }
  }
  return { re, im };
}

test('the Hermitian eigensolver gives A v = λ v with orthonormal v', () => {
  const rng = seededRandom(7);
  for (const n of [1, 2, 4, 7, 12]) {
    const { re, im } = randomHermitian(n, rng);
    const { values, vectors } = hermitianEigen(re, im, n);
    for (let k = 1; k < n; k++) assert.ok(values[k] >= values[k - 1] - 1e-12, 'ascending');
    let worst = 0;
    vectors.forEach((v, k) => {
      for (let i = 0; i < n; i++) {
        let r = 0;
        let s = 0;
        for (let j = 0; j < n; j++) {
          r += re[i * n + j] * v.re[j] - im[i * n + j] * v.im[j];
          s += re[i * n + j] * v.im[j] + im[i * n + j] * v.re[j];
        }
        worst = Math.max(worst, Math.abs(r - values[k] * v.re[i]), Math.abs(s - values[k] * v.im[i]));
      }
      vectors.forEach((w, l) => {
        let dr = 0;
        let di = 0;
        for (let i = 0; i < n; i++) {
          dr += v.re[i] * w.re[i] + v.im[i] * w.im[i];
          di += v.re[i] * w.im[i] - v.im[i] * w.re[i];
        }
        worst = Math.max(worst, Math.abs(dr - (k === l ? 1 : 0)), Math.abs(di));
      });
    });
    assert.ok(worst < 1e-10, `n = ${n}: error ${worst}`);
  }
});

test('degenerate eigenvalues are found exactly (the 2-qubit identity plus a projector)', () => {
  const n = 4;
  const re = new Float64Array(16);
  for (let i = 0; i < 4; i++) re[i * 5] = 1;
  // + |Phi+><Phi+| with |Phi+> = (|00> + |11>)/sqrt2
  re[0] += 0.5;
  re[3] += 0.5;
  re[12] += 0.5;
  re[15] += 0.5;
  const { values } = hermitianEigen(re, new Float64Array(16), n);
  assert.deepEqual(values.map((v) => Math.round(v * 1e12) / 1e12), [1, 1, 1, 2]);
});

test('the SVD reconstructs any real matrix with orthonormal factors', () => {
  const rng = seededRandom(3);
  for (const [m, n] of [
    [5, 3],
    [3, 5],
    [6, 6],
    [8, 2],
  ]) {
    const a = Float64Array.from({ length: m * n }, () => rng() * 2 - 1);
    const { U, S, V, rank } = svd(a, m, n);
    let worst = 0;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let s = 0;
        for (let k = 0; k < rank; k++) s += U[i * rank + k] * S[k] * V[j * rank + k];
        worst = Math.max(worst, Math.abs(s - a[i * n + j]));
      }
    }
    for (let k = 1; k < rank; k++) assert.ok(S[k] <= S[k - 1] + 1e-12);
    assert.ok(worst < 1e-10, `${m}x${n}: ${worst}`);
  }
});
