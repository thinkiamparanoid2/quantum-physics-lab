// Simon's algorithm. A function f on n bits is two-to-one with f(x) = f(x ⊕ s) for a hidden s ≠ 0.
// The oracle used here: f(x) = x ⊕ x_k s, where k is the lowest set bit of s (then
// f(x ⊕ s) = x ⊕ s ⊕ (x_k ⊕ 1) s = f(x)). Bit strings are integers with bit i = qubit i.
//
// Circuit on 2n qubits (input 0 … n−1, output n … 2n−1): H on the input, the oracle |x⟩|y⟩ →
// |x⟩|y ⊕ f(x)⟩, H on the input, measure the input. Every outcome y satisfies y · s = 0 (mod 2).

const parity = (x) => {
  let p = 0;
  for (; x; x &= x - 1) p ^= 1;
  return p;
};
export const dot = (a, b) => parity(a & b);

export function simonF(n, s) {
  const k = 31 - Math.clz32(s & -s);
  return (x) => x ^ ((x >> k) & 1 ? s : 0);
}

export function simonCircuit(n, s) {
  const k = 31 - Math.clz32(s & -s);
  const input = Array.from({ length: n }, (_, i) => i);
  const oracle = [
    ...input.map((i) => ({ gate: 'X', target: n + i, controls: [i] })), // copy x
    ...input.filter((i) => (s >> i) & 1).map((i) => ({ gate: 'X', target: n + i, controls: [k] })), // ⊕ x_k s
  ];
  const ops = [...input.map((i) => ({ gate: 'H', target: i })), { gate: 'BARRIER' }, ...oracle, { gate: 'BARRIER' }, ...input.map((i) => ({ gate: 'H', target: i }))];
  return { ops, input, oracleLength: oracle.length };
}

// Solve y · s = 0 for every collected y over GF(2): the nonzero s in the null space when the ys
// span an (n − 1)-dimensional space, otherwise null (more samples needed).
export function solveSimon(n, ys) {
  // an XOR basis keyed by leading bit gives the rank of the collected equations
  const basis = new Map();
  for (let y of ys) {
    for (let b = n - 1; b >= 0 && y; b--) {
      if (!((y >> b) & 1)) continue;
      if (basis.has(b)) y ^= basis.get(b);
      else {
        basis.set(b, y);
        break;
      }
    }
  }
  const rank = basis.size;
  if (rank < n - 1) return { s: null, rank };
  // rank n − 1: the null space has exactly one nonzero vector
  for (let s = 1; s < 1 << n; s++) if (ys.every((y) => dot(y, s) === 0)) return { s, rank };
  return { s: null, rank };
}

// Classical search for a collision with queries in a fixed random order: the number of queries
// until two inputs give the same output.
export function classicalQueries(n, s, rng) {
  const f = simonF(n, s);
  const order = Array.from({ length: 1 << n }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const seen = new Map();
  for (let q = 0; q < order.length; q++) {
    const v = f(order[q]);
    if (seen.has(v)) return q + 1;
    seen.set(v, order[q]);
  }
  return order.length;
}
