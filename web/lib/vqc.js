// Variational quantum circuits on the statevector engine: circuits with trainable parameters and
// data inputs, exact parameter-shift gradients, Adam, and the specific models used by the QML
// lessons. Every model here is written gate by gate in web/tests/make_reference.py too, and the
// tests compare values and gradients with PennyLane.
//
// A circuit is a list of ops:
//   { gate: 'RX' | 'RY' | 'RZ', target, param: k }          trainable angle params[k]
//   { gate: 'RX' | 'RY' | 'RZ', target, input: i, scale }    data angle scale * x[i]
//   { gate: 'RZ', target, angle: (x) => … }                   any function of the data
//   { gate: 'H' | 'X', target }, { gate: 'CNOT', control, target }, { gate: 'CZ', control, target }

import { applyGate, GATES, rx, ry, rz, zeroState } from './circuit.js';
import { expectation as opExpectation, makeOperator } from './dynamics.js';

const ROT = { RX: rx, RY: ry, RZ: rz };

export function angleOf(op, params, x) {
  if (op.param !== undefined) return params[op.param];
  if (op.input !== undefined) return (op.scale ?? 1) * x[op.input];
  return op.angle(x);
}

export function run(n, ops, params = [], x = [], state = zeroState(n)) {
  for (const op of ops) {
    if (ROT[op.gate]) applyGate(state, op.target, ROT[op.gate](angleOf(op, params, x)));
    else if (op.gate === 'CNOT') applyGate(state, op.target, GATES.X, [op.control]);
    else if (op.gate === 'CZ') applyGate(state, op.target, GATES.Z, [op.control]);
    else applyGate(state, op.target, GATES[op.gate]);
  }
  return state;
}

export function expZ(state, q) {
  let s = 0;
  for (let b = 0; b < state.dim; b++) {
    const p = state.re[b] * state.re[b] + state.im[b] * state.im[b];
    s += (b >> q) & 1 ? -p : p;
  }
  return s;
}

// ⟨Z_a Z_b …⟩ for the qubits in `qs`
export function expZs(state, qs) {
  const mask = qs.reduce((m, q) => m | (1 << q), 0);
  let s = 0;
  for (let b = 0; b < state.dim; b++) {
    const p = state.re[b] * state.re[b] + state.im[b] * state.im[b];
    let par = b & mask;
    let odd = 0;
    for (; par; par &= par - 1) odd ^= 1;
    s += odd ? -p : p;
  }
  return s;
}

// Parameter-shift gradient of f(params): exact when every parameter enters through one rotation
// gate e^{−iθP/2}: ∂f/∂θ = [f(θ + π/2) − f(θ − π/2)] / 2.
export function parameterShift(f, params) {
  return params.map((_, k) => {
    const p = params.slice();
    p[k] = params[k] + Math.PI / 2;
    const up = f(p);
    p[k] = params[k] - Math.PI / 2;
    return (up - f(p)) / 2;
  });
}

// One Adam step (in place). state = { m, v, t }.
export function adamStep(params, grad, state, { lr = 0.05, b1 = 0.9, b2 = 0.999, eps = 1e-8 } = {}) {
  state.t = (state.t ?? 0) + 1;
  state.m ??= params.map(() => 0);
  state.v ??= params.map(() => 0);
  for (let k = 0; k < params.length; k++) {
    state.m[k] = b1 * state.m[k] + (1 - b1) * grad[k];
    state.v[k] = b2 * state.v[k] + (1 - b2) * grad[k] ** 2;
    const mh = state.m[k] / (1 - b1 ** state.t);
    const vh = state.v[k] / (1 - b2 ** state.t);
    params[k] -= (lr * mh) / (Math.sqrt(vh) + eps);
  }
  return params;
}

// ----- the lessons' models -----

// 2-qubit data re-uploading classifier (params flat: 4 per layer: rz0, ry0, rz1, ry1). Output ⟨Z0⟩.
export function classifierOps(layers) {
  const ops = [];
  for (let l = 0; l < layers; l++) {
    ops.push({ gate: 'RY', target: 0, input: 0 }, { gate: 'RY', target: 1, input: 1 });
    ops.push({ gate: 'RZ', target: 0, param: 4 * l }, { gate: 'RY', target: 0, param: 4 * l + 1 });
    ops.push({ gate: 'RZ', target: 1, param: 4 * l + 2 }, { gate: 'RY', target: 1, param: 4 * l + 3 });
    ops.push({ gate: 'CNOT', control: 0, target: 1 });
  }
  return ops;
}
export const classify = (layers, params, x) => expZ(run(2, classifierOps(layers), params, x), 0);

// 1-qubit Fourier model: per layer RY(a) RZ(b) RX(x), then a final RY(a) RZ(b). ⟨Z⟩.
export function fourierOps(layers) {
  const ops = [];
  for (let l = 0; l <= layers; l++) {
    ops.push({ gate: 'RY', target: 0, param: 2 * l }, { gate: 'RZ', target: 0, param: 2 * l + 1 });
    if (l < layers) ops.push({ gate: 'RX', target: 0, input: 0 });
  }
  return ops;
}
export const fourierModel = (layers, params, x) => expZ(run(1, fourierOps(layers), params, [x]), 0);

// Fourier coefficients c_k, k = 0 … K, of a 2π-periodic function from 2K + 1 samples (as in
// qml.fourier.coefficients: c_k = (1/M) Σ_j f(x_j) e^{−i k x_j}).
export function fourierCoefficients(f, K) {
  const M = 2 * K + 1;
  const xs = Array.from({ length: M }, (_, j) => (2 * Math.PI * j) / M);
  const fx = xs.map(f);
  return Array.from({ length: M }, (_, k) => {
    const kk = k <= K ? k : k - M;
    let re = 0;
    let im = 0;
    xs.forEach((x, j) => {
      re += (fx[j] * Math.cos(kk * x)) / M;
      im -= (fx[j] * Math.sin(kk * x)) / M;
    });
    return { k: kk, re, im };
  });
}

// Havlíček et al.'s ZZ feature map on 2 qubits (two repetitions), and its adjoint.
export function zzMapOps(adjoint = false) {
  const one = [
    { gate: 'H', target: 0 },
    { gate: 'H', target: 1 },
    { gate: 'RZ', target: 0, angle: (x) => 2 * x[0] },
    { gate: 'RZ', target: 1, angle: (x) => 2 * x[1] },
    { gate: 'CNOT', control: 0, target: 1 },
    { gate: 'RZ', target: 1, angle: (x) => 2 * (Math.PI - x[0]) * (Math.PI - x[1]) },
    { gate: 'CNOT', control: 0, target: 1 },
  ];
  const ops = [...one, ...one];
  if (!adjoint) return ops;
  return ops.reverse().map((op) => (op.angle ? { ...op, angle: (x) => -op.angle(x) } : op));
}

// |⟨φ(a)|φ(b)⟩|² for a feature map given as ops (applied with data a) and its adjoint (data b).
export function kernel(n, mapOps, adjointOps, a, b) {
  const s = run(n, mapOps, [], a);
  run(n, adjointOps, [], b, s);
  return s.re[0] * s.re[0] + s.im[0] * s.im[0];
}

// Angle encoding: RY(x_i) on qubit i. Its kernel is a product: Π cos²((a_i − b_i)/2).
export const angleOps = (n) => Array.from({ length: n }, (_, i) => ({ gate: 'RY', target: i, input: i }));
export const angleKernelExact = (a, b) => a.reduce((p, v, i) => p * Math.cos((v - b[i]) / 2) ** 2, 1);

// Pauli Hamiltonians ({ coeff, ops: [[wire, 'X'|'Y'|'Z'], …] }) as operators on the engine.
export function pauliOperator(terms, n) {
  return makeOperator(
    terms.map(({ coeff, ops }) => {
      let xmask = 0;
      let zmask = 0;
      for (const [q, p] of ops) {
        if (p === 'X' || p === 'Y') xmask |= 1 << q;
        if (p === 'Z' || p === 'Y') zmask |= 1 << q;
      }
      return { coeff, xmask, zmask };
    }),
    n,
  );
}
export const energy = (op, state) => opExpectation(op, state.re, state.im);

// H₂ VQE ansatz: Hartree–Fock |1100⟩ (wires 0, 1 occupied) and a Givens double excitation
// cos(θ/2)|1100⟩ − sin(θ/2)|0011⟩, PennyLane's DoubleExcitation(θ) on that state.
export function h2State(theta) {
  const s = zeroState(4);
  s.re[0] = 0;
  s.re[0b0011] = Math.cos(theta / 2); // bits 0 and 1 set: wires 0 and 1 occupied
  s.re[0b1100] = -Math.sin(theta / 2);
  return s;
}

// QAOA (p layers) for MaxCut: |+⟩^n, then for each layer e^{−iγ Σ Z_a Z_b} and RX(2β) on every qubit.
export function qaoaState(n, edges, gammas, betas) {
  const s = zeroState(n);
  for (let q = 0; q < n; q++) applyGate(s, q, GATES.H);
  for (let l = 0; l < gammas.length; l++) {
    for (let b = 0; b < s.dim; b++) {
      let zz = 0;
      for (const [u, v] of edges) zz += ((b >> u) ^ (b >> v)) & 1 ? -1 : 1;
      const [c, sn] = [Math.cos(gammas[l] * zz), Math.sin(gammas[l] * zz)];
      const [r, i] = [s.re[b], s.im[b]];
      s.re[b] = c * r + sn * i;
      s.im[b] = c * i - sn * r;
    }
    for (let q = 0; q < n; q++) applyGate(s, q, rx(2 * betas[l]));
  }
  return s;
}
export const cutValue = (state, edges) => edges.reduce((c, [u, v]) => c + (1 - expZs(state, [u, v])) / 2, 0);

// ----- encodings -----

// Amplitude encoding of four non-negative numbers on two qubits, as circuit.js ops (a controlled-RY
// tree): amplitude of |b⟩ (b = b0 + 2 b1, qubit 0 = bit 0) ends up proportional to v[b].
export function amplitudeEncodingOps(v) {
  const n = Math.hypot(...v) || 1;
  const a = v.map((x) => Math.max(0, x) / n);
  const top = Math.hypot(a[0], a[1]);
  const bottom = Math.hypot(a[2], a[3]);
  const half = (p, q) => 2 * Math.atan2(q, p);
  return [
    { gate: 'RY', target: 1, angle: half(top, bottom) },
    { gate: 'X', target: 1 },
    { gate: 'RY', target: 0, angle: half(a[0], a[1]), controls: [1] },
    { gate: 'X', target: 1 },
    { gate: 'RY', target: 0, angle: half(a[2], a[3]), controls: [1] },
  ];
}

// ----- data -----

// Deterministic 2D datasets with labels ±1, coordinates in about [−1.5, 1.5].
export function dataset(kind, count, seed = 1) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pts = [];
  while (pts.length < count) {
    if (kind === 'moons') {
      const up = pts.length % 2 === 0;
      const t = Math.PI * rng();
      const [x, y] = up ? [Math.cos(t) - 0.5, Math.sin(t) - 0.25] : [0.5 - Math.cos(t), 0.25 - Math.sin(t)];
      pts.push({ x: [x * 1.1 + 0.15 * (rng() - 0.5), y * 1.1 + 0.15 * (rng() - 0.5)], y: up ? 1 : -1 });
    } else {
      const x = [3 * rng() - 1.5, 3 * rng() - 1.5];
      const label = kind === 'xor' ? (x[0] * x[1] > 0 ? 1 : -1) : Math.hypot(...x) < 0.95 ? 1 : -1;
      if (kind === 'circle' && Math.abs(Math.hypot(...x) - 0.95) < 0.08) continue; // a small margin
      if (kind === 'xor' && Math.min(Math.abs(x[0]), Math.abs(x[1])) < 0.1) continue;
      pts.push({ x, y: label });
    }
  }
  return pts;
}

// ----- training -----

// Mean squared error of a model f(params, x) ∈ [−1, 1] against labels ±1, and its gradient.
export function mseLoss(f, params, data) {
  return data.reduce((s, d) => s + (f(params, d.x) - d.y) ** 2, 0) / data.length;
}

export function mseGradient(f, params, data) {
  const g = new Array(params.length).fill(0);
  for (const d of data) {
    const r = f(params, d.x) - d.y;
    const pg = parameterShift((p) => f(p, d.x), params);
    for (let k = 0; k < g.length; k++) g[k] += (2 * r * pg[k]) / data.length;
  }
  return g;
}

export const accuracy = (f, params, data) => data.filter((d) => Math.sign(f(params, d.x) || 1e-12) === d.y).length / data.length;

// Train with Adam from seeded initial parameters, recording every epoch, so a lesson can ask for
// "the model after 40 epochs" and always get the same answer.
export function trainHistory(f, nParams, data, { epochs, lr = 0.1, seed = 3, test = [] }) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const params = Array.from({ length: nParams }, () => (rng() * 2 - 1) * Math.PI);
  const opt = {};
  const history = [{ params: params.slice(), loss: mseLoss(f, params, data), acc: accuracy(f, params, data), testAcc: test.length ? accuracy(f, params, test) : null }];
  for (let e = 0; e < epochs; e++) {
    adamStep(params, mseGradient(f, params, data), opt, { lr });
    history.push({ params: params.slice(), loss: mseLoss(f, params, data), acc: accuracy(f, params, data), testAcc: test.length ? accuracy(f, params, test) : null });
  }
  return history;
}

// Solve A x = b (dense, Gaussian elimination with partial pivoting).
export function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// The classifier lesson's training run (Web Worker): data, then Adam on the re-uploading model.
export function trainClassifier({ kind, layers, epochs, lr = 0.1, seed = 3 }, progress) {
  const train = dataset(kind, 60, 1);
  const test = dataset(kind, 100, 2);
  const f = (p, x) => classify(layers, p, x);
  const history = trainHistory(f, 4 * layers, train, { epochs, lr, seed, test });
  progress?.(1);
  return { train, test, history };
}

// ----- Fourier-series lesson -----

export const TARGETS = {
  'two-tone': (x) => 0.5 * Math.sin(x) + 0.4 * Math.cos(3 * x),
  square: (x) => (Math.sin(x) >= 0 ? 0.8 : -0.8),
  sawtooth: (x) => 0.8 * (((x / Math.PI + 1) % 2) - 1),
  'cos 2x': (x) => 0.9 * Math.cos(2 * x),
};

// Least-squares trigonometric polynomial of degree K through samples (x_j, y_j): the best any
// model with frequencies |k| ≤ K can do on these points. Returns the fitted function and its
// coefficients a_0, a_k, b_k (f = a_0 + Σ a_k cos kx + b_k sin kx).
export function classicalFourierFit(xs, ys, K) {
  const basis = (x) => [1, ...Array.from({ length: K }, (_, k) => [Math.cos((k + 1) * x), Math.sin((k + 1) * x)]).flat()];
  const m = 2 * K + 1;
  const A = Array.from({ length: m }, () => new Array(m).fill(0));
  const b = new Array(m).fill(0);
  xs.forEach((x, j) => {
    const phi = basis(x);
    for (let r = 0; r < m; r++) {
      b[r] += phi[r] * ys[j];
      for (let c = 0; c < m; c++) A[r][c] += phi[r] * phi[c];
    }
  });
  const w = solve(A, b);
  const f = (x) => basis(x).reduce((s, p, i) => s + p * w[i], 0);
  return { f, w };
}

// Fit the 1-qubit re-uploading model to a target with Adam (Web Worker), recording every epoch.
export function fitFourier({ target, layers, epochs, lr = 0.08, seed = 2, samples = 40 }, progress) {
  const xs = Array.from({ length: samples }, (_, j) => (2 * Math.PI * j) / samples);
  const ys = xs.map(TARGETS[target]);
  const data = xs.map((x, j) => ({ x, y: ys[j] }));
  const f = (p, x) => fourierModel(layers, p, x);
  // the landscape has local minima: keep the best of three seeded starts
  let history = null;
  for (let r = 0; r < 3; r++) {
    const h = trainHistory(f, 2 * (layers + 1), data, { epochs, lr, seed: seed + 101 * r }).map(({ params, loss }) => ({ params, loss }));
    if (!history || h[h.length - 1].loss < history[history.length - 1].loss) history = h;
  }
  const classical = classicalFourierFit(xs, ys, layers);
  const classicalLoss = xs.reduce((s, x, j) => s + (classical.f(x) - ys[j]) ** 2, 0) / samples;
  progress?.(1);
  return { xs, ys, history, classicalW: classical.w, classicalLoss };
}

// ----- kernel methods -----

// Kernel functions on 2D points (coordinates in about [−1.5, 1.5]); `scale` is the bandwidth: how
// strongly the data are multiplied before encoding.
const ZZ_MAP = zzMapOps();
const ZZ_ADJ = zzMapOps(true);
export const KERNELS = {
  zz: (a, b, scale) => kernel(2, ZZ_MAP, ZZ_ADJ, [scale * a[0], scale * a[1]], [scale * b[0], scale * b[1]]),
  angle: (a, b, scale) => angleKernelExact([scale * a[0], scale * a[1]], [scale * b[0], scale * b[1]]),
  rbf: (a, b, scale) => Math.exp(-(scale ** 2) * ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)),
};

// Kernel ridge regression: α = (K + λI)⁻¹ y, prediction f(x) = Σ α_i k(x_i, x).
export function kernelRidge(train, k, lambda = 0.05) {
  const K = train.map((p) => train.map((q) => k(p.x, q.x)));
  const A = K.map((row, i) => row.map((v, j) => v + (i === j ? lambda : 0)));
  const alpha = solve(A, train.map((p) => p.y));
  return { K, alpha, f: (x) => train.reduce((s, p, i) => s + alpha[i] * k(p.x, x), 0) };
}

// ----- barren plateaus -----

// Hardware-efficient ansatz: each layer RY then RZ on every qubit, then a CNOT chain.
export function hardwareEfficientOps(n, layers) {
  const ops = [];
  let k = 0;
  for (let l = 0; l < layers; l++) {
    for (let q = 0; q < n; q++) ops.push({ gate: 'RY', target: q, param: k++ });
    for (let q = 0; q < n; q++) ops.push({ gate: 'RZ', target: q, param: k++ });
    for (let q = 0; q + 1 < n; q++) ops.push({ gate: 'CNOT', control: q, target: q + 1 });
  }
  return { ops, count: k };
}

// Variance over random parameters of ∂C/∂θ₀ (the first RY), for a global cost ⟨Z⊗…⊗Z⟩ and a
// local one ⟨Z₀⟩ (Web Worker). depth: 'linear' (as many layers as qubits) or a fixed number.
export function gradientVariance({ ns, depth, samples, seed = 7 }, progress) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out = [];
  ns.forEach((n, idx) => {
    const layers = depth === 'linear' ? n : depth;
    const { ops, count } = hardwareEfficientOps(n, layers);
    const all = Array.from({ length: n }, (_, q) => q);
    const g = { global: [], local: [] };
    for (let k = 0; k < samples; k++) {
      const params = Array.from({ length: count }, () => 2 * Math.PI * rng());
      const shifted = (d) => {
        const p = params.slice();
        p[0] += d;
        return run(n, ops, p);
      };
      const [up, down] = [shifted(Math.PI / 2), shifted(-Math.PI / 2)];
      g.global.push((expZs(up, all) - expZs(down, all)) / 2);
      g.local.push((expZ(up, 0) - expZ(down, 0)) / 2);
    }
    const variance = (v) => {
      const m = v.reduce((a, b) => a + b, 0) / v.length;
      return v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1);
    };
    out.push({ n, layers, global: variance(g.global), local: variance(g.local), samples, gradients: g });
    progress?.((idx + 1) / ns.length);
  });
  return out;
}

// ----- MaxCut helpers -----

export function maxCut(n, edges) {
  let best = 0;
  for (let b = 0; b < 1 << n; b++) best = Math.max(best, edges.reduce((c, [u, v]) => c + (((b >> u) ^ (b >> v)) & 1), 0));
  return best;
}

// Probability of each cut value in a state.
export function cutDistribution(state, n, edges) {
  const out = new Array(edges.length + 1).fill(0);
  for (let b = 0; b < state.dim; b++) {
    const c = edges.reduce((s, [u, v]) => s + (((b >> u) ^ (b >> v)) & 1), 0);
    out[c] += state.re[b] ** 2 + state.im[b] ** 2;
  }
  return out;
}

// Best p-layer QAOA angles: a coarse grid for p = 1, then coordinate refinement (deterministic).
export function optimiseQaoa(n, edges, p) {
  const value = (g, b) => cutValue(qaoaState(n, edges, g, b), edges);
  let best = { g: [], b: [], v: -1 };
  for (let i = 0; i <= 40; i++) {
    for (let j = 0; j <= 20; j++) {
      const g = (Math.PI * i) / 40;
      const b = ((Math.PI / 2) * j) / 20;
      const v = value(new Array(p).fill(g / p), new Array(p).fill(b));
      if (v > best.v) best = { g: new Array(p).fill(g / p), b: new Array(p).fill(b), v };
    }
  }
  let step = 0.1;
  while (step > 1e-6) {
    let improved = false;
    for (const key of ['g', 'b']) {
      for (let k = 0; k < p; k++) {
        for (const d of [step, -step]) {
          const t = { g: best.g.slice(), b: best.b.slice() };
          t[key][k] += d;
          const v = value(t.g, t.b);
          if (v > best.v + 1e-12) {
            best = { ...t, v };
            improved = true;
          }
        }
      }
    }
    if (!improved) step /= 2;
  }
  return best;
}
