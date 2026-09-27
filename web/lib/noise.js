// Bell's theorem, mixed states and decoherence, and quantum error correction.
// Qubit q is bit q of the basis index, as everywhere in lib/circuit.js.

import { applyGate, GATES, rx, ry, zeroState } from './circuit.js';

// ----- Bell / CHSH -----

// Measuring both halves of (|00> + |11>)/sqrt2 along directions at Bloch angles a and b in the
// x-z plane: the outcomes agree with probability cos^2((a - b)/2), so the correlation is cos(a - b).
export const correlation = (a, b) => Math.cos(a - b);

// CHSH quantity S = E(a0,b0) + E(a0,b1) + E(a1,b0) - E(a1,b1); local hidden variables give |S| <= 2.
export const chshS = ({ a0, a1, b0, b1 }) => correlation(a0, b0) + correlation(a0, b1) + correlation(a1, b0) - correlation(a1, b1);

// The CHSH game: Alice gets bit x, Bob bit y, they answer a, b and win if a XOR b = x AND y.
// With the quantum strategy the win probability is 1/2 + S/8.
export const gameWin = (angles) => 0.5 + chshS(angles) / 8;

// One round of the quantum strategy, simulated on the statevector engine: make a Bell pair,
// rotate each qubit so its measurement axis is z, and sample both outcomes.
export function quantumRound(angles, x, y, rng) {
  const s = zeroState(2);
  applyGate(s, 0, GATES.H);
  applyGate(s, 1, GATES.X, [0]);
  applyGate(s, 0, ry(-(x ? angles.a1 : angles.a0)));
  applyGate(s, 1, ry(-(y ? angles.b1 : angles.b0)));
  const probs = [0, 1, 2, 3].map((k) => s.re[k] ** 2 + s.im[k] ** 2);
  let u = rng();
  let k = 0;
  while (k < 3 && u >= probs[k]) u -= probs[k++];
  return { a: k & 1, b: (k >> 1) & 1 };
}

// All 16 deterministic local strategies: Alice answers f(x), Bob g(y). Shared randomness can only
// mix these, so it can never beat the best one.
export function classicalStrategies() {
  const out = [];
  for (let f = 0; f < 4; f++) {
    for (let g = 0; g < 4; g++) {
      const A = (x) => (f >> x) & 1;
      const B = (y) => (g >> y) & 1;
      let wins = 0;
      for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) if ((A(x) ^ B(y)) === (x & y)) wins++;
      out.push({ alice: [A(0), A(1)], bob: [B(0), B(1)], win: wins / 4 });
    }
  }
  return out;
}

// ----- density matrices -----

// rho = (I + r . sigma)/2 as { re: [a, b, c, d], im: [...] } (row-major 2x2).
export function rhoFromBloch([x, y, z]) {
  return { re: [(1 + z) / 2, x / 2, x / 2, (1 - z) / 2], im: [0, -y / 2, y / 2, 0] };
}

export const purity = ([x, y, z]) => (1 + x * x + y * y + z * z) / 2;

// von Neumann entropy in bits.
export function entropy(r) {
  const len = Math.min(1, Math.hypot(...r));
  const h = (p) => (p <= 1e-15 ? 0 : -p * Math.log2(p));
  return h((1 + len) / 2) + h((1 - len) / 2);
}

// Reduced density matrix of one qubit of a statevector (partial trace over the rest).
export function reducedQubit(s, q) {
  const bit = 1 << q;
  let p0 = 0;
  let p1 = 0;
  let cr = 0;
  let ci = 0;
  for (let k = 0; k < s.dim; k++) {
    if (k & bit) continue;
    const j = k | bit;
    p0 += s.re[k] ** 2 + s.im[k] ** 2;
    p1 += s.re[j] ** 2 + s.im[j] ** 2;
    // rho_01 = sum a_k conj(a_j)
    cr += s.re[k] * s.re[j] + s.im[k] * s.im[j];
    ci += s.im[k] * s.re[j] - s.re[k] * s.im[j];
  }
  return { re: [p0, cr, cr, p1], im: [0, ci, -ci, 0] };
}

export function blochFromRho(rho) {
  return [2 * rho.re[1], -2 * rho.im[1], rho.re[0] - rho.re[3]];
}

// Decoherence as entanglement: the system qubit (0) in |+> touches `envCount` environment qubits,
// turning each by `angle` (a controlled-RY) only if the system is |1>. Returns the system's
// Bloch vector; its x component is cos(angle/2)^envCount.
export function entangleWithEnvironment(envCount, angle) {
  const s = zeroState(1 + envCount);
  applyGate(s, 0, GATES.H);
  for (let e = 1; e <= envCount; e++) applyGate(s, e, ry(angle), [0]);
  return { state: s, bloch: blochFromRho(reducedQubit(s, 0)) };
}

// Noise acting on a Bloch vector for time t: amplitude damping with time constant T1 (decay to |0>)
// and dephasing with T2 (T2 <= 2 T1 for a physical qubit), plus precession at detuning `detune`.
export function evolveNoisy([x, y, z], t, { T1 = Infinity, T2 = Infinity, detune = 0 }) {
  const e1 = Math.exp(-t / T1);
  const e2 = Math.exp(-t / T2);
  const c = Math.cos(detune * t);
  const s = Math.sin(detune * t);
  return [(x * c - y * s) * e2, (x * s + y * c) * e2, 1 - (1 - z) * e1];
}

// ----- error correction -----

function choose(n, k) {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

// Chance that a distance-d repetition code (majority vote) fails when each qubit flips
// independently with probability p.
export function repetitionFailure(d, p) {
  let f = 0;
  for (let k = Math.floor(d / 2) + 1; k <= d; k++) f += choose(d, k) * p ** k * (1 - p) ** (d - k);
  return f;
}

// Shor's nine-qubit code on the statevector engine. Qubit 0 holds the message; blocks are
// {0,1,2}, {3,4,5}, {6,7,8}.
export const SHOR_BLOCKS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
];

export function shorEncodeOps() {
  const ops = [
    { gate: 'X', target: 3, controls: [0] },
    { gate: 'X', target: 6, controls: [0] },
    { gate: 'H', target: 0 },
    { gate: 'H', target: 3 },
    { gate: 'H', target: 6 },
  ];
  for (const [l, a, b] of SHOR_BLOCKS) ops.push({ gate: 'X', target: a, controls: [l] }, { gate: 'X', target: b, controls: [l] });
  return ops;
}

// Decoding with built-in correction: majority votes (Toffolis) inside each block fix a bit flip;
// then a majority vote across blocks fixes a sign flip. Any single-qubit error is corrected.
export function shorDecodeOps() {
  const ops = [];
  for (const [l, a, b] of SHOR_BLOCKS) {
    ops.push({ gate: 'X', target: a, controls: [l] }, { gate: 'X', target: b, controls: [l] }, { gate: 'X', target: l, controls: [a, b] });
  }
  ops.push({ gate: 'H', target: 0 }, { gate: 'H', target: 3 }, { gate: 'H', target: 6 });
  ops.push({ gate: 'X', target: 3, controls: [0] }, { gate: 'X', target: 6, controls: [0] }, { gate: 'X', target: 0, controls: [3, 6] });
  return ops;
}

// The error as an op: 'X', 'Y', 'Z', or 'R' for an arbitrary small rotation (angle about a tilted
// axis), which is a superposition of I, X, Y and Z errors.
export function errorOp(kind, qubit, angle = 0.9) {
  if (kind === 'none') return null;
  if (kind === 'R') {
    return {
      gate: 'BLOCK',
      targets: [qubit],
      label: 'R',
      apply: (s) => {
        applyGate(s, qubit, rx(angle));
        applyGate(s, qubit, ry(angle / 2));
      },
    };
  }
  return { gate: kind, target: qubit };
}
