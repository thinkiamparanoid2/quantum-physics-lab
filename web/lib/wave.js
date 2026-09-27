// One-dimensional wave mechanics in units where hbar = m = 1, so the Schrodinger equation
// reads  -1/2 psi'' + V psi = E psi.  A grid has n interior points x_i = xmin + (i + 1) dx with
// dx = (xmax - xmin) / (n + 1), so hard walls sit exactly at xmin and xmax.
//
//   eigenstates   finite-difference Hamiltonian, Sturm-sequence bisection + inverse iteration
//   Propagator    split-operator time evolution (FFT), optional absorbing edges
//   shoot         Numerov integration from the left for a trial energy (the shooting method)
//   transmission  transmission/reflection probability through any potential that is 0 at both ends

import { fft } from './fft.js';

export function makeGrid(n, xmin, xmax) {
  const dx = (xmax - xmin) / (n + 1);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = xmin + (i + 1) * dx;
  const k = new Float64Array(n);
  const dk = (2 * Math.PI) / (n * dx);
  for (let j = 0; j < n; j++) k[j] = (j < n / 2 ? j : j - n) * dk;
  return { n, xmin, xmax, dx, x, k, dk };
}

export function potentialFrom(grid, f) {
  return Float64Array.from(grid.x, f);
}

// ----- stationary states -----

// Number of eigenvalues of the tridiagonal matrix (diagonal d, constant off-diagonal e) below lam.
function sturmCount(d, e, lam) {
  let count = 0;
  let q = d[0] - lam;
  if (q < 0) count++;
  const e2 = e * e;
  for (let i = 1; i < d.length; i++) {
    q = d[i] - lam - e2 / (q === 0 ? 1e-300 : q);
    if (q < 0) count++;
  }
  return count;
}

// Solve (T - mu I) y = b for the tridiagonal T (Thomas algorithm).
function solveShifted(d, e, mu, b) {
  const n = d.length;
  const c = new Float64Array(n);
  const y = new Float64Array(n);
  let beta = d[0] - mu || 1e-300;
  y[0] = b[0] / beta;
  for (let i = 1; i < n; i++) {
    c[i] = e / beta;
    beta = d[i] - mu - e * c[i] || 1e-300;
    y[i] = (b[i] - e * y[i - 1]) / beta;
  }
  for (let i = n - 2; i >= 0; i--) y[i] -= c[i + 1] * y[i + 1];
  return y;
}

// Lowest `count` energies and normalised real wavefunctions (sum psi^2 dx = 1), with hard
// walls at the ends of the grid (xmin and xmax). Each state is made positive where it first becomes significant.
export function eigenstates(V, dx, count) {
  const n = V.length;
  const e = -1 / (2 * dx * dx);
  const d = Float64Array.from(V, (v) => v + 1 / (dx * dx));
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of d) {
    lo = Math.min(lo, v - 2 * Math.abs(e));
    hi = Math.max(hi, v + 2 * Math.abs(e));
  }
  const states = [];
  for (let k = 0; k < Math.min(count, n); k++) {
    let a = lo;
    let b = hi;
    for (let it = 0; it < 100 && b - a > 1e-13 * Math.max(1, Math.abs(b)); it++) {
      const m = (a + b) / 2;
      if (sturmCount(d, e, m) > k) b = m;
      else a = m;
    }
    const E = (a + b) / 2;
    let psi = Float64Array.from({ length: n }, (_, i) => 1 + 0.01 * Math.sin(i * 0.37 + k));
    const mu = E + 1e-9 * Math.max(1, Math.abs(E));
    for (let it = 0; it < 4; it++) {
      psi = solveShifted(d, e, mu, psi);
      let norm = 0;
      for (const v of psi) norm += v * v;
      norm = Math.sqrt(norm * dx);
      for (let i = 0; i < n; i++) psi[i] /= norm;
    }
    const peak = Math.max(...psi.map(Math.abs));
    const first = psi.findIndex((v) => Math.abs(v) > 0.01 * peak);
    if (psi[first] < 0) for (let i = 0; i < n; i++) psi[i] = -psi[i];
    states.push({ E, psi });
  }
  return states;
}

// ----- wave packets and observables -----

export function gaussianPacket(grid, { x0, sigma, k0 }) {
  const re = new Float64Array(grid.n);
  const im = new Float64Array(grid.n);
  const a = (2 * Math.PI * sigma * sigma) ** -0.25;
  for (let i = 0; i < grid.n; i++) {
    const u = grid.x[i] - x0;
    const env = a * Math.exp(-(u * u) / (4 * sigma * sigma));
    re[i] = env * Math.cos(k0 * grid.x[i]);
    im[i] = env * Math.sin(k0 * grid.x[i]);
  }
  return { re, im };
}

export function norm(psi, dx) {
  let s = 0;
  for (let i = 0; i < psi.re.length; i++) s += psi.re[i] ** 2 + psi.im[i] ** 2;
  return s * dx;
}

export function normalize(psi, dx) {
  const s = Math.sqrt(norm(psi, dx));
  for (let i = 0; i < psi.re.length; i++) {
    psi.re[i] /= s;
    psi.im[i] /= s;
  }
  return psi;
}

// Mean and spread of x, from the probability density.
export function positionStats(grid, psi) {
  let p = 0;
  let m1 = 0;
  let m2 = 0;
  for (let i = 0; i < grid.n; i++) {
    const w = (psi.re[i] ** 2 + psi.im[i] ** 2) * grid.dx;
    p += w;
    m1 += w * grid.x[i];
    m2 += w * grid.x[i] ** 2;
  }
  const mean = m1 / p;
  return { mean, spread: Math.sqrt(Math.max(0, m2 / p - mean * mean)), total: p };
}

// Momentum-space probability density over the FFT's k grid (sorted from negative to positive).
export function momentumDistribution(grid, psi) {
  const re = Float64Array.from(psi.re);
  const im = Float64Array.from(psi.im);
  fft(re, im);
  const order = Array.from({ length: grid.n }, (_, j) => j).sort((a, b) => grid.k[a] - grid.k[b]);
  const k = Float64Array.from(order, (j) => grid.k[j]);
  const prob = Float64Array.from(order, (j) => re[j] ** 2 + im[j] ** 2);
  let total = 0;
  for (const v of prob) total += v * grid.dk;
  for (let i = 0; i < prob.length; i++) prob[i] /= total;
  let m1 = 0;
  let m2 = 0;
  for (let i = 0; i < prob.length; i++) {
    m1 += prob[i] * k[i] * grid.dk;
    m2 += prob[i] * k[i] ** 2 * grid.dk;
  }
  return { k, prob, mean: m1, spread: Math.sqrt(Math.max(0, m2 - m1 * m1)) };
}

// psi(x, t) = sum_n c_n psi_n(x) e^{-i E_n t} for real eigenstates and complex coefficients.
export function superpose(states, coeffs, t = 0) {
  const n = states[0].psi.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  states.forEach(({ E, psi }, j) => {
    const [cr, ci] = coeffs[j] ?? [0, 0];
    if (cr === 0 && ci === 0) return;
    const c = Math.cos(E * t);
    const s = -Math.sin(E * t);
    const ar = cr * c - ci * s;
    const ai = cr * s + ci * c;
    for (let i = 0; i < n; i++) {
      re[i] += ar * psi[i];
      im[i] += ai * psi[i];
    }
  });
  return { re, im };
}

// Coefficients c_n = <psi_n | psi> of any wavefunction in a basis of real eigenstates.
export function project(states, psi, dx) {
  return states.map(({ psi: phi }) => {
    let r = 0;
    let i = 0;
    for (let j = 0; j < phi.length; j++) {
      r += phi[j] * psi.re[j];
      i += phi[j] * psi.im[j];
    }
    return [r * dx, i * dx];
  });
}

// ----- time evolution -----

// Split-operator: e^{-iV dt/2} e^{-iT dt} e^{-iV dt/2}, with T applied in momentum space.
// `absorb` > 0 adds a smooth damping mask over that width at each edge, so waves leaving the
// grid disappear instead of wrapping around.
export class Propagator {
  constructor(grid, V, dt, { absorb = 0 } = {}) {
    this.grid = grid;
    this.dt = dt;
    const n = grid.n;
    this.vr = Float64Array.from(V, (v) => Math.cos((-v * dt) / 2));
    this.vi = Float64Array.from(V, (v) => Math.sin((-v * dt) / 2));
    this.tr = Float64Array.from(grid.k, (k) => Math.cos((-k * k * dt) / 2));
    this.ti = Float64Array.from(grid.k, (k) => Math.sin((-k * k * dt) / 2));
    this.mask = null;
    if (absorb > 0) {
      this.mask = new Float64Array(n).fill(1);
      for (let i = 0; i < n; i++) {
        const edge = Math.min(grid.x[i] - grid.xmin, grid.xmax - grid.x[i]);
        if (edge < absorb) this.mask[i] = Math.cos((Math.PI / 2) * (1 - edge / absorb)) ** 0.125;
      }
    }
  }

  step(psi, steps = 1) {
    const { re, im } = psi;
    const n = re.length;
    const mulV = () => {
      for (let i = 0; i < n; i++) {
        const r = re[i] * this.vr[i] - im[i] * this.vi[i];
        im[i] = re[i] * this.vi[i] + im[i] * this.vr[i];
        re[i] = r;
      }
    };
    for (let s = 0; s < steps; s++) {
      mulV();
      fft(re, im);
      for (let j = 0; j < n; j++) {
        const r = re[j] * this.tr[j] - im[j] * this.ti[j];
        im[j] = re[j] * this.ti[j] + im[j] * this.tr[j];
        re[j] = r;
      }
      fft(re, im, true);
      mulV();
      if (this.mask) {
        for (let i = 0; i < n; i++) {
          re[i] *= this.mask[i];
          im[i] *= this.mask[i];
        }
      }
    }
    return psi;
  }
}

// ----- shooting method -----

// Integrate psi'' = 2 (V - E) psi with Numerov's method, starting from psi = 0 at the left wall
// (xmin, one step before the first grid point). Returns the unnormalised, rescaled solution on
// the grid, its value `wall` one more step on at the right wall (xmax), and its number of sign
// changes up to and including the right wall.
export function shoot(V, dx, E) {
  const n = V.length;
  const psi = new Float64Array(n);
  const h2 = (dx * dx) / 12;
  const f = (i) => 2 * (V[Math.min(n - 1, Math.max(0, i))] - E);
  psi[0] = 1e-6;
  psi[1] = (2 * psi[0] * (1 + 5 * h2 * f(0))) / (1 - h2 * f(1));
  let nodes = psi[1] * psi[0] < 0 ? 1 : 0;
  for (let i = 1; i < n - 1; i++) {
    psi[i + 1] = (2 * psi[i] * (1 + 5 * h2 * f(i)) - psi[i - 1] * (1 - h2 * f(i - 1))) / (1 - h2 * f(i + 1));
    if (Math.abs(psi[i + 1]) > 1e150) {
      for (let j = 0; j <= i + 1; j++) psi[j] *= 1e-150;
    }
    if (psi[i + 1] * psi[i] < 0) nodes++;
  }
  const wall = (2 * psi[n - 1] * (1 + 5 * h2 * f(n - 1)) - psi[n - 2] * (1 - h2 * f(n - 2))) / (1 - h2 * f(n));
  if (wall * psi[n - 1] < 0) nodes++;
  return { psi, nodes, wall };
}

// The k-th bound-state energy (k = 0 is the ground state), by bisection. Oscillation theorem:
// the shooting solution's number of sign changes equals the number of levels below E.
export function shootLevel(V, dx, k, lo, hi) {
  let a = lo;
  let b = hi;
  for (let it = 0; it < 80; it++) {
    const m = (a + b) / 2;
    if (shoot(V, dx, m).nodes > k) b = m;
    else a = m;
  }
  return (a + b) / 2;
}

// ----- scattering -----

// Transmission and reflection probabilities at energy E for a potential on the grid that is 0
// at both ends. Start from a purely transmitted wave e^{ikx} on the right, integrate the
// Schrodinger equation leftwards (Numerov) and split the result into incoming + reflected waves.
export function transmission(V, dx, E) {
  const n = V.length;
  const k = Math.sqrt(2 * E);
  const h2 = (dx * dx) / 12;
  const f = (i) => 2 * (V[i] - E);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const x = (i) => i * dx;
  re[n - 1] = Math.cos(k * x(n - 1));
  im[n - 1] = Math.sin(k * x(n - 1));
  re[n - 2] = Math.cos(k * x(n - 2));
  im[n - 2] = Math.sin(k * x(n - 2));
  for (let i = n - 2; i > 0; i--) {
    const a = 2 * (1 + 5 * h2 * f(i));
    const b = 1 - h2 * f(i + 1);
    const c = 1 - h2 * f(i - 1);
    re[i - 1] = (a * re[i] - b * re[i + 1]) / c;
    im[i - 1] = (a * im[i] - b * im[i + 1]) / c;
  }
  // psi = A e^{ikx} + B e^{-ikx} at points 0 and 1 (both in the free region on the left).
  const e = (i, s) => [Math.cos(s * k * x(i)), Math.sin(s * k * x(i))];
  const [p0r, p0i] = e(0, 1);
  const [m0r, m0i] = e(0, -1);
  const [p1r, p1i] = e(1, 1);
  const [m1r, m1i] = e(1, -1);
  // Solve [[p0, m0], [p1, m1]] [A, B]^T = [psi0, psi1] with complex arithmetic.
  const mul = (ar, ai, br, bi) => [ar * br - ai * bi, ar * bi + ai * br];
  const [dr1, di1] = mul(p0r, p0i, m1r, m1i);
  const [dr2, di2] = mul(m0r, m0i, p1r, p1i);
  const detr = dr1 - dr2;
  const deti = di1 - di2;
  const [n1r, n1i] = mul(re[0], im[0], m1r, m1i);
  const [n2r, n2i] = mul(m0r, m0i, re[1], im[1]);
  const numr = n1r - n2r;
  const numi = n1i - n2i;
  const dd = detr * detr + deti * deti;
  const Ar = (numr * detr + numi * deti) / dd;
  const Ai = (numi * detr - numr * deti) / dd;
  const [q1r, q1i] = mul(p0r, p0i, re[1], im[1]);
  const [q2r, q2i] = mul(re[0], im[0], p1r, p1i);
  const Br = ((q1r - q2r) * detr + (q1i - q2i) * deti) / dd;
  const Bi = ((q1i - q2i) * detr - (q1r - q2r) * deti) / dd;
  const A2 = Ar * Ar + Ai * Ai;
  return { T: 1 / A2, R: (Br * Br + Bi * Bi) / A2 };
}

// Exact transmission through a rectangular barrier of height V0 and width a (for tests and labels).
export function barrierTransmission(E, V0, a) {
  if (Math.abs(E - V0) < 1e-12) return 1 / (1 + (V0 * a * a) / 2);
  if (E < V0) {
    const kappa = Math.sqrt(2 * (V0 - E));
    return 1 / (1 + (V0 * V0 * Math.sinh(kappa * a) ** 2) / (4 * E * (V0 - E)));
  }
  const q = Math.sqrt(2 * (E - V0));
  return 1 / (1 + (V0 * V0 * Math.sin(q * a) ** 2) / (4 * E * (E - V0)));
}
