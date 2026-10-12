// Ground states of many-qubit Hamiltonians: Lanczos with full reorthogonalisation on the
// operator form of lib/dynamics.js. The Hamiltonians here are real in the computational basis
// (X, Z and pairs of Y), so the iteration runs in real arithmetic.

import { applyOperator } from './dynamics.js';
import { symmetricEigen } from './linalg.js';

// Lowest eigenvalue and eigenvector, starting from `start` (a Float64Array, or a basis index).
// The Krylov space keeps every symmetry of the start vector (particle number, charge sector).
export function lanczosGround(op, start, { iters = 160, tol = 1e-11 } = {}) {
  const dim = op.dim;
  let q = typeof start === 'number' ? Object.assign(new Float64Array(dim), { [start]: 1 }) : Float64Array.from(start);
  let norm = Math.hypot(...normParts(q));
  q = q.map((v) => v / norm);
  const Q = [q];
  const alpha = [];
  const beta = [];
  const zero = new Float64Array(dim);
  const outRe = new Float64Array(dim);
  const outIm = new Float64Array(dim);
  let energy = Infinity;
  let y = [1];
  for (let k = 0; k < Math.min(iters, dim); k++) {
    applyOperator(op, Q[k], zero, outRe, outIm);
    const w = Float64Array.from(outRe);
    let a = 0;
    for (let i = 0; i < dim; i++) a += w[i] * Q[k][i];
    alpha.push(a);
    // full reorthogonalisation (twice is enough)
    for (let pass = 0; pass < 2; pass++) {
      for (const v of Q) {
        let c = 0;
        for (let i = 0; i < dim; i++) c += w[i] * v[i];
        for (let i = 0; i < dim; i++) w[i] -= c * v[i];
      }
    }
    let b = 0;
    for (let i = 0; i < dim; i++) b += w[i] * w[i];
    b = Math.sqrt(b);
    // ground state of the tridiagonal matrix so far
    const m = alpha.length;
    const T = new Float64Array(m * m);
    for (let i = 0; i < m; i++) {
      T[i * m + i] = alpha[i];
      if (i + 1 < m) T[i * m + i + 1] = T[(i + 1) * m + i] = beta[i];
    }
    const eig = symmetricEigen(T, m);
    const converged = Math.abs(eig.values[0] - energy) < tol || b < 1e-12;
    energy = eig.values[0];
    y = eig.vectors[0];
    if (converged && k > 2) break;
    if (b < 1e-12) break;
    beta.push(b);
    Q.push(w.map((v) => v / b));
  }
  const vec = new Float64Array(dim);
  y.forEach((c, k) => {
    for (let i = 0; i < dim; i++) vec[i] += c * Q[k][i];
  });
  norm = Math.hypot(...normParts(vec));
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  return { energy, vector: vec, iterations: alpha.length };
}

// Math.hypot over a long array without spreading thousands of arguments at once.
function normParts(v) {
  let s = 0;
  for (const x of v) s += x * x;
  return [Math.sqrt(s)];
}

// ⟨Z_k⟩ for every qubit of a real or complex state.
export function zExpectations(n, re, im = null) {
  const z = new Float64Array(n);
  for (let b = 0; b < re.length; b++) {
    const p = re[b] * re[b] + (im ? im[b] * im[b] : 0);
    if (p < 1e-18) continue;
    for (let k = 0; k < n; k++) z[k] += (b >> k) & 1 ? -p : p;
  }
  return z;
}
