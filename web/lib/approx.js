// Many particles and approximation methods, in units hbar = m = 1:
//   Kronig-Penney bands, two identical particles, perturbation theory, the variational method
//   and the WKB approximation. Numerical checks use the exact solver in lib/wave.js.

// ----- periodic potentials -----

// Kronig-Penney: wells of width a (V = 0) separated by barriers of width b and height V0, period
// a + b. A Bloch wave with crystal momentum k exists at energy E iff |f(E)| <= 1, where
// f(E) = cos(ka + kb) is given by the transfer-matrix condition below.
export function kronigPenney(E, { V0, a, b }) {
  const al = Math.sqrt(2 * E);
  if (E < V0) {
    const be = Math.sqrt(2 * (V0 - E));
    return Math.cos(al * a) * Math.cosh(be * b) + ((be * be - al * al) / (2 * al * be)) * Math.sin(al * a) * Math.sinh(be * b);
  }
  if (E === V0) return Math.cos(al * a) - (al * b / 2) * Math.sin(al * a);
  const q = Math.sqrt(2 * (E - V0));
  return Math.cos(al * a) * Math.cos(q * b) - ((q * q + al * al) / (2 * al * q)) * Math.sin(al * a) * Math.sin(q * b);
}

// Allowed energy bands [lo, hi] up to Emax, found by scanning where |f| <= 1 and refining edges.
export function kpBands(params, Emax, steps = 4000) {
  const bands = [];
  const ok = (E) => Math.abs(kronigPenney(E, params)) <= 1;
  const edge = (lo, hi) => {
    // ok(lo) != ok(hi); bisect
    const want = ok(lo);
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      if (ok(m) === want) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };
  let prevE = 1e-9;
  let prevOk = ok(prevE);
  let start = prevOk ? prevE : null;
  for (let i = 1; i <= steps; i++) {
    const E = (i / steps) * Emax;
    const cur = ok(E);
    if (cur !== prevOk) {
      const x = edge(prevE, E);
      if (cur) start = x;
      else {
        bands.push([start, x]);
        start = null;
      }
    }
    prevE = E;
    prevOk = cur;
  }
  if (start !== null) bands.push([start, Emax]);
  return bands;
}

// ----- identical particles -----

// Two particles in a box [0, L], one in level n1 and one in level n2 (1-based). Returns the
// two-particle probability density on a grid for 'distinguishable' (particle 1 in n1),
// 'bosons' (symmetric) or 'fermions' (antisymmetric).
export function boxPairDensity(n1, n2, kind, L, N) {
  const phi = (n, x) => Math.sqrt(2 / L) * Math.sin((n * Math.PI * x) / L);
  const out = new Float64Array(N * N);
  const same = n1 === n2;
  for (let i = 0; i < N; i++) {
    const x1 = ((i + 0.5) / N) * L;
    for (let j = 0; j < N; j++) {
      const x2 = ((j + 0.5) / N) * L;
      const a = phi(n1, x1) * phi(n2, x2);
      const b = phi(n2, x1) * phi(n1, x2);
      let psi;
      if (kind === 'distinguishable') psi = a;
      else if (kind === 'bosons') psi = same ? a : (a + b) / Math.SQRT2;
      else psi = same ? 0 : (a - b) / Math.SQRT2;
      out[i * N + j] = psi * psi;
    }
  }
  return out;
}

// Mean squared separation <(x1 - x2)^2> in the box for the three cases (analytic sums on a grid).
export function meanSquaredSeparation(n1, n2, kind, L = 1, N = 400) {
  const d = boxPairDensity(n1, n2, kind, L, N);
  let s = 0;
  let norm = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x1 = ((i + 0.5) / N) * L;
      const x2 = ((j + 0.5) / N) * L;
      s += d[i * N + j] * (x1 - x2) ** 2;
      norm += d[i * N + j];
    }
  }
  return norm > 0 ? s / norm : NaN;
}

// ----- perturbation theory -----

// Matrix element <m|W|n> for real states on a grid.
export function matrixElement(states, W, dx, m, n) {
  let s = 0;
  const a = states[m].psi;
  const b = states[n].psi;
  for (let i = 0; i < a.length; i++) s += a[i] * W[i] * b[i];
  return s * dx;
}

// Energy of level n of H0 + lambda W to first and second order.
export function perturbed(states, W, dx, n, lambda) {
  const E0 = states[n].E;
  const first = matrixElement(states, W, dx, n, n);
  let second = 0;
  for (let m = 0; m < states.length; m++) {
    if (m === n) continue;
    second += matrixElement(states, W, dx, m, n) ** 2 / (E0 - states[m].E);
  }
  return { E0, first, second, order1: E0 + lambda * first, order2: E0 + lambda * first + lambda * lambda * second };
}

// ----- variational method -----

// Energy <H> of the normalised Gaussian trial psi = (2 pi s^2)^(-1/4) exp(-(x - c)^2 / (4 s^2)), where
// s is the standard deviation of |psi|^2. Kinetic energy 1/(8 s^2); potential by quadrature.
export function gaussianTrialEnergy(V, s, c = 0, range = [-12, 12], n = 4000) {
  const [x0, x1] = range;
  const dx = (x1 - x0) / n;
  let pot = 0;
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * dx;
    const p = Math.exp(-((x - c) ** 2) / (2 * s * s)) / Math.sqrt(2 * Math.PI * s * s);
    pot += p * V(x) * dx;
  }
  return 1 / (8 * s * s) + pot;
}

// Golden-section search for the best width.
export function bestGaussian(V, lo = 0.05, hi = 5, c = 0) {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  for (let i = 0; i < 80; i++) {
    const x1 = b - g * (b - a);
    const x2 = a + g * (b - a);
    if (gaussianTrialEnergy(V, x1, c) < gaussianTrialEnergy(V, x2, c)) b = x2;
    else a = x1;
  }
  const s = (a + b) / 2;
  return { s, E: gaussianTrialEnergy(V, s, c) };
}

// ----- WKB -----

// Classical action integral of sqrt(2 (E - V)) over the allowed region(s), and the turning points.
export function action(V, E, range = [-20, 20], n = 20000) {
  const [x0, x1] = range;
  const dx = (x1 - x0) / n;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const v = V(x0 + (i + 0.5) * dx);
    if (v < E) s += Math.sqrt(2 * (E - v)) * dx;
  }
  return s;
}

// WKB energy of level n: integral p dx = (n + mu) pi, with mu = 1/2 for two smooth turning points,
// 1 for two hard walls, 3/4 for one of each.
export function wkbLevel(V, n, { mu = 0.5, range, Emax = 200 } = {}) {
  const target = (n + mu) * Math.PI;
  let lo = -1e3;
  let hi = Emax;
  // find a lower bound where the action is zero
  lo = Math.min(...sampleMin(V, range));
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (action(V, m, range) < target) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

function sampleMin(V, range = [-20, 20]) {
  let m = Infinity;
  for (let i = 0; i <= 2000; i++) m = Math.min(m, V(range[0] + ((range[1] - range[0]) * i) / 2000));
  return [m];
}

// WKB tunnelling estimate T ~ exp(-2 integral kappa dx) under a barrier.
export function wkbTransmission(V, E, range = [-20, 20], n = 20000) {
  const [x0, x1] = range;
  const dx = (x1 - x0) / n;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const v = V(x0 + (i + 0.5) * dx);
    if (v > E) s += Math.sqrt(2 * (v - E)) * dx;
  }
  return Math.exp(-2 * s);
}
