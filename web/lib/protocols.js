// Circuits for the protocol lessons, and a BB84 simulation in which every photon is a real
// qubit prepared, (possibly) intercepted and measured with the circuit engine.

import { runOps } from './circuit.js';

// Qubit 0: Alice's message, prepared as cos(t/2)|0> + e^{i phi} sin(t/2)|1>.
// Qubits 1 and 2: the shared Bell pair (Alice holds 1, Bob holds 2).
export const TELEPORT = {
  prepared: 2,
  paired: 4,
  entangled: 5,
  hadamard: 6,
  measured: 8,
  corrected: 10,
};

export function teleportOps(theta, phi) {
  return [
    { gate: 'RY', target: 0, angle: theta },
    { gate: 'P', target: 0, angle: phi },
    { gate: 'H', target: 1 },
    { gate: 'X', target: 2, controls: [1] },
    { gate: 'X', target: 1, controls: [0] },
    { gate: 'H', target: 0 },
    { gate: 'MEASURE', target: 0, bit: 0 },
    { gate: 'MEASURE', target: 1, bit: 1 },
    { gate: 'X', target: 2, if: { bit: 1, value: 1 } },
    { gate: 'Z', target: 2, if: { bit: 0, value: 1 } },
  ];
}

export function messageVector(theta, phi) {
  return [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
}

// Qubit 0 is Alice's half of the Bell pair, qubit 1 is Bob's. To send bits b1 b2 Alice applies
// X if b2 = 1, then Z if b1 = 1. Bob decodes with CNOT, H and measures b1 on qubit 0, b2 on 1.
export function superdenseOps(message) {
  const [b1, b2] = message.split('').map(Number);
  const encode = [];
  if (b2) encode.push({ gate: 'X', target: 0 });
  if (b1) encode.push({ gate: 'Z', target: 0 });
  const ops = [
    { gate: 'H', target: 0 },
    { gate: 'X', target: 1, controls: [0] },
    ...encode,
    { gate: 'X', target: 1, controls: [0] },
    { gate: 'H', target: 0 },
    { gate: 'MEASURE', target: 0, bit: 0 },
    { gate: 'MEASURE', target: 1, bit: 1 },
  ];
  return { ops, paired: 2, encoded: 2 + encode.length, decoded: 4 + encode.length, measured: 6 + encode.length };
}

// ----- BB84 -----
// Basis '+' measures |0>/|1>; basis 'x' measures |+>/|->.

function sendAndMeasure(bit, prepBasis, measureBasis, rng) {
  const ops = [];
  if (bit) ops.push({ gate: 'X', target: 0 });
  if (prepBasis === 'x') ops.push({ gate: 'H', target: 0 });
  if (measureBasis === 'x') ops.push({ gate: 'H', target: 0 });
  ops.push({ gate: 'MEASURE', target: 0, bit: 0 });
  return runOps(1, ops, ops.length, rng).bits[0];
}

export function runBB84({ count, eve = false, noise = 0, rng = Math.random }) {
  const pick = () => (rng() < 0.5 ? '+' : 'x');
  const rows = [];
  for (let i = 0; i < count; i++) {
    const aliceBit = rng() < 0.5 ? 0 : 1;
    const aliceBasis = pick();
    let bit = aliceBit;
    let basis = aliceBasis;
    let eveBasis = null;
    let eveBit = null;
    if (eve) {
      eveBasis = pick();
      eveBit = sendAndMeasure(bit, basis, eveBasis, rng);
      bit = eveBit;
      basis = eveBasis;
    }
    const bobBasis = pick();
    let bobBit = sendAndMeasure(bit, basis, bobBasis, rng);
    const flipped = noise > 0 && rng() < noise;
    if (flipped) bobBit ^= 1;
    rows.push({ aliceBit, aliceBasis, eveBasis, eveBit, bobBasis, bobBit, match: aliceBasis === bobBasis, flipped });
  }
  const sifted = rows.filter((r) => r.match);
  const errors = sifted.filter((r) => r.aliceBit !== r.bobBit).length;
  return { rows, sifted: sifted.length, errors, qber: sifted.length ? errors / sifted.length : 0 };
}

// Chance an intercept-and-resend eavesdropper survives k compared key bits unnoticed.
export function eveEscapes(k) {
  return 0.75 ** k;
}
