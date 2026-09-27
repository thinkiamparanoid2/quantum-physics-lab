// Circuits for the algorithm lessons. Registers list qubits most-significant first, so a
// register [q0, q1, q2] holding |101> means the number 5, matching how kets are written.

import { applyOp } from './circuit.js';

// ----- registers -----

export function registerValue(b, qubits) {
  let v = 0;
  for (const q of qubits) v = (v << 1) | ((b >> q) & 1);
  return v;
}

// Probability of each value of a register (summing over every other qubit).
export function registerProbs(probs, qubits) {
  const out = new Float64Array(1 << qubits.length);
  for (let b = 0; b < probs.length; b++) out[registerValue(b, qubits)] += probs[b];
  return out;
}

const range = (n, start = 0) => Array.from({ length: n }, (_, i) => start + i);
const H = (q) => ({ gate: 'H', target: q });
const X = (q) => ({ gate: 'X', target: q });

// ----- Deutsch-Jozsa and Bernstein-Vazirani -----
// Inputs are qubits 0..n-1, the answer (ancilla) qubit is n.

export const DJ_ORACLES = {
  zero: { label: 'Constant: f(x) = 0', kind: 'constant', s: null, flip: false },
  one: { label: 'Constant: f(x) = 1', kind: 'constant', s: null, flip: true },
  first: { label: 'Balanced: f(x) = first bit', kind: 'balanced', s: 'first', flip: false },
  last: { label: 'Balanced: f(x) = NOT last bit', kind: 'balanced', s: 'last', flip: true },
  parity: { label: 'Balanced: f(x) = parity of all bits', kind: 'balanced', s: 'all', flip: false },
};

function maskFor(s, n) {
  if (s === null) return '0'.repeat(n);
  if (s === 'first') return `1${'0'.repeat(n - 1)}`;
  if (s === 'last') return `${'0'.repeat(n - 1)}1`;
  if (s === 'all') return '1'.repeat(n);
  return s;
}

// f(x) = (s . x) XOR flip, as gates: a CNOT from every input where s has a 1, then X if flip.
export function linearOracleGates(mask, flip, n) {
  const gates = [];
  mask.split('').forEach((c, i) => {
    if (c === '1') gates.push({ gate: 'X', target: n, controls: [i] });
  });
  if (flip) gates.push(X(n));
  return gates;
}

export function linearFunction(mask, flip) {
  return (x, n) => {
    let v = flip ? 1 : 0;
    mask.split('').forEach((c, i) => {
      if (c === '1') v ^= (x >> (n - 1 - i)) & 1;
    });
    return v;
  };
}

function oracleOps(gates, n, reveal, label) {
  if (reveal) return gates;
  return [
    {
      gate: 'BLOCK',
      targets: range(n + 1),
      label,
      apply: (s) => {
        const bits = {};
        for (const g of gates) applyOp(s, g, bits, Math.random);
      },
    },
  ];
}

export function queryCircuit(n, gates, { reveal = false, label = 'Oracle' } = {}) {
  const prep = [X(n), ...range(n + 1).map(H)];
  const oracle = oracleOps(gates, n, reveal, label);
  const unprep = range(n).map(H);
  const measure = range(n).map((q) => ({ gate: 'MEASURE', target: q, bit: q }));
  const ops = [...prep, ...oracle, ...unprep, ...measure];
  const at = { prepared: prep.length, queried: prep.length + oracle.length };
  at.interfered = at.queried + unprep.length;
  at.measured = ops.length;
  return { ops, at };
}

export function djCircuit(n, oracle, reveal) {
  const o = DJ_ORACLES[oracle];
  const mask = maskFor(o.s, n);
  return { ...queryCircuit(n, linearOracleGates(mask, o.flip, n), { reveal }), f: linearFunction(mask, o.flip), kind: o.kind };
}

export function bvCircuit(secret, reveal) {
  const n = secret.length;
  return queryCircuit(n, linearOracleGates(secret, false, n), { reveal, label: 'f(x) = s·x' });
}

// ----- quantum Fourier transform -----
// On register [q0 (most significant), ..., q_{n-1}]: |x> -> (1/sqrt N) sum_y e^{2 pi i x y / N} |y>.

export function qftOps(reg) {
  const n = reg.length;
  const ops = [];
  for (let i = 0; i < n; i++) {
    ops.push(H(reg[i]));
    for (let k = 2; k <= n - i; k++) {
      ops.push({ gate: 'P', target: reg[i], controls: [reg[i + k - 1]], angle: (2 * Math.PI) / 2 ** k });
    }
  }
  for (let i = 0; i < Math.floor(n / 2); i++) ops.push({ gate: 'SWAP', targets: [reg[i], reg[n - 1 - i]] });
  return ops;
}

export function inverseQftOps(reg) {
  return qftOps(reg)
    .reverse()
    .map((op) => (op.gate === 'P' ? { ...op, angle: -op.angle } : op));
}

// Ops that prepare a register in |x> (x written most-significant first).
export function basisPrep(x, reg) {
  const n = reg.length;
  return reg.flatMap((q, i) => ((x >> (n - 1 - i)) & 1 ? [X(q)] : []));
}

export function blockOf(ops, targets, label) {
  return {
    gate: 'BLOCK',
    targets,
    label,
    apply: (s) => {
      const bits = {};
      for (const op of ops) applyOp(s, op, bits, Math.random);
    },
  };
}

// ----- phase estimation -----
// Counting register [0..t-1] (q0 most significant), eigenstate qubit t prepared in |1>.
// U = P(2 pi phi), so U|1> = e^{2 pi i phi}|1>; counting qubit j controls U^(2^(t-1-j)).

export function qpeCircuit(t, phi) {
  const count = range(t);
  const target = t;
  const prep = [X(target), ...count.map(H)];
  const powers = count.map((q, j) => ({
    gate: 'P',
    target,
    controls: [q],
    angle: 2 * Math.PI * phi * 2 ** (t - 1 - j),
    label: `U^${2 ** (t - 1 - j)}`,
  }));
  const iqft = inverseQftOps(count);
  const measure = count.map((q) => ({ gate: 'MEASURE', target: q, bit: q }));
  const ops = [...prep, ...powers, ...iqft, ...measure];
  const at = { prepared: prep.length, kicked: prep.length + powers.length };
  at.transformed = at.kicked + iqft.length;
  at.measured = ops.length;
  return { ops, at, count };
}

// ----- Shor's algorithm for N = 15 -----

export const SHOR_N = 15;

export function modPow(a, x, n) {
  let r = 1;
  let base = a % n;
  let e = x;
  while (e > 0) {
    if (e & 1) r = (r * base) % n;
    base = (base * base) % n;
    e >>= 1;
  }
  return r;
}

export function gcd(a, b) {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

export function classicalPeriod(a, n) {
  for (let r = 1; r <= n; r++) if (modPow(a, r, n) === 1) return r;
  return null;
}

// |x>|w> -> |x>|w * a^x mod N> on counting register `count` and work register `work`
// (a permutation of basis states; work values >= N are left alone).
export function modExpBlock(a, n, count, work) {
  return {
    gate: 'BLOCK',
    targets: [...count, ...work],
    label: `×${a}^x mod ${n}`,
    apply: (s) => {
      const re = new Float64Array(s.dim);
      const im = new Float64Array(s.dim);
      for (let b = 0; b < s.dim; b++) {
        if (s.re[b] === 0 && s.im[b] === 0) continue;
        const x = registerValue(b, count);
        const w = registerValue(b, work);
        const w2 = w < n ? (w * modPow(a, x, n)) % n : w;
        let b2 = b;
        work.forEach((q, i) => {
          const bit = (w2 >> (work.length - 1 - i)) & 1;
          b2 = bit ? b2 | (1 << q) : b2 & ~(1 << q);
        });
        re[b2] = s.re[b];
        im[b2] = s.im[b];
      }
      s.re.set(re);
      s.im.set(im);
    },
  };
}

export function shorCircuit(a, { t = 4 } = {}) {
  const count = range(t);
  const work = range(4, t);
  const prep = [X(work[work.length - 1]), ...count.map(H)];
  const exp = [modExpBlock(a, SHOR_N, count, work)];
  const measureWork = work.map((q, i) => ({ gate: 'MEASURE', target: q, bit: t + i }));
  const iqft = [blockOf(inverseQftOps(count), count, 'QFT†')];
  const measure = count.map((q) => ({ gate: 'MEASURE', target: q, bit: q }));
  const ops = [...prep, ...exp, ...measureWork, ...iqft, ...measure];
  const at = { prepared: prep.length, exponentiated: prep.length + 1 };
  at.workMeasured = at.exponentiated + measureWork.length;
  at.transformed = at.workMeasured + 1;
  at.measured = ops.length;
  return { ops, at, count, work };
}

// Convergents p/q of the continued fraction of y / Q.
export function convergents(y, Q) {
  const terms = [];
  let num = y;
  let den = Q;
  while (den !== 0 && terms.length < 12) {
    terms.push(Math.floor(num / den));
    [num, den] = [den, num % den];
  }
  const out = [];
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  for (const a of terms) {
    [h0, h1] = [h1, a * h1 + h0];
    [k0, k1] = [k1, a * k1 + k0];
    out.push({ p: h1, q: k1 });
  }
  return out;
}

// From a measured counting value y, recover the period and try to split N.
export function shorPostProcess(y, t, a, n = SHOR_N) {
  const Q = 2 ** t;
  if (y === 0) return { y, Q, ok: false, reason: 'y = 0 carries no information about the period. Run again.' };
  const fractions = convergents(y, Q).filter((c) => c.q > 1 && c.q < n);
  let r = null;
  for (const { q } of fractions) {
    for (let m = 1; m * q < n; m++) {
      if (modPow(a, m * q, n) === 1) {
        r = m * q;
        break;
      }
    }
    if (r) break;
  }
  if (!r) return { y, Q, fractions, ok: false, reason: 'No period found from this measurement. Run again.' };
  if (r % 2 === 1) return { y, Q, fractions, r, ok: false, reason: `The period r = ${r} is odd. Pick another a.` };
  const half = modPow(a, r / 2, n);
  if (half === n - 1) {
    return { y, Q, fractions, r, half, ok: false, reason: `a^(r/2) ≡ −1 (mod ${n}), which only gives trivial factors. Pick another a.` };
  }
  const f1 = gcd(half - 1, n);
  const f2 = gcd(half + 1, n);
  return { y, Q, fractions, r, half, f1, f2, ok: f1 > 1 && f1 < n };
}
