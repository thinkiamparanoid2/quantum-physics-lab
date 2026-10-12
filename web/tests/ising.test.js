import assert from 'node:assert/strict';
import test from 'node:test';

import { applyOperator, makeOperator } from '../lib/dynamics.js';
import { freeFermion, groundState, isingTerms, kinkDensity, kinkDensityFree } from '../lib/ising.js';
import { hermitianEigen, svd } from '../lib/linalg.js';

test('transverse-field Ising: the free-fermion ground energy and gap equal dense diagonalisation and Lanczos', () => {
  const N = 6;
  const dim = 1 << N;
  for (const h of [0.3, 1, 1.7]) {
    const op = makeOperator(isingTerms(N, 1, h), N);
    const D = new Float64Array(dim * dim);
    const [z, a, b] = [new Float64Array(dim), new Float64Array(dim), new Float64Array(dim)];
    for (let k = 0; k < dim; k++) {
      const r = new Float64Array(dim);
      r[k] = 1;
      applyOperator(op, r, z, a, b);
      for (let i = 0; i < dim; i++) D[i * dim + k] = a[i];
    }
    const ev = hermitianEigen(D, null, dim).values;
    const ff = freeFermion(N, 1, h);
    assert.ok(Math.abs(ff.energy - ev[0]) < 1e-9);
    assert.ok(Math.abs(ff.gap - (ev[1] - ev[0])) < 1e-9);
    assert.ok(Math.abs(groundState(N, 1, h).energy - ev[0]) < 1e-9);
    // a longer chain: Lanczos against free fermions only
    assert.ok(Math.abs(groundState(10, 1, h).energy - freeFermion(10, 1, h).energy) < 1e-9);
  }
});

test('Kibble–Zurek: the free-fermion ramp equals the statevector simulation, and long chains follow n ≈ 1/(2π√(2τ_Q)) for slow ramps', () => {
  for (const tau of [0.5, 2, 6]) {
    const sv = kinkDensity(8, 1, 3, tau, { periodic: true, steps: 120 });
    const ff = kinkDensityFree(8, 1, 3, tau, { steps: 120 });
    assert.ok(Math.abs(sv - ff) < 1e-8, `τ=${tau}: ${sv} vs ${ff}`);
  }
  for (const tau of [8, 16]) {
    const n = kinkDensityFree(400, 1, 3, tau, { steps: 40 * tau });
    const law = 1 / (2 * Math.PI * Math.sqrt((2 * tau) / 3));
    assert.ok(Math.abs(n / law - 1) < 0.1, `τ=${tau}: ${n} vs ${law}`);
  }
});

test('half-chain entanglement grows with size at h = J but saturates in the paramagnet', () => {
  const S = (N, h) => {
    const psi = groundState(N, 1, h).vector;
    const a = N >> 1;
    const rows = 1 << a;
    const cols = 1 << (N - a);
    const M = new Float64Array(rows * cols);
    for (let b = 0; b < psi.length; b++) M[(b & (rows - 1)) * cols + (b >> a)] = psi[b];
    return svd(M, rows, cols).S.reduce((s, v) => (v * v > 1e-14 ? s - v * v * Math.log2(v * v) : s), 0);
  };
  const crit = [6, 8, 10].map((N) => S(N, 1));
  const para = [6, 8, 10].map((N) => S(N, 2.5));
  assert.ok(crit[1] > crit[0] + 0.02 && crit[2] > crit[1] + 0.02, `critical: ${crit}`);
  assert.ok(Math.abs(para[2] - para[1]) < 0.01, `paramagnet: ${para}`);
  assert.ok(Math.abs(S(8, 0.05) - 1) < 0.01, 'deep in the ordered phase the cat state carries one bit');
});
