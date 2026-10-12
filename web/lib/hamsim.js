// Hamiltonian simulation: product formulas (Trotter, orders 1 and 2) against qDRIFT (Campbell,
// PRL 2019). H = Σ_j h_j P_j with Pauli strings P_j in the bitmask form of lib/dynamics.js.
//
// qDRIFT applies N rotations e^{−iτ sign(h_j) P_j}, each term drawn with probability |h_j|/λ,
// λ = Σ|h_j|, τ = λt/N. Its average effect is a channel; here that channel is computed exactly on
// density matrices (each step ρ → Σ_j p_j U_j ρ U_j†), so no sampling noise enters the comparison.

import { evolveExact, makeOperator, trotterStep } from './dynamics.js';

const I_POW = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
const popcount = (x) => {
  let c = 0;
  for (; x; x &= x - 1) c++;
  return c;
};
// P|b⟩ = phase(b) |b ⊕ x⟩ with phase(b) = i^{#Y} (−1)^{popcount(b & z)}
function phaseOf(term, b) {
  const [pr, pi] = I_POW[popcount(term.xmask & term.zmask) & 3];
  const s = popcount(b & term.zmask) & 1 ? -1 : 1;
  return [s * pr, s * pi];
}

// ρ → U ρ U† for U = e^{−iθP} = cos θ − i sin θ P (d × d complex, row-major).
function conjugate(term, theta, re, im, d) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const x = term.xmask;
  // A = P ρ, B = ρ P, C = P ρ P
  const Ar = new Float64Array(d * d);
  const Ai = new Float64Array(d * d);
  const Br = new Float64Array(d * d);
  const Bi = new Float64Array(d * d);
  const Cr = new Float64Array(d * d);
  const Ci = new Float64Array(d * d);
  const ph = Array.from({ length: d }, (_, b) => phaseOf(term, b));
  for (let a = 0; a < d; a++) {
    const a2 = a ^ x; // (Pρ)[a][c] = phase(a2) ρ[a2][c]
    const [pr, pi] = ph[a2];
    for (let k = 0; k < d; k++) {
      const [rr, ri] = [re[a2 * d + k], im[a2 * d + k]];
      Ar[a * d + k] = pr * rr - pi * ri;
      Ai[a * d + k] = pr * ri + pi * rr;
    }
  }
  for (let k = 0; k < d; k++) {
    const k2 = k ^ x; // (ρP)[a][k] = ρ[a][k2] phase(k)… : (ρP)[a][k] = Σ_b ρ[a][b] P[b][k] = ρ[a][k⊕x] phase(k)
    const [pr, pi] = ph[k];
    for (let a = 0; a < d; a++) {
      const [rr, ri] = [re[a * d + k2], im[a * d + k2]];
      Br[a * d + k] = rr * pr - ri * pi;
      Bi[a * d + k] = rr * pi + ri * pr;
      const [ar, ai] = [Ar[a * d + k2], Ai[a * d + k2]];
      Cr[a * d + k] = ar * pr - ai * pi;
      Ci[a * d + k] = ar * pi + ai * pr;
    }
  }
  // U ρ U† = c² ρ + s² PρP − i s c (Pρ − ρP)
  for (let i = 0; i < d * d; i++) {
    const dr = Ar[i] - Br[i];
    const di = Ai[i] - Bi[i];
    re[i] = c * c * re[i] + s * s * Cr[i] + s * c * di;
    im[i] = c * c * im[i] + s * s * Ci[i] - s * c * dr;
  }
}

// One qDRIFT step on a density matrix: the average over terms.
function qdriftStep(terms, lambda, tau, re, im, d) {
  const outR = new Float64Array(d * d);
  const outI = new Float64Array(d * d);
  for (const t of terms) {
    const p = Math.abs(t.coeff) / lambda;
    const r = Float64Array.from(re);
    const i = Float64Array.from(im);
    conjugate(t, Math.sign(t.coeff) * tau, r, i, d);
    for (let k = 0; k < d * d; k++) {
      outR[k] += p * r[k];
      outI[k] += p * i[k];
    }
  }
  re.set(outR);
  im.set(outI);
}

// Infidelity 1 − ⟨ψ|ρ|ψ⟩ after time t, against the exact state, for each method and number of steps.
export function compareMethods({ terms, n, start, t, stepsList }, progress) {
  const d = 1 << n;
  const live = terms.filter((x) => x.xmask || x.zmask); // the identity only adds a global phase
  const op = makeOperator(live, n);
  const er = new Float64Array(d);
  const ei = new Float64Array(d);
  er[start] = 1;
  evolveExact(op, er, ei, t);
  const lambda = live.reduce((s, x) => s + Math.abs(x.coeff), 0);
  const L = live.length;
  const out = { lambda, L, trotter1: [], trotter2: [], qdrift: [] };
  stepsList.forEach((N, idx) => {
    for (const order of [1, 2]) {
      const re = new Float64Array(d);
      const im = new Float64Array(d);
      re[start] = 1;
      for (let k = 0; k < N; k++) trotterStep(live, re, im, t / N, order);
      let or = 0;
      let oi = 0;
      for (let b = 0; b < d; b++) {
        or += er[b] * re[b] + ei[b] * im[b];
        oi += er[b] * im[b] - ei[b] * re[b];
      }
      out[`trotter${order}`].push({ steps: N, exps: order === 1 ? N * L : N * (2 * L - 1), infidelity: Math.max(1e-16, 1 - (or * or + oi * oi)) });
    }
    // qDRIFT with N·L samples, so all methods are compared at the same number of exponentials
    const Nq = N * L;
    const rr = new Float64Array(d * d);
    const ri = new Float64Array(d * d);
    rr[start * d + start] = 1;
    for (let k = 0; k < Nq; k++) qdriftStep(live, lambda, (lambda * t) / Nq, rr, ri, d);
    // ⟨ψ|ρ|ψ⟩
    let f = 0;
    for (let a = 0; a < d; a++) {
      for (let b = 0; b < d; b++) {
        // conj(ψ_a) ρ_ab ψ_b
        const [xr, xi] = [er[a], -ei[a]];
        const [yr, yi] = [rr[a * d + b], ri[a * d + b]];
        const [zr, zi] = [xr * yr - xi * yi, xr * yi + xi * yr];
        f += zr * er[b] - zi * ei[b];
      }
    }
    out.qdrift.push({ steps: Nq, exps: Nq, infidelity: Math.max(1e-16, 1 - f), bound: (2 * lambda * lambda * t * t) / Nq });
    progress?.((idx + 1) / stepsList.length);
  });
  return out;
}

// A 4-qubit model with many terms of very different sizes (as in molecular Hamiltonians, where most
// terms are tiny): 60 distinct random Pauli strings with coefficients ∝ 1/k².
export function skewedModel(n = 4, count = 60, seed = 3) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const seen = new Set();
  const terms = [];
  while (terms.length < count) {
    let xmask = 0;
    let zmask = 0;
    for (let q = 0; q < n; q++) {
      const p = Math.floor(rng() * 4); // I, X, Y, Z
      if (p === 1 || p === 2) xmask |= 1 << q;
      if (p === 2 || p === 3) zmask |= 1 << q;
    }
    const key = `${xmask},${zmask}`;
    if ((!xmask && !zmask) || seen.has(key)) continue;
    seen.add(key);
    const k = terms.length + 1;
    terms.push({ xmask, zmask, coeff: ((rng() < 0.5 ? -1 : 1) * 1) / (k * k) });
  }
  return terms;
}

// One sampled qDRIFT run on a statevector (for checking the exact channel): N random rotations.
export function qdriftSample({ terms, n, start, t, N }, rng) {
  const live = terms.filter((x) => x.xmask || x.zmask);
  const lambda = live.reduce((s, x) => s + Math.abs(x.coeff), 0);
  const re = new Float64Array(1 << n);
  const im = new Float64Array(1 << n);
  re[start] = 1;
  for (let k = 0; k < N; k++) {
    let u = rng() * lambda;
    let j = 0;
    while (j < live.length - 1 && u >= Math.abs(live[j].coeff)) u -= Math.abs(live[j++].coeff);
    // e^{−iτ sign P} as a one-term Trotter step of length τ with coefficient sign(h)
    trotterStep([{ ...live[j], coeff: Math.sign(live[j].coeff) }], re, im, (lambda * t) / N, 1);
  }
  return { re, im };
}
