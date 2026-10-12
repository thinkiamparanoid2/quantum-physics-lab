import assert from 'node:assert/strict';
import test from 'node:test';

import { seededRandom } from '../lib/circuit.js';
import { evolveExact, makeOperator } from '../lib/dynamics.js';
import { isingTerms } from '../lib/ising.js';
import { areaLawStates, csvd, entropyOf, fromStatevector, isingBondHamiltonians, productMPS, schmidt, tebdStep, toStatevector, twoSiteGate } from '../lib/mps.js';

const rng = seededRandom(3);
const randomState = (N) => {
  const dim = 1 << N;
  const re = Float64Array.from({ length: dim }, () => rng() - 0.5);
  const im = Float64Array.from({ length: dim }, () => rng() - 0.5);
  const n = Math.sqrt(re.reduce((s, v, i) => s + v * v + im[i] * im[i], 0));
  return { re: re.map((v) => v / n), im: im.map((v) => v / n) };
};

test('complex SVD: U S V† rebuilds the matrix, U and V have orthonormal columns', () => {
  for (const [m, n] of [
    [6, 4],
    [4, 6],
    [5, 5],
  ]) {
    const re = Float64Array.from({ length: m * n }, () => rng() - 0.5);
    const im = Float64Array.from({ length: m * n }, () => rng() - 0.5);
    const d = csvd(re, im, m, n);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sr = 0;
        let si = 0;
        for (let k = 0; k < d.r; k++) {
          const [ur, ui, vr, vi] = [d.Ur[i * d.r + k], d.Ui[i * d.r + k], d.Vr[j * d.r + k], -d.Vi[j * d.r + k]];
          sr += d.S[k] * (ur * vr - ui * vi);
          si += d.S[k] * (ur * vi + ui * vr);
        }
        assert.ok(Math.abs(sr - re[i * n + j]) < 1e-12 && Math.abs(si - im[i * n + j]) < 1e-12);
      }
    }
    for (const [Xr, Xi, rows] of [
      [d.Ur, d.Ui, m],
      [d.Vr, d.Vi, n],
    ]) {
      for (let a = 0; a < d.r; a++) {
        for (let b = 0; b < d.r; b++) {
          let gr = 0;
          for (let i = 0; i < rows; i++) gr += Xr[i * d.r + a] * Xr[i * d.r + b] + Xi[i * d.r + a] * Xi[i * d.r + b];
          assert.ok(Math.abs(gr - (a === b ? 1 : 0)) < 1e-12);
        }
      }
    }
    for (let k = 1; k < d.r; k++) assert.ok(d.S[k] <= d.S[k - 1] + 1e-15);
  }
});

test('an MPS rebuilds any state exactly at full bond dimension, and truncation loses at most the discarded weight', () => {
  const N = 8;
  const { re, im } = randomState(N);
  const full = toStatevector(fromStatevector(re, im, N));
  assert.ok(full.re.every((v, i) => Math.abs(v - re[i]) < 1e-12 && Math.abs(full.im[i] - im[i]) < 1e-12));
  const cut = fromStatevector(re, im, N, 4);
  const v = toStatevector(cut);
  let or = 0;
  let oi = 0;
  let nv = 0;
  for (let b = 0; b < re.length; b++) {
    or += re[b] * v.re[b] + im[b] * v.im[b];
    oi += re[b] * v.im[b] - im[b] * v.re[b];
    nv += v.re[b] ** 2 + v.im[b] ** 2;
  }
  const infidelity = 1 - (or * or + oi * oi) / nv;
  const discarded = cut.discarded.reduce((a, b) => a + b, 0);
  assert.ok(infidelity > 0 && infidelity <= discarded + 1e-12, `${infidelity} vs ${discarded}`);
});

test('TEBD converges to exact evolution at second order, with the right entanglement', () => {
  const [N, J, h, T] = [8, 1, 1.2, 2];
  const dim = 1 << N;
  const er = new Float64Array(dim);
  const ei = new Float64Array(dim);
  er[0] = 1;
  evolveExact(makeOperator(isingTerms(N, J, h), N), er, ei, T);
  const run = (steps) => {
    const mps = productMPS(new Array(N).fill(0));
    const gates = isingBondHamiltonians(N, J, h).map((b) => twoSiteGate(b.re, b.im, T / steps / 2));
    for (let s = 0; s < steps; s++) tebdStep(mps, gates, 64);
    const v = toStatevector(mps);
    let or = 0;
    let oi = 0;
    for (let b = 0; b < dim; b++) {
      or += er[b] * v.re[b] + ei[b] * v.im[b];
      oi += er[b] * v.im[b] - ei[b] * v.re[b];
    }
    return { infidelity: 1 - (or * or + oi * oi), S: entropyOf(schmidt(v.re, v.im, N, N / 2)) };
  };
  const [a, b] = [run(20), run(40)];
  const ratio = a.infidelity / b.infidelity;
  assert.ok(ratio > 12 && ratio < 20, `infidelity ratio ${ratio} (expect 16 for second order)`);
  assert.ok(Math.abs(b.S - entropyOf(schmidt(er, ei, N, N / 2))) < 2e-3);
});

test('area law against volume law: a gapped ground state stays flat, a random state reaches Page’s value', () => {
  const [gapped, critical, random] = areaLawStates({ N: 10, chis: [4, 32] });
  const bulk = gapped.cuts.slice(2, -2);
  assert.ok(Math.max(...bulk) - Math.min(...bulk) < 0.01 && Math.max(...bulk) < 0.2);
  assert.ok(critical.cuts[4] > critical.cuts[1] + 0.05, 'the critical state keeps growing towards the middle');
  const page = 5 - 1 / (2 * Math.log(2)); // 5 + 5 qubits
  assert.ok(Math.abs(random.cuts[4] - page) < 0.1, `${random.cuts[4]} vs ${page}`);
  assert.ok(gapped.compress[0].infidelity < 1e-5 && random.compress[0].infidelity > 0.5);
});
