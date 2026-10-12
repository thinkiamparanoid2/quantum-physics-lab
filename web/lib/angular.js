// Angular momentum (hbar = 1): spin-j matrices, ladder operators, rotations (Wigner d-matrices),
// and coupling two angular momenta (Clebsch-Gordan coefficients). Basis order for spin j is
// m = j, j - 1, ..., -j, so index k has m = j - k. Matrices are { re, im } row-major, d = 2j + 1.

import { hermitianEigen } from './linalg.js';

export const dimOf = (j) => Math.round(2 * j + 1);
export const mOf = (j, k) => j - k;

function zeros(d) {
  return { re: new Float64Array(d * d), im: new Float64Array(d * d) };
}

// J+, J-, Jz, Jx, Jy for spin j.
export function spinMatrices(j) {
  const d = dimOf(j);
  const Jz = zeros(d);
  const Jp = zeros(d);
  const Jm = zeros(d);
  for (let k = 0; k < d; k++) {
    const m = mOf(j, k);
    Jz.re[k * d + k] = m;
    // J+ |j, m> = sqrt(j(j+1) - m(m+1)) |j, m+1>: from column k (m) to row k-1 (m+1)
    if (k > 0) Jp.re[(k - 1) * d + k] = Math.sqrt(j * (j + 1) - m * (m + 1));
    if (k < d - 1) Jm.re[(k + 1) * d + k] = Math.sqrt(j * (j + 1) - m * (m - 1));
  }
  const Jx = zeros(d);
  const Jy = zeros(d);
  for (let i = 0; i < d * d; i++) {
    Jx.re[i] = (Jp.re[i] + Jm.re[i]) / 2;
    // Jy = (J+ - J-)/(2i) = -i (J+ - J-)/2
    Jy.im[i] = -(Jp.re[i] - Jm.re[i]) / 2;
  }
  return { d, Jz, Jp, Jm, Jx, Jy };
}

export function mul(a, b, d) {
  const out = zeros(d);
  for (let i = 0; i < d; i++) {
    for (let k = 0; k < d; k++) {
      const ar = a.re[i * d + k];
      const ai = a.im[i * d + k];
      if (!ar && !ai) continue;
      for (let j = 0; j < d; j++) {
        out.re[i * d + j] += ar * b.re[k * d + j] - ai * b.im[k * d + j];
        out.im[i * d + j] += ar * b.im[k * d + j] + ai * b.re[k * d + j];
      }
    }
  }
  return out;
}

export function add(a, b, d, s = 1) {
  const out = zeros(d);
  for (let i = 0; i < d * d; i++) {
    out.re[i] = a.re[i] + s * b.re[i];
    out.im[i] = a.im[i] + s * b.im[i];
  }
  return out;
}

// Rotation by angle beta about y: d^j(beta) = exp(-i beta Jy), a real orthogonal matrix.
// Built from the eigenvectors of Jy; tests compare it with Wigner's closed formula.
export function rotationY(j, beta) {
  const { d, Jy } = spinMatrices(j);
  const { values, vectors } = hermitianEigen(Jy.re, Jy.im, d);
  const out = new Float64Array(d * d);
  values.forEach((lam, k) => {
    const c = Math.cos(-beta * lam);
    const s = Math.sin(-beta * lam);
    const v = vectors[k];
    for (let r = 0; r < d; r++) {
      for (let col = 0; col < d; col++) {
        // e^{-i beta lam} v_r conj(v_col), keep the real part (the imaginary parts cancel)
        const pr = v.re[r] * v.re[col] + v.im[r] * v.im[col];
        const pi = v.im[r] * v.re[col] - v.re[r] * v.im[col];
        out[r * d + col] += c * pr - s * pi;
      }
    }
  });
  return out;
}

const fact = (() => {
  const f = [1];
  for (let i = 1; i < 60; i++) f.push(f[i - 1] * i);
  return (n) => f[Math.round(n)];
})();

// Wigner's formula for d^j_{m' m}(beta).
export function wignerD(j, mp, m, beta) {
  const c = Math.cos(beta / 2);
  const s = Math.sin(beta / 2);
  const pre = Math.sqrt(fact(j + mp) * fact(j - mp) * fact(j + m) * fact(j - m));
  let sum = 0;
  for (let k = 0; k <= 2 * j; k++) {
    const a = j + m - k;
    const b = k;
    const cc = j - mp - k;
    const dd = mp - m + k;
    if (a < 0 || cc < 0 || dd < 0) continue;
    sum += ((-1) ** (mp - m + k) * c ** (2 * j + m - mp - 2 * k) * s ** (mp - m + 2 * k)) / (fact(a) * fact(b) * fact(cc) * fact(dd));
  }
  return pre * sum;
}

// Probabilities of each m (in order m = j .. -j) after rotating |j, j> by beta about y: what a
// Stern-Gerlach magnet tilted by beta sees for a spin-j particle polarised along z.
export const tiltedProbabilities = (j, beta) => Array.from({ length: dimOf(j) }, (_, k) => wignerD(j, j - k, j, beta) ** 2);

// Clebsch-Gordan coefficient <j1 m1; j2 m2 | J M> (Racah's formula, Condon-Shortley phases).
export function clebsch(j1, m1, j2, m2, J, M) {
  if (Math.abs(m1 + m2 - M) > 1e-9) return 0;
  if (J < Math.abs(j1 - j2) - 1e-9 || J > j1 + j2 + 1e-9) return 0;
  if (Math.abs(m1) > j1 + 1e-9 || Math.abs(m2) > j2 + 1e-9 || Math.abs(M) > J + 1e-9) return 0;
  const pre =
    Math.sqrt(((2 * J + 1) * fact(J + j1 - j2) * fact(J - j1 + j2) * fact(j1 + j2 - J)) / fact(j1 + j2 + J + 1)) *
    Math.sqrt(fact(J + M) * fact(J - M) * fact(j1 - m1) * fact(j1 + m1) * fact(j2 - m2) * fact(j2 + m2));
  let sum = 0;
  for (let k = 0; k <= j1 + j2 + J; k++) {
    const den = [k, j1 + j2 - J - k, j1 - m1 - k, j2 + m2 - k, J - j2 + m1 + k, J - j1 - m2 + k];
    if (den.some((x) => x < -1e-9)) continue;
    sum += (-1) ** k / den.reduce((p, x) => p * fact(x), 1);
  }
  return pre * sum;
}

// Total angular momentum of two spins, found by diagonalising J² = (J1 + J2)² in the product basis
// (index k1 * d2 + k2). Returns the eigenvalues and eigenvectors (ascending), an independent route
// to the coupled states that the Clebsch-Gordan formula also gives.
export function coupledByDiagonalising(j1, j2) {
  const A = spinMatrices(j1);
  const B = spinMatrices(j2);
  const d = A.d * B.d;
  const kron = (X, Y) => {
    const out = zeros(d);
    for (let a = 0; a < A.d; a++) {
      for (let b = 0; b < A.d; b++) {
        const xr = X ? X.re[a * A.d + b] : a === b ? 1 : 0;
        const xi = X ? X.im[a * A.d + b] : 0;
        for (let c = 0; c < B.d; c++) {
          for (let e = 0; e < B.d; e++) {
            const yr = Y ? Y.re[c * B.d + e] : c === e ? 1 : 0;
            const yi = Y ? Y.im[c * B.d + e] : 0;
            out.re[(a * B.d + c) * d + (b * B.d + e)] = xr * yr - xi * yi;
            out.im[(a * B.d + c) * d + (b * B.d + e)] = xr * yi + xi * yr;
          }
        }
      }
    }
    return out;
  };
  let J2 = zeros(d);
  for (const key of ['Jx', 'Jy', 'Jz']) {
    const Jk = add(kron(A[key], null), kron(null, B[key]), d);
    J2 = add(J2, mul(Jk, Jk, d), d);
  }
  const Jz = add(kron(A.Jz, null), kron(null, B.Jz), d);
  // Diagonalise J² + epsilon Jz so each eigenvector also has a definite M.
  const { values, vectors } = hermitianEigen(add(J2, Jz, d, 1e-3).re, add(J2, Jz, d, 1e-3).im, d);
  return {
    d,
    states: values.map((v, k) => {
      const vec = vectors[k];
      let M = 0;
      let norm = 0;
      for (let i = 0; i < d; i++) {
        const w = vec.re[i] ** 2 + vec.im[i] ** 2;
        M += w * (mOf(j1, Math.floor(i / B.d)) + mOf(j2, i % B.d));
        norm += w;
      }
      M /= norm;
      const JJ = v - 1e-3 * M;
      const J = (-1 + Math.sqrt(1 + 4 * JJ)) / 2;
      return { J: Math.round(J * 2) / 2, M: Math.round(M * 2) / 2, vector: vec };
    }),
  };
}

// Allowed total J values for j1 x j2.
export const totalJ = (j1, j2) => {
  const out = [];
  for (let J = Math.abs(j1 - j2); J <= j1 + j2 + 1e-9; J += 1) out.push(J);
  return out;
};
