// Gate-level statevector engine shared by the algorithm topics.
// Qubit q is bit q of the basis index, and qubit 0 is written first in kets.

const R = Math.SQRT1_2;

// Single-qubit gates as 2x2 complex matrices [a, b, c, d] (row-major), real and imaginary parts.
export const GATES = {
  I: { re: [1, 0, 0, 1], im: [0, 0, 0, 0] },
  H: { re: [R, R, R, -R], im: [0, 0, 0, 0] },
  X: { re: [0, 1, 1, 0], im: [0, 0, 0, 0] },
  Y: { re: [0, 0, 0, 0], im: [0, -1, 1, 0] },
  Z: { re: [1, 0, 0, -1], im: [0, 0, 0, 0] },
  S: { re: [1, 0, 0, 0], im: [0, 0, 0, 1] },
  T: { re: [1, 0, 0, R], im: [0, 0, 0, R] },
};

GATES.SDG = { re: [1, 0, 0, 0], im: [0, 0, 0, -1] };
GATES.TDG = { re: [1, 0, 0, R], im: [0, 0, 0, -R] };

// Rotations by angle t about the x, y and z axes of the Bloch sphere, and the phase gate P(t).
export function rx(t) {
  const c = Math.cos(t / 2);
  const s = Math.sin(t / 2);
  return { re: [c, 0, 0, c], im: [0, -s, -s, 0] };
}

export function ry(t) {
  const c = Math.cos(t / 2);
  const s = Math.sin(t / 2);
  return { re: [c, -s, s, c], im: [0, 0, 0, 0] };
}

export function rz(t) {
  const c = Math.cos(t / 2);
  const s = Math.sin(t / 2);
  return { re: [c, 0, 0, c], im: [-s, 0, 0, s] };
}

export function phase(t) {
  return { re: [1, 0, 0, Math.cos(t)], im: [0, 0, 0, Math.sin(t)] };
}

export function zeroState(n) {
  const dim = 1 << n;
  const re = new Float64Array(dim);
  re[0] = 1;
  return { n, dim, re, im: new Float64Array(dim) };
}

export function cloneState(s) {
  return { n: s.n, dim: s.dim, re: Float64Array.from(s.re), im: Float64Array.from(s.im) };
}

// Apply gate g to qubit q, only on basis states where every control qubit is 1.
export function applyGate(s, q, g, controls = []) {
  const bit = 1 << q;
  let cmask = 0;
  for (const c of controls) {
    if (c === q) throw new Error(`qubit ${q} can't control itself`);
    cmask |= 1 << c;
  }
  const [ar, br, cr, dr] = g.re;
  const [ai, bi, ci, di] = g.im;
  for (let b = 0; b < s.dim; b++) {
    if (b & bit || (b & cmask) !== cmask) continue;
    const b1 = b | bit;
    const x0r = s.re[b];
    const x0i = s.im[b];
    const x1r = s.re[b1];
    const x1i = s.im[b1];
    s.re[b] = ar * x0r - ai * x0i + br * x1r - bi * x1i;
    s.im[b] = ar * x0i + ai * x0r + br * x1i + bi * x1r;
    s.re[b1] = cr * x0r - ci * x0i + dr * x1r - di * x1i;
    s.im[b1] = cr * x0i + ci * x0r + dr * x1i + di * x1r;
  }
  return s;
}

export function applyToAll(s, g) {
  for (let q = 0; q < s.n; q++) applyGate(s, q, g);
  return s;
}

// Multiply by -1 every basis state for which predicate(index) is true (a phase oracle).
export function flipPhase(s, predicate) {
  for (let b = 0; b < s.dim; b++) {
    if (predicate(b)) {
      s.re[b] = -s.re[b];
      s.im[b] = -s.im[b];
    }
  }
  return s;
}

export function probabilities(s) {
  const p = new Float64Array(s.dim);
  for (let b = 0; b < s.dim; b++) p[b] = s.re[b] * s.re[b] + s.im[b] * s.im[b];
  return p;
}

export function ket(b, n) {
  let bits = '';
  for (let q = 0; q < n; q++) bits += (b >> q) & 1;
  return `|${bits}⟩`;
}

// Basis indices in reading order (|00⟩, |01⟩, |10⟩, |11⟩ with qubit 0 written first),
// which is bit-reversed index order.
export function ketOrder(n) {
  const order = [];
  for (let r = 0; r < 1 << n; r++) {
    let b = 0;
    for (let q = 0; q < n; q++) if (r & (1 << (n - 1 - q))) b |= 1 << q;
    order.push(b);
  }
  return order;
}

// Draw one measurement outcome from a probability vector, given a uniform random number u in [0, 1).
export function sampleOutcome(probs, u) {
  let acc = 0;
  for (let b = 0; b < probs.length; b++) {
    acc += probs[b];
    if (u < acc) return b;
  }
  return probs.length - 1;
}

export function swapQubits(s, a, b) {
  const ma = 1 << a;
  const mb = 1 << b;
  for (let i = 0; i < s.dim; i++) {
    if (!(i & ma) && i & mb) {
      const j = i ^ ma ^ mb;
      [s.re[i], s.re[j]] = [s.re[j], s.re[i]];
      [s.im[i], s.im[j]] = [s.im[j], s.im[i]];
    }
  }
  return s;
}

// Measure qubit q: outcome 0 with probability P(0), decided by the uniform number u.
// The state collapses onto the outcome and is renormalised.
export function measureQubit(s, q, u) {
  const bit = 1 << q;
  let p0 = 0;
  for (let b = 0; b < s.dim; b++) if (!(b & bit)) p0 += s.re[b] * s.re[b] + s.im[b] * s.im[b];
  const outcome = u < p0 ? 0 : 1;
  const p = outcome === 0 ? p0 : 1 - p0;
  const scale = 1 / Math.sqrt(p);
  for (let b = 0; b < s.dim; b++) {
    if (((b & bit) !== 0) === (outcome === 1)) {
      s.re[b] *= scale;
      s.im[b] *= scale;
    } else {
      s.re[b] = 0;
      s.im[b] = 0;
    }
  }
  return { outcome, probability: p };
}

// A circuit is a list of operations:
//   { gate: 'H', target: 0 }                         named gate from GATES
//   { gate: 'X', target: 2, controls: [0, 1] }       controlled (Toffoli here)
//   { gate: 'RY', target: 0, angle: 1.2 }            RX, RY, RZ, P take an angle
//   { gate: 'SWAP', targets: [0, 2] }
//   { gate: 'MEASURE', target: 1, bit: 1 }           collapses; stores the outcome in bits[bit]
//   { gate: 'Z', target: 2, if: { bit: 0, value: 1 } }   classically controlled
//   { gate: 'X', target: 0, if: [{ bit: 3, value: 1 }, { bit: 4, value: 0 }] }   on several bits (all must match)
//   { gate: 'BLOCK', targets: [0, 1, 2], label: 'Oracle', apply: (state) => {} }
//   { gate: 'BARRIER' }                              no-op, aligns the diagram
export function gateMatrix(op) {
  switch (op.gate) {
    case 'RX':
      return rx(op.angle);
    case 'RY':
      return ry(op.angle);
    case 'RZ':
      return rz(op.angle);
    case 'P':
      return phase(op.angle);
    default: {
      const g = GATES[op.gate];
      if (!g) throw new Error(`Unknown gate ${op.gate}`);
      return g;
    }
  }
}

// The classical conditions of an op as a list (an op may give one or several).
export const conditionsOf = (op) => (op.if ? (Array.isArray(op.if) ? op.if : [op.if]) : []);

export function applyOp(s, op, bits, rng) {
  if (op.if && !conditionsOf(op).every((c) => bits[c.bit] === c.value)) return { skipped: true };
  switch (op.gate) {
    case 'MEASURE': {
      const r = measureQubit(s, op.target, rng());
      bits[op.bit ?? op.target] = r.outcome;
      return r;
    }
    case 'SWAP':
      swapQubits(s, op.targets[0], op.targets[1]);
      return null;
    case 'BLOCK':
      op.apply(s);
      return null;
    case 'BARRIER':
      return null;
    default:
      applyGate(s, op.target, gateMatrix(op), op.controls ?? []);
      return null;
  }
}

// Run the first `until` operations from |0...0>. Measurements draw from rng, so a fixed
// seed gives the same outcomes every time.
export function runOps(n, ops, until = ops.length, rng = Math.random) {
  const state = zeroState(n);
  const bits = {};
  const results = [];
  for (let i = 0; i < until; i++) results.push(applyOp(state, ops[i], bits, rng));
  return { state, bits, results };
}

// Small deterministic PRNG (mulberry32) so a lesson's "random" measurements are repeatable.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
