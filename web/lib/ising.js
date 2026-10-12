// The transverse-field Ising chain, H = −J Σ Z_i Z_{i+1} − h Σ X_i (open ends), and its exact
// free-fermion solution (Lieb, Schultz & Mattis; Pfeuty 1970). Via Jordan–Wigner the chain is a
// quadratic fermion Hamiltonian; its quasiparticle energies are ε_k = 2 s_k, where s_k are the
// singular values of the N × N bidiagonal matrix with h on the diagonal and J above it, and the
// ground energy is −Σ ε_k / 2.

import { evolveExact, makeOperator } from './dynamics.js';
import { symmetricEigen } from './linalg.js';
import { lanczosGround } from './manybody.js';

export function isingTerms(N, J, h, periodic = false) {
  const terms = [];
  for (let i = 0; i + 1 < N; i++) terms.push({ coeff: -J, xmask: 0, zmask: (1 << i) | (1 << (i + 1)) });
  if (periodic) terms.push({ coeff: -J, xmask: 0, zmask: 1 | (1 << (N - 1)) });
  for (let i = 0; i < N; i++) terms.push({ coeff: -h, xmask: 1 << i, zmask: 0 });
  return terms;
}

export function freeFermion(N, J, h) {
  // B Bᵀ for the bidiagonal B (B_ii = h, B_i,i+1 = J): eigenvalues are s_k²
  const M = new Float64Array(N * N);
  for (let i = 0; i < N; i++) {
    M[i * N + i] = h * h + (i + 1 < N ? J * J : 0);
    if (i + 1 < N) M[i * N + i + 1] = M[(i + 1) * N + i] = h * J;
  }
  const eps = symmetricEigen(M, N).values.map((v) => 2 * Math.sqrt(Math.max(0, v)));
  return { eps, energy: -eps.reduce((a, b) => a + b, 0) / 2, gap: Math.min(...eps) };
}

// The ground state of the even-parity sector (∏X = +1), from Lanczos started in |+…+⟩.
export function groundState(N, J, h, periodic = false) {
  const op = makeOperator(isingTerms(N, J, h, periodic), N);
  const dim = 1 << N;
  const start = new Float64Array(dim).fill(1 / Math.sqrt(dim));
  return { op, ...lanczosGround(op, start) };
}

// Correlations ⟨Z_i Z_j⟩ and ⟨X_i⟩ of a real state.
export function zzCorrelation(N, psi, i, j) {
  let s = 0;
  for (let b = 0; b < psi.length; b++) s += psi[b] * psi[b] * (((b >> i) ^ (b >> j)) & 1 ? -1 : 1);
  return s;
}

export function xMagnetisation(N, psi) {
  let s = 0;
  for (let b = 0; b < psi.length; b++) for (let i = 0; i < N; i++) s += psi[b] * psi[b ^ (1 << i)];
  return s / N;
}

// Kink density after ramping h linearly from h0 to 0 over time tau, starting in the ground state
// at h0: the Kibble–Zurek experiment. Piecewise-constant steps of exact evolution (statevector).
export function kinkDensity(N, J, h0, tau, { steps = 200, periodic = false } = {}) {
  const g = groundState(N, J, h0, periodic);
  const re = Float64Array.from(g.vector);
  const im = new Float64Array(re.length);
  for (let s = 0; s < steps; s++) {
    const h = h0 * (1 - (s + 0.5) / steps);
    evolveExact(makeOperator(isingTerms(N, J, h, periodic), N), re, im, tau / steps);
  }
  const bonds = periodic ? N : N - 1;
  let kinks = 0;
  for (let b = 0; b < re.length; b++) {
    const p = re[b] * re[b] + im[b] * im[b];
    for (let i = 0; i < bonds; i++) if (((b >> i) ^ (b >> ((i + 1) % N))) & 1) kinks += p;
  }
  return kinks / bonds;
}

// The same ramp on a periodic chain solved with free fermions: each momentum pair (k, −k) is a
// two-level system H_k = 2 [(h − J cos k) σz + J sin k σx] (a Landau–Zener problem), with
// k = ±π/N, ±3π/N, … in the even-parity sector. At h = 0 every quasiparticle is a kink, so the
// kink density is (2/N) Σ_{k>0} p_k, p_k the probability of ending excited. Equal to
// kinkDensity(..., periodic) for any N, and cheap for N in the hundreds.
export function kinkDensityFree(N, J, h0, tau, { steps = 200 } = {}) {
  let total = 0;
  for (let m = 1; m <= N / 2; m++) {
    const k = ((2 * m - 1) * Math.PI) / N;
    const ground = (h) => {
      const a = 2 * (h - J * Math.cos(k));
      const b = 2 * J * Math.sin(k);
      const w = Math.hypot(a, b);
      // eigenvector of [[a, b], [b, −a]] with eigenvalue −w
      const v = [b, -w - a];
      const n = Math.hypot(...v) || 1;
      return { a, b, w, v: [v[0] / n, v[1] / n] };
    };
    const g0 = ground(h0);
    let [ur, ui, vr, vi] = [g0.v[0], 0, g0.v[1], 0];
    for (let s = 0; s < steps; s++) {
      const { a, b, w } = ground(h0 * (1 - (s + 0.5) / steps));
      const dt = tau / steps;
      const c = Math.cos(w * dt);
      const sn = w ? Math.sin(w * dt) / w : dt;
      // exp(−i A dt) = cos(w dt) − i sin(w dt) A / w
      const [ar, ai] = [a * ur + b * vr, a * ui + b * vi];
      const [br, bi] = [b * ur - a * vr, b * ui - a * vi];
      [ur, ui, vr, vi] = [c * ur + sn * ai, c * ui - sn * ar, c * vr + sn * bi, c * vi - sn * br];
    }
    const gf = ground(0);
    const ov = (gf.v[0] * ur + gf.v[1] * vr) ** 2 + (gf.v[0] * ui + gf.v[1] * vi) ** 2;
    total += 1 - ov;
  }
  return (2 / N) * total;
}
