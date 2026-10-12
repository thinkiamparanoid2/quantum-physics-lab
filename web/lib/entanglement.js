// Entanglement measures for statevectors and density matrices. States use the circuit engine's
// convention: { n, dim, re, im } with qubit q = bit q of the basis index. A density matrix is
// { dim, re, im } (row-major, dim x dim).

import { hermitianEigen, hermitianFunction } from './linalg.js';

// Reduced density matrix of the qubits in `keep` (bit i of the result's index is keep[i]),
// tracing out every other qubit.
export function reducedDensity(state, keep) {
  const k = keep.length;
  const dim = 1 << k;
  const re = new Float64Array(dim * dim);
  const im = new Float64Array(dim * dim);
  const keepMask = keep.reduce((m, q) => m | (1 << q), 0);
  const sub = (b) => keep.reduce((v, q, i) => v | (((b >> q) & 1) << i), 0);
  // Group basis states by the traced-out bits; within a group, add |a><b| terms.
  const groups = new Map();
  for (let b = 0; b < state.dim; b++) {
    if (state.re[b] === 0 && state.im[b] === 0) continue;
    const rest = b & ~keepMask;
    if (!groups.has(rest)) groups.set(rest, []);
    groups.get(rest).push(b);
  }
  for (const members of groups.values()) {
    for (const a of members) {
      const ia = sub(a);
      const ar = state.re[a];
      const ai = state.im[a];
      for (const b of members) {
        const ib = sub(b);
        // psi_a conj(psi_b)
        re[ia * dim + ib] += ar * state.re[b] + ai * state.im[b];
        im[ia * dim + ib] += ai * state.re[b] - ar * state.im[b];
      }
    }
  }
  return { dim, re, im };
}

// Density matrix |psi><psi| of a whole statevector.
export function pureDensity(state) {
  return reducedDensity(state, Array.from({ length: state.n }, (_, q) => q));
}

export function eigenvalues(rho) {
  return hermitianEigen(rho.re, rho.im, rho.dim).values;
}

const xlog2x = (p) => (p > 1e-15 ? p * Math.log2(p) : 0);

// von Neumann entropy S(rho) = -tr rho log2 rho, in bits.
export function vonNeumann(rho) {
  return -eigenvalues(rho).reduce((s, p) => s + xlog2x(p), 0);
}

export function purity(rho) {
  let s = 0;
  for (let i = 0; i < rho.dim * rho.dim; i++) s += rho.re[i] ** 2 + rho.im[i] ** 2;
  return s;
}

// Entanglement entropy between `part` and the rest, for a pure state.
export const entanglementEntropy = (state, part) => vonNeumann(reducedDensity(state, part));

// Schmidt coefficients (descending) of a pure state across the cut part | rest.
export function schmidtCoefficients(state, part) {
  return eigenvalues(reducedDensity(state, part))
    .map((p) => Math.sqrt(Math.max(0, p)))
    .sort((a, b) => b - a);
}

// Concurrence of a pure two-qubit state a|00> + b|01> + c|10> + d|11> (indices 0..3): 2|ad - bc|.
export function pureConcurrence(state) {
  const [r0, r1, r2, r3] = state.re;
  const [i0, i1, i2, i3] = state.im;
  const adr = r0 * r3 - i0 * i3;
  const adi = r0 * i3 + i0 * r3;
  const bcr = r1 * r2 - i1 * i2;
  const bci = r1 * i2 + i1 * r2;
  return 2 * Math.hypot(adr - bcr, adi - bci);
}

// Wootters concurrence of a two-qubit density matrix: max(0, l1 - l2 - l3 - l4), where l are the
// square roots of the eigenvalues of sqrt(rho) rho~ sqrt(rho) and rho~ = (Y x Y) rho* (Y x Y).
export function concurrence(rho) {
  // (Y x Y) maps |b> to (+/-)|3 - b>: sign +1 for b = 0, 3 and -1 for b = 1, 2 (Y Y = -1 * ...).
  const sign = [1, -1, -1, 1];
  const tr = new Float64Array(16);
  const ti = new Float64Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const s = sign[i] * sign[j];
      tr[i * 4 + j] = s * rho.re[(3 - i) * 4 + (3 - j)];
      ti[i * 4 + j] = -s * rho.im[(3 - i) * 4 + (3 - j)];
    }
  }
  // Eigenvalues that are zero up to round-off are set to exactly zero: the square root would
  // otherwise turn a 1e-16 error into 1e-8 (this matters for pure states, which have rank 1).
  const root = hermitianFunction(rho.re, rho.im, 4, (x) => (x > 1e-13 ? Math.sqrt(x) : 0));
  // M = root * tilde * root
  const mul = (a, b) => {
    const re = new Float64Array(16);
    const im = new Float64Array(16);
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 4; k++) {
        for (let j = 0; j < 4; j++) {
          re[i * 4 + j] += a.re[i * 4 + k] * b.re[k * 4 + j] - a.im[i * 4 + k] * b.im[k * 4 + j];
          im[i * 4 + j] += a.re[i * 4 + k] * b.im[k * 4 + j] + a.im[i * 4 + k] * b.re[k * 4 + j];
        }
      }
    }
    return { re, im };
  };
  const M = mul(mul(root, { re: tr, im: ti }), root);
  // symmetrise against round-off before the Hermitian solver
  for (let i = 0; i < 4; i++) {
    for (let j = i; j < 4; j++) {
      const r = (M.re[i * 4 + j] + M.re[j * 4 + i]) / 2;
      const m = (M.im[i * 4 + j] - M.im[j * 4 + i]) / 2;
      M.re[i * 4 + j] = r;
      M.re[j * 4 + i] = r;
      M.im[i * 4 + j] = m;
      M.im[j * 4 + i] = -m;
    }
  }
  const l = hermitianEigen(M.re, M.im, 4)
    .values.map((x) => (x > 1e-14 ? Math.sqrt(x) : 0))
    .sort((a, b) => b - a);
  return Math.max(0, l[0] - l[1] - l[2] - l[3]);
}

// Partial transpose on the second qubit of a two-qubit density matrix (index = q0 + 2 q1).
export function partialTranspose(rho) {
  const re = new Float64Array(16);
  const im = new Float64Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const i2 = (i & 1) | (j & 2);
      const j2 = (j & 1) | (i & 2);
      re[i2 * 4 + j2] = rho.re[i * 4 + j];
      im[i2 * 4 + j2] = rho.im[i * 4 + j];
    }
  }
  return { dim: 4, re, im };
}

// Negativity: the sum of |negative eigenvalues| of the partial transpose (0 for separable states).
export function negativity(rho) {
  return eigenvalues(partialTranspose(rho)).reduce((s, v) => s + Math.max(0, -v), 0);
}

// Pairwise concurrence for every pair of qubits of a statevector (n x n, zero diagonal).
export function concurrenceMatrix(state) {
  const n = state.n;
  const out = new Float64Array(n * n);
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const c = concurrence(reducedDensity(state, [a, b]));
      out[a * n + b] = c;
      out[b * n + a] = c;
    }
  }
  return out;
}

// Werner state p |Phi+><Phi+| + (1 - p) I/4.
export function werner(p) {
  const re = new Float64Array(16);
  for (let i = 0; i < 4; i++) re[i * 5] = (1 - p) / 4;
  re[0] += p / 2;
  re[3] += p / 2;
  re[12] += p / 2;
  re[15] += p / 2;
  return { dim: 4, re, im: new Float64Array(16) };
}

// Partial trace of a density matrix on `nQubits` qubits, keeping `keep` (bit i = keep[i]).
export function partialTrace(rho, nQubits, keep) {
  const k = keep.length;
  const dim = 1 << k;
  const re = new Float64Array(dim * dim);
  const im = new Float64Array(dim * dim);
  const keepMask = keep.reduce((m, q) => m | (1 << q), 0);
  const sub = (b) => keep.reduce((v, q, i) => v | (((b >> q) & 1) << i), 0);
  for (let a = 0; a < rho.dim; a++) {
    for (let b = 0; b < rho.dim; b++) {
      if ((a & ~keepMask) !== (b & ~keepMask)) continue;
      re[sub(a) * dim + sub(b)] += rho.re[a * rho.dim + b];
      im[sub(a) * dim + sub(b)] += rho.im[a * rho.dim + b];
    }
  }
  return { dim, re, im };
}

// Bloch vector of a one-qubit density matrix.
export const blochOfRho = (rho) => [2 * rho.re[1], -2 * rho.im[1], rho.re[0] - rho.re[3]];
