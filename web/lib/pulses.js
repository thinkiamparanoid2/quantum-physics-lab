// Microwave pulses on a three-level transmon, in the frame rotating at the qubit frequency (RWA):
//   H(t) = α|2⟩⟨2| + Ω_x(t)/2 (σx⁰¹ + λ σx¹²) + Ω_y(t)/2 (σy⁰¹ + λ σy¹²),   λ = √2.
// Times in ns, angular frequencies in rad/ns (α = 2π × anharmonicity in GHz).
// A Gaussian π pulse on Ω_x; DRAG (Motzoi et al., PRL 2009) adds Ω_y = −β Ω̇_x / α.

import { hermitianEigen } from './linalg.js';

export function gaussianPulse(T, { area = Math.PI } = {}) {
  const sigma = T / 4;
  const g = (t) => Math.exp(-((t - T / 2) ** 2) / (2 * sigma * sigma));
  const g0 = g(0); // shift so the pulse starts and ends at zero
  const shape = (t) => g(t) - g0;
  // normalise the area numerically
  let s = 0;
  const M = 2000;
  for (let k = 0; k < M; k++) s += shape(((k + 0.5) * T) / M) * (T / M);
  const amp = area / s;
  const dshape = (t) => (-(t - T / 2) / (sigma * sigma)) * g(t);
  return { T, x: (t) => amp * shape(t), dx: (t) => amp * dshape(t) };
}

function hamiltonian(ox, oy, alpha, lambda) {
  // basis |0⟩, |1⟩, |2⟩; σx⁰¹ couples 0–1, σy⁰¹ = −i|0⟩⟨1| + i|1⟩⟨0|
  const re = new Float64Array(9);
  const im = new Float64Array(9);
  re[8] = alpha;
  re[1] = re[3] = ox / 2;
  re[5] = re[7] = (lambda * ox) / 2;
  im[1] = -oy / 2; // ⟨0|H|1⟩
  im[3] = oy / 2;
  im[5] = (-lambda * oy) / 2; // ⟨1|H|2⟩
  im[7] = (lambda * oy) / 2;
  return { re, im };
}

// U = e^{−iH dt} for a 3 × 3 Hermitian H, by diagonalisation.
function step(H, dt) {
  const { values, vectors } = hermitianEigen(H.re, H.im, 3);
  const re = new Float64Array(9);
  const im = new Float64Array(9);
  values.forEach((lam, k) => {
    const [c, s] = [Math.cos(lam * dt), -Math.sin(lam * dt)];
    const { re: ur, im: ui } = vectors[k];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        // e^{−iλdt} u_i conj(u_j)
        const pr = ur[i] * ur[j] + ui[i] * ui[j];
        const pi = ui[i] * ur[j] - ur[i] * ui[j];
        re[i * 3 + j] += c * pr - s * pi;
        im[i * 3 + j] += c * pi + s * pr;
      }
    }
  });
  return { re, im };
}

function mul(A, B) {
  const re = new Float64Array(9);
  const im = new Float64Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        re[i * 3 + j] += A.re[i * 3 + k] * B.re[k * 3 + j] - A.im[i * 3 + k] * B.im[k * 3 + j];
        im[i * 3 + j] += A.re[i * 3 + k] * B.im[k * 3 + j] + A.im[i * 3 + k] * B.re[k * 3 + j];
      }
    }
  }
  return { re, im };
}

// Evolve the full 3 × 3 propagator; optionally record populations of a start state along the way.
export function simulatePulse({ T, anharm = -0.25, beta = 0, lambda = Math.SQRT2, steps = 1000, record = 0 }) {
  const alpha = 2 * Math.PI * anharm;
  const p = gaussianPulse(T);
  const dt = T / steps;
  let U = { re: Float64Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), im: new Float64Array(9) };
  const trace = [];
  for (let k = 0; k < steps; k++) {
    const t = (k + 0.5) * dt;
    const ox = p.x(t);
    const oy = alpha ? (-beta * p.dx(t)) / alpha : 0;
    U = mul(step(hamiltonian(ox, oy, alpha, lambda), dt), U);
    if (record && k % Math.max(1, Math.floor(steps / record)) === 0) {
      const col = [0, 1, 2].map((i) => U.re[i * 3] ** 2 + U.im[i * 3] ** 2); // start in |0⟩
      trace.push({ t: (k + 1) * dt, p: col, ox, oy });
    }
  }
  return { U, trace, pulse: p };
}

// Gate quality against X on the qubit subspace: leakage out of {|0⟩, |1⟩} and the average gate
// fidelity of the 2 × 2 block M (Pedersen et al. 2007: F = (Tr MM† + |Tr X M|²) / 6), after the
// best virtual Z rotation, which hardware applies for free in software.
export function gateQuality(U) {
  const M = [
    [U.re[0], U.im[0], U.re[1], U.im[1]],
    [U.re[3], U.im[3], U.re[4], U.im[4]],
  ];
  const leak = 1 - (M[0][0] ** 2 + M[0][1] ** 2 + M[1][0] ** 2 + M[1][1] ** 2) / 1; // from |0⟩
  const leak1 = 1 - (U.re[1] ** 2 + U.im[1] ** 2 + U.re[4] ** 2 + U.im[4] ** 2); // from |1⟩
  // Tr(X† Z(θ) M) over θ: X†Z(θ)M picks M10 e^{iθ/2} + M01 e^{−iθ/2} (up to phases)
  let best = 0;
  const trMM = M[0][0] ** 2 + M[0][1] ** 2 + M[0][2] ** 2 + M[0][3] ** 2 + M[1][0] ** 2 + M[1][1] ** 2 + M[1][2] ** 2 + M[1][3] ** 2;
  for (let k = 0; k < 360; k++) {
    const th = (2 * Math.PI * k) / 360;
    const [c, s] = [Math.cos(th / 2), Math.sin(th / 2)];
    // a = M[1][0..1] e^{iθ/2}, b = M[0][2..3] e^{−iθ/2}
    const ar = M[1][0] * c - M[1][1] * s;
    const ai = M[1][0] * s + M[1][1] * c;
    const br = M[0][2] * c + M[0][3] * s;
    const bi = M[0][3] * c - M[0][2] * s;
    best = Math.max(best, (ar + br) ** 2 + (ai + bi) ** 2);
  }
  const fidelity = (trMM + best) / 6;
  return { leakage: (leak + leak1) / 2, error: 1 - fidelity };
}
