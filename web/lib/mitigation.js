// Error mitigation on a small noisy circuit, simulated with density matrices: readout-error
// mitigation (inverting the confusion matrix) and zero-noise extrapolation (ZNE) by gate folding.
//
// Density matrices on n qubits are { re, im } of size 2^n × 2^n, qubit q = bit q of the index.

// 2 × 2 complex gate as [[a, b], [c, d]] with entries [re, im]
const rx = (t) => [
  [
    [Math.cos(t / 2), 0],
    [0, -Math.sin(t / 2)],
  ],
  [
    [0, -Math.sin(t / 2)],
    [Math.cos(t / 2), 0],
  ],
];
const rz = (t) => [
  [
    [Math.cos(t / 2), -Math.sin(t / 2)],
    [0, 0],
  ],
  [
    [0, 0],
    [Math.cos(t / 2), Math.sin(t / 2)],
  ],
];
const X = [
  [
    [0, 0],
    [1, 0],
  ],
  [
    [1, 0],
    [0, 0],
  ],
];
const Y = [
  [
    [0, 0],
    [0, -1],
  ],
  [
    [0, 1],
    [0, 0],
  ],
];
const Z = [
  [
    [1, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [-1, 0],
  ],
];

export function pureDensity(n, b) {
  const d = 1 << n;
  const re = new Float64Array(d * d);
  re[b * d + b] = 1;
  return { n, d, re, im: new Float64Array(d * d) };
}

// ρ → (G on q, controlled on `controls`) ρ (…)†
function applyGate(rho, q, G, controls = []) {
  const { d } = rho;
  const cmask = controls.reduce((m, c) => m | (1 << c), 0);
  const bit = 1 << q;
  const left = (re, im) => {
    // rows: for each column k, act on the row index
    for (let k = 0; k < d; k++) {
      for (let a = 0; a < d; a++) {
        if (a & bit || (a & cmask) !== cmask) continue;
        const a1 = a | bit;
        const [x0r, x0i, x1r, x1i] = [re[a * d + k], im[a * d + k], re[a1 * d + k], im[a1 * d + k]];
        const m = (i, j, xr, xi) => [G[i][j][0] * xr - G[i][j][1] * xi, G[i][j][0] * xi + G[i][j][1] * xr];
        const [p, pi] = m(0, 0, x0r, x0i);
        const [q2, qi] = m(0, 1, x1r, x1i);
        const [r, ri] = m(1, 0, x0r, x0i);
        const [s, si] = m(1, 1, x1r, x1i);
        re[a * d + k] = p + q2;
        im[a * d + k] = pi + qi;
        re[a1 * d + k] = r + s;
        im[a1 * d + k] = ri + si;
      }
    }
  };
  left(rho.re, rho.im);
  // columns: ρ G† = (G ρ†)† and ρ is Hermitian, so apply G to the rows of the transpose-conjugate
  const t = { re: new Float64Array(d * d), im: new Float64Array(d * d) };
  for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) [t.re[j * d + i], t.im[j * d + i]] = [rho.re[i * d + j], -rho.im[i * d + j]];
  left(t.re, t.im);
  for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) [rho.re[i * d + j], rho.im[i * d + j]] = [t.re[j * d + i], -t.im[j * d + i]];
}

// Single-qubit depolarizing channel on qubit q with probability p: ρ → (1 − p)ρ + (p/3)(XρX + YρY + ZρZ).
function depolarize(rho, q, p) {
  if (!p) return;
  const parts = [X, Y, Z].map((P) => {
    const c = { ...rho, re: Float64Array.from(rho.re), im: Float64Array.from(rho.im) };
    applyGate(c, q, P);
    return c;
  });
  for (let i = 0; i < rho.re.length; i++) {
    rho.re[i] = (1 - p) * rho.re[i] + (p / 3) * (parts[0].re[i] + parts[1].re[i] + parts[2].re[i]);
    rho.im[i] = (1 - p) * rho.im[i] + (p / 3) * (parts[0].im[i] + parts[1].im[i] + parts[2].im[i]);
  }
}

// Whole-register depolarizing: ρ → (1 − p)ρ + p I/d (used to check that exponential ZNE is exact).
function depolarizeAll(rho, p) {
  if (!p) return;
  for (let i = 0; i < rho.d; i++) {
    for (let j = 0; j < rho.d; j++) {
      rho.re[i * rho.d + j] = (1 - p) * rho.re[i * rho.d + j] + (i === j ? p / rho.d : 0);
      rho.im[i * rho.d + j] *= 1 - p;
    }
  }
}

// The test circuit: r Trotter steps of a 3-qubit transverse-field Ising chain from |000⟩, as a list
// of { gate: 'RX' | 'RZ', target, angle } and { gate: 'CNOT', control, target }.
export function isingCircuit({ n = 3, steps = 3, J = 1, h = 1, dt = 0.35 }) {
  const ops = [];
  for (let s = 0; s < steps; s++) {
    for (let q = 0; q < n; q++) ops.push({ gate: 'RX', target: q, angle: 2 * h * dt });
    for (let q = 0; q + 1 < n; q++) {
      ops.push({ gate: 'CNOT', control: q, target: q + 1 });
      ops.push({ gate: 'RZ', target: q + 1, angle: -2 * J * dt });
      ops.push({ gate: 'CNOT', control: q, target: q + 1 });
    }
  }
  return ops;
}

// Local folding: every gate G becomes G (G† G)^k, scaling the noise by λ = 2k + 1.
export function fold(ops, k) {
  const out = [];
  for (const op of ops) {
    out.push(op);
    for (let i = 0; i < k; i++) {
      const inv = op.gate === 'CNOT' ? op : { ...op, angle: -op.angle };
      out.push(inv, op);
    }
  }
  return out;
}

// Run with noise after every gate: p1 on the single-qubit gate's qubit, p2 on both CNOT qubits, or a
// global depolarizing channel of probability pg after every gate.
export function runNoisy(n, ops, { p1 = 0, p2 = 0, pg = 0 } = {}) {
  const rho = pureDensity(n, 0);
  for (const op of ops) {
    if (op.gate === 'CNOT') {
      applyGate(rho, op.target, X, [op.control]);
      depolarize(rho, op.control, p2);
      depolarize(rho, op.target, p2);
    } else {
      applyGate(rho, op.target, op.gate === 'RX' ? rx(op.angle) : rz(op.angle));
      depolarize(rho, op.target, p1);
    }
    depolarizeAll(rho, pg);
  }
  return rho;
}

export const probsOf = (rho) => Array.from({ length: rho.d }, (_, b) => rho.re[b * rho.d + b]);

// Independent readout errors: P(read 1 | 0) = e0, P(read 0 | 1) = e1 on every qubit.
export function applyReadout(probs, n, e0, e1) {
  let p = probs.slice();
  for (let q = 0; q < n; q++) {
    const out = new Array(p.length).fill(0);
    for (let b = 0; b < p.length; b++) {
      const one = (b >> q) & 1;
      const stay = one ? 1 - e1 : 1 - e0;
      out[b] += stay * p[b];
      out[b ^ (1 << q)] += (1 - stay) * p[b];
    }
    p = out;
  }
  return p;
}

// Readout mitigation: invert the per-qubit 2 × 2 confusion matrices (as calibrated on |0⟩ and |1⟩).
export function mitigateReadout(probs, n, e0, e1) {
  const det = 1 - e0 - e1;
  let p = probs.slice();
  for (let q = 0; q < n; q++) {
    const out = new Array(p.length).fill(0);
    for (let b = 0; b < p.length; b++) {
      if ((b >> q) & 1) continue;
      const b1 = b | (1 << q);
      // [p0; p1]_measured = [[1−e0, e1], [e0, 1−e1]] [p0; p1]_true
      out[b] = ((1 - e1) * p[b] - e1 * p[b1]) / det;
      out[b1] = (-e0 * p[b] + (1 - e0) * p[b1]) / det;
    }
    p = out;
  }
  return p;
}

// ⟨Z_a Z_b⟩ from probabilities.
export const zz = (probs, a, b) => probs.reduce((s, p, x) => s + (((x >> a) ^ (x >> b)) & 1 ? -p : p), 0);

// Extrapolations to zero noise from values y at scales λ.
export function richardson(lams, ys) {
  // the polynomial through all points, evaluated at 0 (Lagrange)
  return lams.reduce((s, li, i) => s + ys[i] * lams.reduce((pr, lj, j) => (j === i ? pr : (pr * lj) / (lj - li)), 1), 0);
}
// y = a e^{bλ}: least squares on log|y| (same sign assumed). Returns { a, b }.
export function exponentialParams(lams, ys) {
  const sign = Math.sign(ys[0]) || 1;
  const ls = ys.map((y) => Math.log(Math.max(1e-12, sign * y)));
  const n = lams.length;
  const mx = lams.reduce((a, b) => a + b, 0) / n;
  const my = ls.reduce((a, b) => a + b, 0) / n;
  const slope = lams.reduce((s, x, i) => s + (x - mx) * (ls[i] - my), 0) / lams.reduce((s, x) => s + (x - mx) ** 2, 0);
  return { a: sign * Math.exp(my - slope * mx), b: slope };
}
export const exponentialFit = (lams, ys) => exponentialParams(lams, ys).a;
