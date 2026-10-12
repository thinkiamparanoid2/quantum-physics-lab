// Magic states: T-gate injection and 15-to-1 distillation (Bravyi & Kitaev 2005).
//
// The [[15,1,3]] quantum Reed–Muller code. Qubit k (0..14) carries the label k + 1, a nonzero
// 4-bit number. Its four X-type checks are "bit j of the label is set" (weight 8 each); a pattern
// of Z errors is caught unless the XOR of its labels is zero, that is unless it is a codeword of
// the classical Hamming [15,11] code. Undetected even-weight patterns are Z stabilizers (harmless);
// undetected odd-weight ones contain the logical Z̄ = Z^⊗15 and flip the output. The analysis here
// assumes perfect Clifford operations: the only errors are Z errors on the 15 input states (a
// noisy magic state can always be twirled into this form).

export const N = 15;

export const label = (k) => k + 1;

// The four check bits for a set of Z errors (bit mask over the 15 qubits): XOR of their labels.
export function syndromeOf(mask) {
  let s = 0;
  for (let k = 0; k < N; k++) if ((mask >> k) & 1) s ^= label(k);
  return s;
}

export const popcount = (x) => {
  let c = 0;
  for (; x; x &= x - 1) c++;
  return c;
};

// What happens to one batch: rejected, accepted with a good output, or accepted with a flipped one.
export function verdict(mask) {
  if (syndromeOf(mask) !== 0) return 'reject';
  return popcount(mask) % 2 ? 'bad' : 'good';
}

// Weight enumerator of the Hamming [15,11] code (every undetected pattern), by enumerating all
// 2^15 patterns once. A[w] = number of codewords of weight w.
let cached = null;
export function weightEnumerator() {
  if (cached) return cached;
  const A = new Array(N + 1).fill(0);
  for (let mask = 0; mask < 1 << N; mask++) if (syndromeOf(mask) === 0) A[popcount(mask)]++;
  cached = A;
  return A;
}

// Exact performance with independent Z errors of probability p on each input:
//   accept = Σ_w A_w p^w (1 − p)^(15 − w),  out = Σ_{w odd} A_w p^w (1 − p)^(15 − w) / accept.
export function distill(p) {
  const A = weightEnumerator();
  let accept = 0;
  let bad = 0;
  for (let w = 0; w <= N; w++) {
    const term = A[w] * p ** w * (1 - p) ** (N - w);
    accept += term;
    if (w % 2) bad += term;
  }
  return { accept, out: bad / accept, leading: 35 * p ** 3 };
}

// The input error rate at which one round of distillation stops helping (out = in), by bisection.
export function breakEven() {
  let lo = 0.01;
  let hi = 0.5;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (distill(mid).out < mid) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Rounds of distillation (each feeding the next) from input error p: error and expected number of
// raw magic states consumed per output (15 per round, divided by the acceptance probability).
export function levels(p, rounds) {
  const out = [{ error: p, cost: 1 }];
  for (let r = 0; r < rounds; r++) {
    const prev = out[out.length - 1];
    const d = distill(prev.error);
    out.push({ error: d.out, cost: (15 * prev.cost) / d.accept });
  }
  return out;
}

// The code's basis states: |0̄⟩ is the equal superposition of the 16 words spanned by the four
// check rows (weights 0 and 8), |1̄⟩ the same words with every bit flipped (weights 15 and 7).
export function codeWords() {
  const rows = [0, 1, 2, 3].map((j) => {
    let m = 0;
    for (let k = 0; k < N; k++) if ((label(k) >> j) & 1) m |= 1 << k;
    return m;
  });
  const zero = [];
  for (let c = 0; c < 16; c++) {
    let m = 0;
    for (let j = 0; j < 4; j++) if ((c >> j) & 1) m ^= rows[j];
    zero.push(m);
  }
  const all = (1 << N) - 1;
  return { rows, zero, one: zero.map((m) => m ^ all) };
}

// T-gate injection (gate teleportation) on two qubits: the data |ψ⟩ = RY(θ) then P(φ) on qubit 0,
// the magic state T|+⟩ on qubit 1, CNOT data → magic, measure the magic qubit, and apply S if the
// outcome is 1. Either way qubit 0 ends in T|ψ⟩. With `fix` false the S is left out.
export function injectionOps({ theta, phi, fix = true }) {
  const ops = [
    { gate: 'RY', target: 0, angle: theta },
    { gate: 'P', target: 0, angle: phi },
    { gate: 'H', target: 1 },
    { gate: 'T', target: 1 },
    { gate: 'BARRIER' },
    { gate: 'X', target: 1, controls: [0] },
    { gate: 'MEASURE', target: 1, bit: 0 },
  ];
  if (fix) ops.push({ gate: 'S', target: 0, if: { bit: 0, value: 1 } });
  return ops;
}
