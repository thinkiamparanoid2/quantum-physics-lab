// The transmon (Koch et al., PRA 76, 042319, 2007): a Josephson junction shunted by a capacitor,
// H = 4 E_C (n − n_g)² − E_J cos φ. Energies in units of E_C.
//
// Two independent solvers: the charge basis (n = −N … N, cos φ couples n to n ± 1) and a grid in φ
// with the offset charge as a twisted boundary condition ψ(φ + 2π) = e^{2πi n_g} ψ(φ), using
// central differences. Both should give the same low levels.

import { hermitianEigen, symmetricEigen } from './linalg.js';

export function chargeBasisLevels(ratio, ng, { N = 20, count = 5 } = {}) {
  const d = 2 * N + 1;
  const H = new Float64Array(d * d);
  for (let i = 0; i < d; i++) {
    const n = i - N;
    H[i * d + i] = 4 * (n - ng) ** 2;
    if (i + 1 < d) H[i * d + i + 1] = H[(i + 1) * d + i] = -ratio / 2;
  }
  return symmetricEigen(H, d).values.slice(0, count);
}

// The same Hamiltonian on M points in φ ∈ [−π, π): −4 d²/dφ² with the twist, central differences
// (fourth-order stencil). Returns the low levels and the probability densities on the grid.
export function phaseBasis(ratio, ng, { M = 160, count = 4 } = {}) {
  const h = (2 * Math.PI) / M;
  const re = new Float64Array(M * M);
  const im = new Float64Array(M * M);
  // −4 ψ'' with stencil (−1, 16, −30, 16, −1)/(12 h²); hopping across the boundary picks up e^{±2πi n_g}
  const coef = [
    [1, 16],
    [2, -1],
  ];
  const twist = 2 * Math.PI * ng;
  for (let i = 0; i < M; i++) {
    const phi = -Math.PI + i * h;
    re[i * M + i] = (-4 * -30) / (12 * h * h) - ratio * Math.cos(phi);
    for (const [k, c] of coef) {
      for (const dir of [1, -1]) {
        let j = i + dir * k;
        let wraps = 0;
        if (j >= M) {
          j -= M;
          wraps = 1;
        }
        if (j < 0) {
          j += M;
          wraps = -1;
        }
        // ψ(φ_j + 2π wraps) = e^{2πi n_g wraps} ψ(φ_j)
        const val = (-4 * c) / (12 * h * h);
        re[i * M + j] += val * Math.cos(twist * wraps);
        im[i * M + j] += val * Math.sin(twist * wraps);
      }
    }
  }
  const { values, vectors } = hermitianEigen(re, im, M);
  return {
    phis: Array.from({ length: M }, (_, i) => -Math.PI + i * h),
    levels: values.slice(0, count),
    densities: vectors.slice(0, count).map((v) => Array.from(v.re, (r, i) => (r * r + v.im[i] ** 2) / h)),
  };
}

// Koch et al.'s large-E_J/E_C formulas (energies in E_C).
export const asymptotic = {
  f01: (ratio) => Math.sqrt(8 * ratio) - 1,
  anharmonicity: () => -1,
  // ε_m ≈ (−1)^m E_C 2^{4m+5}/m! √(2/π) (E_J/2E_C)^{m/2 + 3/4} e^{−√(8 E_J/E_C)}: the peak-to-peak
  // variation of level m with n_g
  dispersion: (ratio, m) => {
    let fact = 1;
    for (let k = 2; k <= m; k++) fact *= k;
    return (2 ** (4 * m + 5) / fact) * Math.sqrt(2 / Math.PI) * (ratio / 2) ** (m / 2 + 3 / 4) * Math.exp(-Math.sqrt(8 * ratio));
  },
};

// Level m's peak-to-peak variation with offset charge, from the charge basis.
export function dispersion(ratio, m) {
  const e0 = chargeBasisLevels(ratio, 0, { count: m + 1 })[m];
  const eh = chargeBasisLevels(ratio, 0.5, { count: m + 1 })[m];
  return Math.abs(e0 - eh);
}
