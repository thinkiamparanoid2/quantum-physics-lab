// Fields on a lattice: a chain of masses and springs, its normal modes, and their quanta.
// Units: mass 1, spring constant 1, ħ = 1. Each mass may also be pinned to its rest position by a
// spring of frequency w0, which gives the quanta a mass gap (a lattice Klein–Gordon field).

import { symmetricEigen } from './linalg.js';

// Normal modes of N masses between fixed walls: u_j = sqrt(2/(N+1)) sin(j k π/(N+1)),
// ω_k² = w0² + 4 sin²(k π / (2(N+1))), k = 1 … N.
export function chainModes(N, w0 = 0) {
  return Array.from({ length: N }, (_, i) => {
    const k = i + 1;
    const q = (k * Math.PI) / (N + 1);
    return {
      k,
      q,
      omega: Math.sqrt(w0 * w0 + 4 * Math.sin(q / 2) ** 2),
      shape: Array.from({ length: N }, (_, j) => Math.sqrt(2 / (N + 1)) * Math.sin((j + 1) * q)),
    };
  });
}

// The same frequencies by diagonalising the chain's dynamical matrix (a check on the formula).
export function chainModesNumerical(N, w0 = 0) {
  const a = new Float64Array(N * N);
  for (let j = 0; j < N; j++) {
    a[j * N + j] = 2 + w0 * w0;
    if (j + 1 < N) a[j * N + j + 1] = a[(j + 1) * N + j] = -1;
  }
  return symmetricEigen(a, N).values.map(Math.sqrt);
}

// Quantum fluctuation of each mass's displacement in the Fock state with occupations n_k:
// ⟨u_j²⟩ = Σ_k shape_k(j)² (2 n_k + 1) / (2 ω_k). (Zero for an unpinned zero mode, which a chain
// with fixed ends does not have.)
export function fluctuations(modes, occ) {
  const N = modes.length;
  return Array.from({ length: N }, (_, j) => Math.sqrt(modes.reduce((s, m, i) => s + (m.shape[j] ** 2 * (2 * (occ[i] ?? 0) + 1)) / (2 * m.omega), 0)));
}

export const energyOf = (modes, occ) => modes.reduce((s, m, i) => s + m.omega * ((occ[i] ?? 0) + 0.5), 0);

// Two pinned masses joined by a spring, H = Σ (p_i² + w0² x_i²)/2 + κ (x1 − x2)²/2, diagonalised
// in the Fock basis of the uncoupled oscillators (n1, n2 ≤ nmax). The normal-mode answer is
// E = ω₊ (n₊ + ½) + ω₋ (n₋ + ½) with ω₊ = w0 and ω₋ = sqrt(w0² + 2κ).
export function twoOscillatorsFock(nmax, w0, kappa) {
  const d = nmax + 1;
  const dim = d * d;
  const H = new Float64Array(dim * dim);
  // x = (a + a†)/sqrt(2 w0); x² and x in the single-oscillator Fock basis
  const x = new Float64Array(d * d);
  for (let n = 0; n + 1 < d; n++) x[n * d + n + 1] = x[(n + 1) * d + n] = Math.sqrt((n + 1) / (2 * w0));
  const x2 = new Float64Array(d * d);
  for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) for (let k = 0; k < d; k++) x2[i * d + j] += x[i * d + k] * x[k * d + j];
  const idx = (n1, n2) => n1 * d + n2;
  for (let a1 = 0; a1 < d; a1++) {
    for (let a2 = 0; a2 < d; a2++) {
      const r = idx(a1, a2);
      H[r * dim + r] += w0 * (a1 + 0.5) + w0 * (a2 + 0.5);
      for (let b1 = 0; b1 < d; b1++) {
        for (let b2 = 0; b2 < d; b2++) {
          const c = idx(b1, b2);
          let v = 0;
          if (a2 === b2) v += (kappa / 2) * x2[a1 * d + b1];
          if (a1 === b1) v += (kappa / 2) * x2[a2 * d + b2];
          v -= kappa * x[a1 * d + b1] * x[a2 * d + b2];
          H[r * dim + c] += v;
        }
      }
    }
  }
  return symmetricEigen(H, dim).values;
}

// The exact two-oscillator levels from the normal modes, lowest first, with their phonon numbers.
export function twoOscillatorsExact(w0, kappa, count) {
  const wp = w0;
  const wm = Math.sqrt(w0 * w0 + 2 * kappa);
  const out = [];
  for (let a = 0; a < 30; a++) for (let b = 0; b < 30; b++) out.push({ np: a, nm: b, E: wp * (a + 0.5) + wm * (b + 0.5) });
  return out.sort((p, q) => p.E - q.E).slice(0, count);
}
