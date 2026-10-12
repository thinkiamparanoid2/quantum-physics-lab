// Steane's seven-qubit code [[7,1,3]] as a gate-level circuit: encode, an error, syndrome
// extraction with six ancillas, correction conditioned on the syndrome, and decoding.
//
// The checks come from the Hamming parity-check matrix: data qubit i belongs to row k when bit k of
// (i + 1) is set, so a single error on qubit i lights up the binary number i + 1.
//   rows: k = 0 -> qubits 0,2,4,6;  k = 1 -> 1,2,5,6;  k = 2 -> 3,4,5,6
// Each row is both a Z-type check (finds X errors) and an X-type check (finds Z errors): a CSS code.
// Encoder: the message sits on qubit 2. CNOTs copy it onto 4 and 5 ({2,4,5} is a logical X), then
// H on the pivots 0, 1, 3 and CNOTs from each pivot to the rest of its row superpose all checks.

export const ROWS = [0, 1, 2].map((k) => [0, 1, 2, 3, 4, 5, 6].filter((i) => ((i + 1) >> k) & 1));
const PIVOT = [0, 1, 3];
export const MESSAGE = 2;
const X = (t, c) => ({ gate: 'X', target: t, controls: c === undefined ? undefined : [c] });

export function encodeOps() {
  const ops = [X(4, MESSAGE), X(5, MESSAGE)];
  for (const p of PIVOT) ops.push({ gate: 'H', target: p });
  ROWS.forEach((row, k) => row.filter((q) => q !== PIVOT[k]).forEach((q) => ops.push(X(q, PIVOT[k]))));
  return ops.map((op) => (op.controls === undefined ? { gate: op.gate, target: op.target } : op));
}

// Ancillas 7, 8, 9 measure the Z checks (bits 7..9); 10, 11, 12 the X checks (bits 10..12).
export function syndromeOps() {
  const ops = [];
  ROWS.forEach((row, k) => row.forEach((q) => ops.push({ gate: 'X', target: 7 + k, controls: [q] })));
  ROWS.forEach((row, k) => {
    const a = 10 + k;
    ops.push({ gate: 'H', target: a });
    row.forEach((q) => ops.push({ gate: 'X', target: q, controls: [a] }));
    ops.push({ gate: 'H', target: a });
  });
  for (let a = 7; a < 13; a++) ops.push({ gate: 'MEASURE', target: a, bit: a });
  return ops;
}

// Fix: an X error on qubit i makes the Z-check bits read i + 1 in binary; likewise for Z errors.
export function correctionOps() {
  const ops = [];
  for (const [gate, base] of [
    ['X', 7],
    ['Z', 10],
  ]) {
    for (let i = 0; i < 7; i++) {
      const v = i + 1;
      ops.push({ gate, target: i, if: [0, 1, 2].map((k) => ({ bit: base + k, value: (v >> k) & 1 })) });
    }
  }
  return ops;
}

export function decodeOps() {
  return encodeOps()
    .slice()
    .reverse(); // every gate here is its own inverse
}

// The whole circuit; `at` marks where each stage ends.
export function steaneCircuit({ theta, phi, error = 'none', qubit = 0 }) {
  const prep = [
    { gate: 'RY', target: MESSAGE, angle: theta },
    { gate: 'P', target: MESSAGE, angle: phi },
  ];
  const enc = encodeOps();
  const err = error === 'none' ? [] : [{ gate: error, target: qubit, label: `${error}!` }];
  const syn = syndromeOps();
  const fix = correctionOps();
  const dec = decodeOps();
  const ops = [...prep, ...enc, ...err, ...syn, ...fix, ...dec];
  const at = { prepared: prep.length };
  at.encoded = at.prepared + enc.length;
  at.error = at.encoded + err.length;
  at.zChecks = at.error + 3 * 4; // the CNOTs of the three Z checks, 4 each
  at.syndrome = at.error + syn.length;
  at.fixed = at.syndrome + fix.length;
  at.decoded = at.fixed + dec.length;
  return { ops, at };
}
