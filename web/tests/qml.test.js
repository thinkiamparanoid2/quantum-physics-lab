import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { seededRandom } from '../lib/circuit.js';
import { applyOperator } from '../lib/dynamics.js';
import { hermitianEigen } from '../lib/linalg.js';
import {
  angleKernelExact,
  angleOps,
  classify,
  cutValue,
  energy,
  fourierCoefficients,
  fourierModel,
  h2State,
  kernel,
  parameterShift,
  pauliOperator,
  qaoaState,
  zzMapOps,
} from '../lib/vqc.js';

const ref = JSON.parse(readFileSync(new URL('./reference-qml.json', import.meta.url)));

test('the re-uploading classifier and its parameter-shift gradient equal PennyLane’s', () => {
  for (const c of ref.classifier) {
    const params = c.params.flat();
    const f = (p) => classify(c.layers, p, c.x);
    assert.ok(Math.abs(f(params) - c.value) < 1e-12);
    const g = parameterShift(f, params);
    c.grad.flat().forEach((v, k) => assert.ok(Math.abs(g[k] - v) < 1e-12, `layers ${c.layers}, param ${k}: ${g[k]} vs ${v}`));
    // and a finite difference agrees too
    const h = 1e-6;
    const p = params.slice();
    p[0] += h;
    assert.ok(Math.abs((f(p) - f(params)) / h - g[0]) < 1e-5);
  }
});

test('a 1-qubit model with L re-uploadings is a Fourier series of degree L, with PennyLane’s coefficients', () => {
  for (const c of ref.fourier) {
    const params = c.params.flat();
    const K = c.layers + 2;
    const co = fourierCoefficients((x) => fourierModel(c.layers, params, x), K);
    co.forEach((v, j) => {
      assert.ok(Math.abs(v.re - c.re[j]) < 1e-12 && Math.abs(v.im - c.im[j]) < 1e-12, `L=${c.layers} k=${v.k}`);
      if (Math.abs(v.k) > c.layers) assert.ok(Math.hypot(v.re, v.im) < 1e-12, 'no frequency above L');
    });
  }
});

test('kernels: the ZZ feature map matches PennyLane; angle encoding gives the product of cos²', () => {
  const { points, K } = ref.kernel;
  const map = zzMapOps();
  const adj = zzMapOps(true);
  points.forEach((a, i) => points.forEach((b, j) => assert.ok(Math.abs(kernel(2, map, adj, b, a) - K[i][j]) < 1e-12, `K[${i}][${j}]`)));
  const rng = seededRandom(9);
  const inv = (n) => angleOps(n).map((op) => ({ ...op, scale: -1 })).reverse();
  for (let k = 0; k < 5; k++) {
    const a = [rng() * 6, rng() * 6, rng() * 6];
    const b = [rng() * 6, rng() * 6, rng() * 6];
    assert.ok(Math.abs(kernel(3, angleOps(3), inv(3), a, b) - angleKernelExact(a, b)) < 1e-12);
  }
});

test('H₂ (STO-3G, PennyLane Hamiltonians): Hartree–Fock and the one-parameter VQE ansatz reach the HF and FCI energies', () => {
  for (const h of ref.h2) {
    const op = pauliOperator(h.terms, 4);
    assert.ok(Math.abs(energy(op, h2State(0)) - h.hf) < 1e-9, `HF at ${h.bond}`);
    // golden-section search over θ
    let lo;
    let hi;
    const E = (t) => energy(op, h2State(t));
    // bracket the minimum on a grid first
    let best = 0;
    for (let i = 0; i <= 200; i++) {
      const t = -Math.PI + (2 * Math.PI * i) / 200;
      if (E(t) < E(best)) best = t;
    }
    [lo, hi] = [best - 0.05, best + 0.05];
    for (let i = 0; i < 80; i++) {
      const m1 = lo + (hi - lo) * 0.382;
      const m2 = lo + (hi - lo) * 0.618;
      if (E(m1) < E(m2)) hi = m2;
      else lo = m1;
    }
    assert.ok(Math.abs(E((lo + hi) / 2) - h.fci) < 1e-8, `VQE at ${h.bond}: ${E((lo + hi) / 2)} vs ${h.fci}`);
    // and FCI is the lowest eigenvalue of the 16 × 16 matrix
    const M = new Float64Array(256);
    const Mi = new Float64Array(256);
    const [or, oi] = [new Float64Array(16), new Float64Array(16)];
    for (let b = 0; b < 16; b++) {
      const re = new Float64Array(16);
      re[b] = 1;
      applyOperator(op, re, new Float64Array(16), or, oi);
      for (let c = 0; c < 16; c++) [M[c * 16 + b], Mi[c * 16 + b]] = [or[c], oi[c]];
    }
    assert.ok(Math.abs(hermitianEigen(M, Mi, 16).values[0] - h.fci) < 1e-9);
  }
});

test('QAOA p = 1 MaxCut expectations equal PennyLane’s', () => {
  const { edges, grid } = ref.qaoa;
  for (const g of grid) assert.ok(Math.abs(cutValue(qaoaState(5, edges, [g.gamma], [g.beta]), edges) - g.cut) < 1e-12);
});


test('amplitude encoding: the controlled-RY tree prepares exactly the normalised vector', async () => {
  const { runOps } = await import('../lib/circuit.js');
  const { amplitudeEncodingOps } = await import('../lib/vqc.js');
  const rng = seededRandom(4);
  for (let k = 0; k < 20; k++) {
    const v = [rng(), rng(), rng(), rng()];
    const n = Math.hypot(...v);
    const { state } = runOps(2, amplitudeEncodingOps(v));
    v.forEach((x, b) => assert.ok(Math.abs(state.re[b] - x / n) < 1e-12 && Math.abs(state.im[b]) < 1e-12));
  }
});

test('on its training points a degree-L quantum model never beats the least-squares Fourier series of degree L', async () => {
  const { fitFourier } = await import('../lib/vqc.js');
  for (const [target, layers] of [
    ['square', 1],
    ['two-tone', 2],
    ['sawtooth', 2],
  ]) {
    const r = fitFourier({ target, layers, epochs: 60 });
    for (const h of r.history) assert.ok(h.loss >= r.classicalLoss - 1e-12, `${target} L=${layers}`);
  }
});

test('kernel ridge regression solves (K + λI)α = y, and a 2-qubit kernel matrix has rank at most 16', async () => {
  const { dataset, KERNELS, kernelRidge } = await import('../lib/vqc.js');
  const { symmetricEigen } = await import('../lib/linalg.js');
  const train = dataset('circle', 40, 1);
  const lambda = 0.05;
  const r = kernelRidge(train, (a, b) => KERNELS.zz(a, b, 0.5), lambda);
  r.K.forEach((row, i) => row.forEach((v, j) => assert.ok(Math.abs(v - r.K[j][i]) < 1e-12 && (i !== j || Math.abs(v - 1) < 1e-12))));
  train.forEach((p, i) => assert.ok(Math.abs(r.K[i].reduce((s, v, j) => s + v * r.alpha[j], 0) + lambda * r.alpha[i] - p.y) < 1e-9));
  // k = Tr(ρσ) for pure 2-qubit states: a Gram matrix of 4 × 4 Hermitian matrices, so rank ≤ 16
  const values = symmetricEigen(Float64Array.from(r.K.flat()), 40).values;
  assert.ok(values.filter((v) => v > 1e-9).length <= 16);
});

test('barren plateaus: with a shallow circuit the global cost’s gradients vanish exponentially, the local cost’s do not', async () => {
  const { gradientVariance } = await import('../lib/vqc.js');
  const shallow = gradientVariance({ ns: [2, 6, 10], depth: 2, samples: 200 });
  assert.ok(shallow[0].global / shallow[2].global > 100, 'global: more than 100× smaller from 2 to 10 qubits');
  assert.ok(shallow[0].local / shallow[2].local < 2, 'local: about constant');
  const deep = gradientVariance({ ns: [2, 6, 10], depth: 'linear', samples: 200 });
  assert.ok(deep[0].local / deep[2].local > 20, 'deep circuits flatten even the local cost');
  // the parameter-shift gradient of the hardware-efficient circuit agrees with a finite difference
  const { hardwareEfficientOps, run, expZ } = await import('../lib/vqc.js');
  const { ops, count } = hardwareEfficientOps(4, 3);
  const p = Array.from({ length: count }, (_, k) => 0.3 * k);
  const f = (q) => expZ(run(4, ops, q), 0);
  const shift = (d) => f(p.map((v, k) => (k === 0 ? v + d : v)));
  assert.ok(Math.abs((shift(Math.PI / 2) - shift(-Math.PI / 2)) / 2 - (shift(1e-6) - shift(-1e-6)) / 2e-6) < 1e-6);
});

test('the H₂ data shipped with the site equal the PennyLane reference', async () => {
  const { H2 } = await import('../lib/h2-data.js');
  assert.equal(H2.length, ref.h2.length);
  H2.forEach((h, i) => {
    const r = ref.h2[i];
    assert.equal(h.bond, r.bond);
    assert.equal(h.fci, r.fci);
    assert.equal(h.hf, r.hf);
    assert.deepEqual(h.terms, r.terms);
  });
});

test('the classical Fourier surrogate uses exactly the frequencies an L-layer classifier can produce', async () => {
  const { fourierFeatures, classify, fourierCoefficients } = await import('../lib/vqc.js');
  assert.equal(fourierFeatures(3)([0.1, 0.2]).length, 49); // 1 + 2 × 24 half-plane frequencies
  // along a line x₂ = 0 the classifier has no frequency above L in x₁
  const params = Array.from({ length: 12 }, (_, k) => 0.7 * k - 2);
  const co = fourierCoefficients((t) => classify(3, params, [t, 0]), 6);
  for (const c of co) if (Math.abs(c.k) > 3) assert.ok(Math.hypot(c.re, c.im) < 1e-12);
});
