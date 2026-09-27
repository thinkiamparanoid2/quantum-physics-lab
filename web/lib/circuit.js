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

// Draw one measurement outcome from a probability vector, given a uniform random number u in [0, 1).
export function sampleOutcome(probs, u) {
  let acc = 0;
  for (let b = 0; b < probs.length; b++) {
    acc += probs[b];
    if (u < acc) return b;
  }
  return probs.length - 1;
}
