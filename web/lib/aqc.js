// Adiabatic quantum computing: H(s) = (1 − s) H_B + s H_P with H_B = −Σ X_i (ground state |+…+⟩)
// and H_P a diagonal Ising cost Σ J_ij Z_i Z_j + Σ h_i Z_i whose ground state is the answer.

import { evolveExact, makeOperator } from './dynamics.js';
import { symmetricEigen } from './linalg.js';

// A random Ising instance on n spins with integer couplings and fields in {−2 … 2}; fields break the
// up–down symmetry. Returns the terms of H_P and its sorted diagonal.
export function isingInstance(n, seed) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const pick = () => Math.floor(rng() * 5) - 2;
  const terms = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const J = pick();
    if (J) terms.push({ coeff: J, xmask: 0, zmask: (1 << i) | (1 << j) });
  }
  for (let i = 0; i < n; i++) {
    const h = pick() * 0.5;
    if (h) terms.push({ coeff: h, xmask: 0, zmask: 1 << i });
  }
  const diag = Array.from({ length: 1 << n }, (_, b) => terms.reduce((e, t) => e + t.coeff * (popcount(b & t.zmask) & 1 ? -1 : 1), 0));
  return { n, terms, diag };
}

function popcount(x) {
  let c = 0;
  for (; x; x &= x - 1) c++;
  return c;
}

export function interpolatedTerms(inst, s) {
  const base = Array.from({ length: inst.n }, (_, i) => ({ coeff: -(1 - s), xmask: 1 << i, zmask: 0 }));
  return [...base, ...inst.terms.map((t) => ({ ...t, coeff: s * t.coeff }))];
}

// Dense matrix of a real Pauli sum (X and Z only).
function denseReal(terms, n) {
  const d = 1 << n;
  const M = new Float64Array(d * d);
  for (const t of terms) for (let b = 0; b < d; b++) M[(b ^ t.xmask) * d + b] += t.coeff * (popcount(b & t.zmask) & 1 ? -1 : 1);
  return M;
}

// Lowest `count` levels of H(s) on a grid of s, and the minimum gap between the ground state and
// the first excited state (in the symmetric sector: everything here is real and nondegenerate).
export function spectrum(inst, { points = 61, count = 8 } = {}) {
  const d = 1 << inst.n;
  const rows = [];
  for (let k = 0; k < points; k++) {
    const s = k / (points - 1);
    const values = symmetricEigen(denseReal(interpolatedTerms(inst, s), inst.n), d).values.slice(0, count);
    rows.push({ s, values });
  }
  const gaps = rows.map((r) => r.values[1] - r.values[0]);
  const minGap = Math.min(...gaps.slice(0, -1)); // at s = 1 a degenerate optimum would make it 0
  return { rows, minGap, sAtMin: rows[gaps.indexOf(minGap)].s };
}

// Run the linear schedule s = t/T in `steps` piecewise-constant pieces from |+…+⟩. Returns the
// probability of ending in the optimal bit string(s), and the ground-state overlap along the way.
export function anneal(inst, T, { steps = 200 } = {}) {
  const d = 1 << inst.n;
  const re = new Float64Array(d).fill(1 / Math.sqrt(d));
  const im = new Float64Array(d);
  const best = Math.min(...inst.diag);
  const optimal = inst.diag.map((e, b) => (Math.abs(e - best) < 1e-9 ? b : -1)).filter((b) => b >= 0);
  for (let k = 0; k < steps; k++) {
    const s = (k + 0.5) / steps;
    evolveExact(makeOperator(interpolatedTerms(inst, s), inst.n), re, im, T / steps);
  }
  const success = optimal.reduce((p, b) => p + re[b] ** 2 + im[b] ** 2, 0);
  return { success, optimal };
}

export function annealScan({ seed, n, Ts }, progress) {
  const inst = isingInstance(n, seed);
  const spec = spectrum(inst);
  const out = Ts.map((T, i) => {
    const r = anneal(inst, T, { steps: Math.min(2000, Math.max(200, Math.ceil(T * 4))) });
    progress?.((i + 1) / Ts.length);
    return { T, success: r.success };
  });
  return { spec, scan: out, optimal: anneal(inst, 1, { steps: 1 }).optimal, diag: inst.diag };
}
