// Single-qubit quantum channels: Kraus operators, their action on density matrices and on the
// Bloch ball, and Stinespring dilations (the same channel as a unitary circuit on the qubit plus an
// environment that is then ignored). A 2x2 complex matrix is { re: [a, b, c, d], im: [...] }.

import { GATES } from './circuit.js';

const m = (re, im = [0, 0, 0, 0]) => ({ re, im });
const scale = (k, s) => m(k.re.map((v) => v * s), k.im.map((v) => v * s));

export const CHANNELS = {
  identity: { label: 'No noise' },
  depolarizing: { label: 'Depolarizing' },
  bitflip: { label: 'Bit flip' },
  phaseflip: { label: 'Phase flip' },
  amplitude: { label: 'Amplitude damping (T₁)' },
  dephasing: { label: 'Phase damping (T₂)' },
};

// Kraus operators for strength p in [0, 1].
//   depolarizing: rho -> (1 - p) rho + p I/2
//   bitflip / phaseflip: with probability p apply X / Z
//   amplitude: |1> decays to |0> with probability p (gamma)
//   dephasing: K0 = diag(1, sqrt(1 - p)), K1 = diag(0, sqrt(p))
export function kraus(name, p) {
  const I = m([1, 0, 0, 1]);
  switch (name) {
    case 'depolarizing':
      return [scale(I, Math.sqrt(1 - (3 * p) / 4)), scale(GATES.X, Math.sqrt(p / 4)), scale(GATES.Y, Math.sqrt(p / 4)), scale(GATES.Z, Math.sqrt(p / 4))];
    case 'bitflip':
      return [scale(I, Math.sqrt(1 - p)), scale(GATES.X, Math.sqrt(p))];
    case 'phaseflip':
      return [scale(I, Math.sqrt(1 - p)), scale(GATES.Z, Math.sqrt(p))];
    case 'amplitude':
      return [m([1, 0, 0, Math.sqrt(1 - p)]), m([0, Math.sqrt(p), 0, 0])];
    case 'dephasing':
      return [m([1, 0, 0, Math.sqrt(1 - p)]), m([0, 0, 0, Math.sqrt(p)])];
    default:
      return [I];
  }
}

// 2x2 complex helpers
function mul(a, b) {
  const re = [0, 0, 0, 0];
  const im = [0, 0, 0, 0];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 2; k++) {
        re[i * 2 + j] += a.re[i * 2 + k] * b.re[k * 2 + j] - a.im[i * 2 + k] * b.im[k * 2 + j];
        im[i * 2 + j] += a.re[i * 2 + k] * b.im[k * 2 + j] + a.im[i * 2 + k] * b.re[k * 2 + j];
      }
    }
  }
  return { re, im };
}

const dag = (a) => m([a.re[0], a.re[2], a.re[1], a.re[3]], [-a.im[0], -a.im[2], -a.im[1], -a.im[3]]);

// sum_k K_k^dagger K_k (the identity for a trace-preserving channel)
export function completeness(ks) {
  return ks.reduce((acc, k) => {
    const t = mul(dag(k), k);
    return m(acc.re.map((v, i) => v + t.re[i]), acc.im.map((v, i) => v + t.im[i]));
  }, m([0, 0, 0, 0]));
}

// rho -> sum_k K rho K^dagger
export function applyChannel(ks, rho) {
  return ks.reduce(
    (acc, k) => {
      const t = mul(mul(k, rho), dag(k));
      return m(acc.re.map((v, i) => v + t.re[i]), acc.im.map((v, i) => v + t.im[i]));
    },
    m([0, 0, 0, 0]),
  );
}

export const rhoOf = ([x, y, z]) => m([(1 + z) / 2, x / 2, x / 2, (1 - z) / 2], [0, -y / 2, y / 2, 0]);
export const blochOf = (rho) => [2 * rho.re[1], -2 * rho.im[1], rho.re[0] - rho.re[3]];

// The channel as an affine map of the Bloch ball: r -> M r + c (M row-major 3x3).
export function blochMap(ks) {
  const c = blochOf(applyChannel(ks, rhoOf([0, 0, 0])));
  const M = new Array(9).fill(0);
  [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ].forEach((e, j) => {
    const out = blochOf(applyChannel(ks, rhoOf(e)));
    for (let i = 0; i < 3; i++) M[i * 3 + j] = out[i] - c[i];
  });
  return { M, c };
}

export const mapVector = ({ M, c }, r) => [0, 1, 2].map((i) => M[i * 3] * r[0] + M[i * 3 + 1] * r[1] + M[i * 3 + 2] * r[2] + c[i]);

// Stinespring dilation as circuit ops on qubit 0 (the system) and environment qubits 1 (and 2),
// all starting in |0>. Tracing out the environment afterwards gives exactly the channel.
export function dilationOps(name, p) {
  const t = 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, p))));
  switch (name) {
    case 'bitflip':
      return { env: 1, ops: [{ gate: 'RY', target: 1, angle: t, label: 'env' }, { gate: 'X', target: 0, controls: [1] }] };
    case 'phaseflip':
      return { env: 1, ops: [{ gate: 'RY', target: 1, angle: t }, { gate: 'Z', target: 0, controls: [1] }] };
    case 'amplitude':
      return { env: 1, ops: [{ gate: 'RY', target: 1, angle: t, controls: [0] }, { gate: 'X', target: 0, controls: [1] }] };
    case 'dephasing':
      return { env: 1, ops: [{ gate: 'RY', target: 1, angle: t, controls: [0] }] };
    case 'depolarizing': {
      // The environment holds which Pauli (I, X, Z, XZ ~ Y) happened, with weights 1 - 3p/4, p/4, p/4, p/4.
      const a = Math.sqrt(Math.max(0, 1 - (3 * p) / 4));
      const b = Math.sqrt(p / 4);
      return {
        env: 2,
        ops: [
          {
            gate: 'BLOCK',
            targets: [1, 2],
            label: 'env',
            apply: (s) => {
              // |e1 e2> amplitudes a, b, b, b on the environment (system amplitudes untouched)
              const out = { re: new Float64Array(s.dim), im: new Float64Array(s.dim) };
              const amp = [a, b, b, b];
              for (let x = 0; x < 2; x++) {
                for (let e = 0; e < 4; e++) {
                  const idx = x | (e << 1);
                  out.re[idx] = s.re[x] * amp[e];
                  out.im[idx] = s.im[x] * amp[e];
                }
              }
              s.re.set(out.re);
              s.im.set(out.im);
            },
          },
          { gate: 'X', target: 0, controls: [1] },
          { gate: 'Z', target: 0, controls: [2] },
        ],
      };
    }
    default:
      return { env: 1, ops: [] };
  }
}

// Prepare a pure input state with Bloch angles (theta, phi) on qubit 0 of a fresh register.
export function inputOps(theta, phi) {
  return [
    { gate: 'RY', target: 0, angle: theta },
    { gate: 'P', target: 0, angle: phi },
  ];
}

