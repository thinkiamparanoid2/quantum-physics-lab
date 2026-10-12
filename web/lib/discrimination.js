// Telling two non-orthogonal qubit states apart from one copy. The states lie in the x-z plane of
// the Bloch sphere: |psi_k> = cos(t_k/2)|0> + sin(t_k/2)|1> (real amplitudes, t = Bloch polar
// angle measured from +z towards +x).
//   Helstrom: the projective measurement with the smallest chance of a wrong guess.
//   Unambiguous (Ivanovic-Dieks-Peres): a three-outcome POVM that is never wrong but sometimes
//   says "don't know"; realised as a projective measurement on the qubit plus an ancilla (Neumark).

import { symmetricEigen } from './linalg.js';

export const ket = (t) => [Math.cos(t / 2), Math.sin(t / 2)];
export const overlap = (t0, t1) => Math.abs(Math.cos((t1 - t0) / 2));

const outer = ([a, b]) => [a * a, a * b, a * b, b * b];
const expect = (E, v) => E[0] * v[0] * v[0] + 2 * E[1] * v[0] * v[1] + E[3] * v[1] * v[1];

// Helstrom measurement for priors q0, 1 - q0. Returns the two projectors (guess 0, guess 1), the
// table P(guess | state), the success probability and its closed form.
export function helstrom(t0, t1, q0 = 0.5) {
  const q1 = 1 - q0;
  const A = outer(ket(t0)).map((v, i) => q0 * v - q1 * outer(ket(t1))[i]);
  // Guess 0 on the eigenvector of q0 rho0 - q1 rho1 with the positive eigenvalue.
  const { values, vectors } = symmetricEigen(Float64Array.from(A), 2);
  const v0 = Array.from(vectors[1]); // largest eigenvalue
  const v1 = Array.from(vectors[0]);
  const P0 = outer(v0);
  const P1 = outer(v1);
  const table = [ket(t0), ket(t1)].map((psi) => [expect(P0, psi), expect(P1, psi)]);
  const success = q0 * table[0][0] + q1 * table[1][1];
  const s = overlap(t0, t1);
  return {
    projectors: [P0, P1],
    axes: [v0, v1],
    table,
    success,
    formula: 0.5 * (1 + Math.sqrt(1 - 4 * q0 * q1 * s * s)),
    eigen: values,
  };
}

// Optimal unambiguous discrimination for equal priors. POVM elements E0 (certainly psi0),
// E1 (certainly psi1) and E? (inconclusive).
export function unambiguous(t0, t1) {
  const s = overlap(t0, t1);
  const perp = (t) => ket(t + Math.PI); // orthogonal to ket(t) in the x-z plane
  const w = 1 / (1 + s);
  const E0 = outer(perp(t1)).map((v) => w * v); // fires only for psi0
  const E1 = outer(perp(t0)).map((v) => w * v); // fires only for psi1
  const Eq = [1 - E0[0] - E1[0], -E0[1] - E1[1], -E0[2] - E1[2], 1 - E0[3] - E1[3]];
  const elements = [E0, E1, Eq];
  const table = [ket(t0), ket(t1)].map((psi) => elements.map((E) => expect(E, psi)));
  return { elements, table, conclusive: 1 - s, s };
}

// A 4x4 real orthogonal matrix U (row-major, index = system + 2 * ancilla) with
// U|psi_k>|0> = sqrt(1 - s)|k>|0> + sqrt(s)|0>|1> (up to the sign of psi1's overlap), so measuring
// the ancilla and then the system realises the unambiguous POVM: ancilla 1 = inconclusive.
export function neumarkUnitary(t0, t1) {
  const sSigned = Math.cos((t1 - t0) / 2); // <psi0|psi1>
  const s = Math.abs(sSigned);
  const sign = sSigned < 0 ? -1 : 1;
  const a = Math.sqrt(1 - s);
  const b = Math.sqrt(s);
  const idx = (sys, anc) => sys + 2 * anc;
  const vec = (entries) => {
    const v = new Float64Array(4);
    for (const [i, x] of entries) v[i] += x;
    return v;
  };
  // Outputs for psi0 and psi1 (their inner product is sSigned, as for the inputs).
  const out0 = vec([[idx(0, 0), a], [idx(0, 1), b]]);
  const out1 = vec([[idx(1, 0), a], [idx(0, 1), sign * b]]);
  // Input frame: e1 = psi0|0>, e2 = psi0perp|0>, e3 = psi0|1>, e4 = psi0perp|1>.
  const p0 = ket(t0);
  const p0perp = ket(t0 + Math.PI);
  const c = Math.sqrt(Math.max(0, 1 - s * s));
  const inputs = [
    vec([[idx(0, 0), p0[0]], [idx(1, 0), p0[1]]]),
    vec([[idx(0, 0), p0perp[0]], [idx(1, 0), p0perp[1]]]),
    vec([[idx(0, 1), p0[0]], [idx(1, 1), p0[1]]]),
    vec([[idx(0, 1), p0perp[0]], [idx(1, 1), p0perp[1]]]),
  ];
  // psi1 = sSigned psi0 + c' psi0perp, with c' = <psi0perp|psi1>
  const p1 = ket(t1);
  const cPrime = p0perp[0] * p1[0] + p0perp[1] * p1[1];
  const images = [out0];
  images.push(out1.map((v, i) => (v - sSigned * out0[i]) / (Math.abs(cPrime) > 1e-12 ? cPrime : 1)));
  // Complete {images} to an orthonormal basis (Gram-Schmidt on the standard basis).
  for (let k = 0; k < 4 && images.length < 4; k++) {
    const e = new Float64Array(4);
    e[k] = 1;
    for (const u of images) {
      const d = e.reduce((acc, x, i) => acc + x * u[i], 0);
      for (let i = 0; i < 4; i++) e[i] -= d * u[i];
    }
    const n = Math.hypot(...e);
    if (n > 1e-8) images.push(e.map((x) => x / n));
  }
  // U = sum_j |image_j><input_j|
  const U = new Float64Array(16);
  for (let j = 0; j < 4; j++) for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) U[r * 4 + col] += images[j][r] * inputs[j][col];
  return { U, c };
}

// Probability of the curves on the comparison chart.
export const helstromSuccess = (s, q0 = 0.5) => 0.5 * (1 + Math.sqrt(1 - 4 * q0 * (1 - q0) * s * s));
