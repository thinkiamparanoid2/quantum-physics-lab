// The lattice Schwinger model (1+1D QED) with staggered fermions, the gauge field eliminated by
// Gauss's law, and optional static external charges. Sites 0 … N−1 (qubit n = site n):
//
//   H = x Σ_n (X_n X_{n+1} + Y_n Y_{n+1})/2 − (m/2) Σ_n (−1)^n Z_n + g Σ_n L_n²
//   L_n = ε₀ + Σ_{k≤n} [ q_k + Q_k ],  q_k = −(Z_k − (−1)^k)/2 (dynamical), Q_k external
//
// Martinez et al. (Nature 534, 516, 2016) with sites renumbered from 0. Even sites hold
// particles, odd sites antiparticles; the bare vacuum |0101…⟩ has no particles and no flux.
// The same Hamiltonian as modules/schwinger_model/hamiltonian.py and the playground preset.

import { evolveExact, makeOperator, trotterStep } from './dynamics.js';
import { lanczosGround, zExpectations } from './manybody.js';

export function schwingerModel(N, opts = {}) {
  const { terms, linkConstants } = schwingerTerms(N, opts);
  let vacuum = 0;
  for (let n = 1; n < N; n += 2) vacuum |= 1 << n;
  return { N, terms, op: makeOperator(terms, N), linkConstants, vacuum };
}

// The Pauli terms alone (no 2^N operator), so gate counts can be made for long chains.
export function schwingerTerms(N, { x = 1, mass = 0.5, g = 0.6, background = 0, charges = [] } = {}) {
  const terms = new Map();
  const add = (xmask, zmask, c) => {
    const k = `${xmask},${zmask}`;
    terms.set(k, { xmask, zmask, coeff: (terms.get(k)?.coeff ?? 0) + c });
  };
  for (let n = 0; n + 1 < N; n++) {
    const xm = (1 << n) | (1 << (n + 1));
    add(xm, 0, x / 2); // X X
    add(xm, xm, x / 2); // Y Y (a Y sets both masks; lib/dynamics.js supplies its phase)
  }
  for (let n = 0; n < N; n++) add(0, 1 << n, (-mass / 2) * (n % 2 ? -1 : 1));
  // L_n = c_n − ½ Σ_{k≤n} Z_k with c_n = ε₀ + Σ_{k≤n} ((−1)^k/2 + Q_k)
  const links = [];
  let c = background;
  for (let n = 0; n + 1 < N; n++) {
    c += (n % 2 ? -0.5 : 0.5) + (charges[n] ?? 0);
    links.push(c);
    // L² = c² − c Σ Z_k + ¼ (n + 1) + ½ Σ_{j<k≤n} Z_j Z_k
    add(0, 0, g * (c * c + 0.25 * (n + 1)));
    for (let k = 0; k <= n; k++) add(0, 1 << k, -g * c);
    for (let j = 0; j <= n; j++) for (let k = j + 1; k <= n; k++) add(0, (1 << j) | (1 << k), g * 0.5);
  }
  return { terms: [...terms.values()].filter((t) => Math.abs(t.coeff) > 1e-14), linkConstants: links };
}

// Observables from ⟨Z_k⟩: particles per site, and the electric field on each link.
export function observables(model, z) {
  const N = model.N;
  const particles = Array.from({ length: N }, (_, n) => (n % 2 ? (1 + z[n]) / 2 : (1 - z[n]) / 2));
  const field = [];
  let sumZ = 0;
  for (let n = 0; n + 1 < N; n++) {
    sumZ += z[n];
    field.push(model.linkConstants[n] - sumZ / 2);
  }
  return { particles, total: particles.reduce((a, b) => a + b, 0), field };
}

// External charges +Q at site a and −Q at site b = a + ℓ, centred on the chain: a flux string ℓ
// links long. a is even and ℓ odd, so an antiparticle can sit just right of +Q (odd site a + 1)
// and a particle just left of −Q (even site b − 1): a pair made from the vacuum can screen both.
export function chargePair(N, length, Q = 1) {
  const ell = length % 2 ? length : length + 1;
  let a = Math.floor((N - 1 - ell) / 2);
  if (a % 2) a -= 1;
  a = Math.max(0, a);
  const charges = new Array(N).fill(0);
  charges[a] += Q;
  charges[a + ell] -= Q;
  return { charges, a, b: a + ell, length: ell };
}

// Ground states with a charge pair at every odd separation, for the string-breaking lesson (runs
// in a Web Worker): energy and particle number relative to the vacuum, plus the field and particle
// profiles.
export function stringPotential({ N, x, mass, g }, progress) {
  const lengths = [];
  for (let l = 1; l <= N - 3; l += 2) lengths.push(l);
  const base = schwingerModel(N, { x, mass, g });
  const r0 = lanczosGround(base.op, base.vacuum);
  const o0 = observables(base, zExpectations(N, r0.vector));
  const out = [{ length: 0, energy: 0, extra: 0, ...o0, a: -1, b: -1 }];
  lengths.forEach((l, i) => {
    const cp = chargePair(N, l);
    const m = schwingerModel(N, { x, mass, g, charges: cp.charges });
    const r = lanczosGround(m.op, m.vacuum);
    const o = observables(m, zExpectations(N, r.vector));
    out.push({ length: l, energy: r.energy - r0.energy, extra: o.total - o0.total, ...o, a: cp.a, b: cp.b });
    progress?.((i + 1) / lengths.length);
  });
  return out;
}

// Trotter error after time T, starting from the bare vacuum: infidelity with the exact state and
// the error in the particle number, for each number of steps and order 1 or 2.
export function trotterStudy({ N, x = 1, mass = 0.5, g = 0.6, T, stepsList }) {
  const model = schwingerModel(N, { x, mass, g });
  const dim = 1 << N;
  const er = new Float64Array(dim);
  const ei = new Float64Array(dim);
  er[model.vacuum] = 1;
  evolveExact(model.op, er, ei, T);
  const exactN = observables(model, zExpectations(N, er, ei)).total;
  const out = {};
  for (const order of [1, 2]) {
    out[order] = stepsList.map((steps) => {
      const re = new Float64Array(dim);
      const im = new Float64Array(dim);
      re[model.vacuum] = 1;
      for (let k = 0; k < steps; k++) trotterStep(model.terms, re, im, T / steps, order);
      let or = 0;
      let oi = 0;
      for (let b = 0; b < dim; b++) {
        or += er[b] * re[b] + ei[b] * im[b];
        oi += er[b] * im[b] - ei[b] * re[b];
      }
      const n = observables(model, zExpectations(N, re, im)).total;
      return { steps, infidelity: Math.max(0, 1 - (or * or + oi * oi)), particleError: Math.abs(n - exactN) };
    });
  }
  return out;
}
