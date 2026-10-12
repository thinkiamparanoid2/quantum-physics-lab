// Amplitude estimation (Brassard, Høyer, Mosca & Tapp 2002) for a one-qubit state preparation
// A = RY(2θ), so that A|0⟩ = cos θ|0⟩ + sin θ|1⟩ and the amplitude to estimate is a = sin²θ.
// Its Grover operator Q = −A S₀ A† S_χ (S_χ = Z marks |1⟩, S₀ = I − 2|0⟩⟨0|) works out to RY(4θ),
// with eigenvalues e^{±2iθ}. Phase estimation on Q with m counting qubits returns y; the estimate
// is ã = sin²(π y / 2^m).

import { inverseQftOps } from './algorithms.js';

const range = (n) => Array.from({ length: n }, (_, i) => i);

// circuit.js ops: counting qubits 0 … m−1 (qubit 0 most significant), state qubit m.
export function qaeCircuit(m, a) {
  const theta = Math.asin(Math.sqrt(a));
  const count = range(m);
  const target = m;
  const prep = [{ gate: 'RY', target, angle: 2 * theta, label: 'A' }, ...count.map((q) => ({ gate: 'H', target: q }))];
  const powers = count.map((q, j) => ({ gate: 'RY', target, controls: [q], angle: 4 * theta * 2 ** (m - 1 - j), label: `Q^${2 ** (m - 1 - j)}` }));
  const iqft = inverseQftOps(count);
  return { ops: [...prep, ...powers, ...iqft], count, theta, calls: 2 ** m - 1 };
}

// The exact outcome distribution: P(y) = ½ [F(y − Mφ) + F(y + Mφ)], φ = θ/π, M = 2^m, where
// F(δ) = sin²(πδ) / (M² sin²(πδ/M)) (and 1 when δ is a multiple of M).
export function qaeDistribution(m, a) {
  const M = 2 ** m;
  const phi = Math.asin(Math.sqrt(a)) / Math.PI;
  const F = (d) => {
    const s = Math.sin((Math.PI * d) / M);
    return Math.abs(s) < 1e-12 ? 1 : Math.sin(Math.PI * d) ** 2 / (M * M * s * s);
  };
  return range(M).map((y) => 0.5 * (F(y - M * phi) + F(y + M * phi)));
}

export const estimateOf = (y, m) => Math.sin((Math.PI * y) / 2 ** m) ** 2;

// Root-mean-square error of the estimate, exactly, from the distribution.
export function qaeRmse(m, a) {
  const P = qaeDistribution(m, a);
  return Math.sqrt(P.reduce((s, p, y) => s + p * (estimateOf(y, m) - a) ** 2, 0));
}

// Classical sampling: N runs of A, estimate = fraction of 1s, RMSE = √(a(1 − a)/N).
export const classicalRmse = (N, a) => Math.sqrt((a * (1 - a)) / N);

// The error reached with probability at least q (default 8/π² ≈ 0.81, the confidence in the
// Brassard et al. theorem). The canonical estimator's distribution has 1/δ² tails, so this, not the
// root-mean-square error, is the quantity that falls as 1/M.
export const CONFIDENCE = 8 / Math.PI ** 2;
export function qaeQuantileError(m, a, q = CONFIDENCE) {
  const P = qaeDistribution(m, a);
  const errs = P.map((p, y) => ({ p, e: Math.abs(estimateOf(y, m) - a) })).sort((u, v) => u.e - v.e);
  let acc = 0;
  for (const { p, e } of errs) {
    acc += p;
    if (acc >= q - 1e-12) return e;
  }
  return errs[errs.length - 1].e;
}
export const bhmtBound = (m, a) => (2 * Math.PI * Math.sqrt(a * (1 - a))) / 2 ** m + Math.PI ** 2 / 4 ** m;

// Sampling at the same confidence: the normal-approximation half-width z σ with z for a two-sided q.
export function classicalQuantileError(N, a, q = CONFIDENCE) {
  // z with erf(z/√2) = q, by bisection
  const erf = (x) => {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return x >= 0 ? y : -y;
  };
  let [lo, hi] = [0, 5];
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (erf(mid / Math.SQRT2) < q) lo = mid;
    else hi = mid;
  }
  return lo * classicalRmse(N, a);
}
