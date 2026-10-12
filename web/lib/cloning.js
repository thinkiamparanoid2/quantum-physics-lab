// Copying quantum states, and sharing entanglement.
//   cnotCopy: the naive copier |x>|0> -> |x>|x>. Perfect for |0> and |1>, but it entangles a
//             superposition with its "copy" instead of duplicating it.
//   optimalClone: the Buzek-Hillery universal cloner. Each output has Bloch vector (2/3) r, so
//             fidelity 5/6 for every input, the best any machine can do.
//   monogamy: the Coffman-Kundu-Wootters budget for three qubits, C_AB^2 + C_AC^2 <= C_A(BC)^2.

import { GATES, applyGate, phase, ry, zeroState } from './circuit.js';
import { blochOfRho, concurrence, reducedDensity } from './entanglement.js';

export function inputState(theta, phi, n) {
  const s = zeroState(n);
  applyGate(s, 0, ry(theta));
  applyGate(s, 0, phase(phi));
  return s;
}

export const blochAt = (theta, phi) => [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];

// Fidelity of a qubit with Bloch vector r_out against the pure input with Bloch vector r_in.
export const fidelity = (rIn, rOut) => (1 + rIn[0] * rOut[0] + rIn[1] * rOut[1] + rIn[2] * rOut[2]) / 2;

export function cnotCopy(theta, phi) {
  const s = inputState(theta, phi, 2);
  applyGate(s, 1, GATES.X, [0]);
  return s;
}

// Qubits: 0 = original slot / copy A, 1 = blank / copy B, 2 = the machine's own qubit.
// The cloner maps (index = copyA + 2 copyB + 4 machine)
//   |0> -> sqrt(2/3)|00>|0> + sqrt(1/6)(|01> + |10>)|1>
//   |1> -> sqrt(2/3)|11>|1> + sqrt(1/6)(|01> + |10>)|0>
export function optimalClone(theta, phi) {
  const a = Math.cos(theta / 2); // amplitude of |0>
  const br = Math.sin(theta / 2) * Math.cos(phi); // amplitude of |1>
  const bi = Math.sin(theta / 2) * Math.sin(phi);
  const r23 = Math.sqrt(2 / 3);
  const r16 = Math.sqrt(1 / 6);
  const s = zeroState(3);
  s.re[0] = 0;
  const add = (idx, w, re, im) => {
    s.re[idx] += w * re;
    s.im[idx] += w * im;
  };
  add(0, r23, a, 0); // |0 0>|0>
  add(2 + 4, r16, a, 0); // |0 1>|1>
  add(1 + 4, r16, a, 0); // |1 0>|1>
  add(1 + 2 + 4, r23, br, bi); // |1 1>|1>
  add(2, r16, br, bi); // |0 1>|0>
  add(1, r16, br, bi); // |1 0>|0>
  return s;
}

export function copies(state) {
  return [0, 1].map((q) => blochOfRho(reducedDensity(state, [q])));
}

// CKW monogamy for a three-qubit pure state, seen from each qubit:
// C²(X, Y) + C²(X, Z) <= C²(X, YZ) = 4 det rho_X, and the gap is the three-tangle (the same from
// every qubit for pure states).
export function monogamy(state) {
  const c2 = (a, b) => concurrence(reducedDensity(state, [a, b])) ** 2;
  const pair = { '01': c2(0, 1), '02': c2(0, 2), '12': c2(1, 2) };
  const views = [0, 1, 2].map((x) => {
    const [y, z] = [0, 1, 2].filter((q) => q !== x);
    const rho = reducedDensity(state, [x]);
    const det = rho.re[0] * rho.re[3] - (rho.re[1] ** 2 + rho.im[1] ** 2);
    const withRest = 4 * det;
    const a = pair[[x, y].sort().join('')];
    const b = pair[[x, z].sort().join('')];
    return { x, y, z, withY: a, withZ: b, withRest, tangle: withRest - a - b };
  });
  return { pair, views };
}

export function ghzWMix(angle) {
  const s = zeroState(3);
  s.re[0] = Math.cos(angle) / Math.SQRT2;
  s.re[7] = Math.cos(angle) / Math.SQRT2;
  for (const b of [1, 2, 4]) s.re[b] = Math.sin(angle) / Math.sqrt(3);
  return s;
}
