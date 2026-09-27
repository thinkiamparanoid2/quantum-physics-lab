import assert from 'node:assert/strict';
import test from 'node:test';

import { applyOp, runOps, ry, rz, seededRandom, applyGate, zeroState } from '../lib/circuit.js';
import {
  blochFromRho,
  chshS,
  classicalStrategies,
  entangleWithEnvironment,
  entropy,
  errorOp,
  evolveNoisy,
  gameWin,
  purity,
  quantumRound,
  reducedQubit,
  repetitionFailure,
  rhoFromBloch,
  shorDecodeOps,
  shorEncodeOps,
} from '../lib/noise.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const BEST = { a0: 0, a1: Math.PI / 2, b0: Math.PI / 4, b1: -Math.PI / 4 };

test('CHSH: classical strategies top out at 3/4, quantum reaches 1/2 + sqrt2/4', () => {
  const best = Math.max(...classicalStrategies().map((s) => s.win));
  close(best, 0.75, 1e-12, 'best classical');
  close(chshS(BEST), 2 * Math.SQRT2, 1e-12, 'Tsirelson bound');
  close(gameWin(BEST), Math.cos(Math.PI / 8) ** 2, 1e-12, 'win = cos^2(pi/8)');
  // simulated rounds on the statevector engine agree
  const rng = seededRandom(2022);
  let wins = 0;
  const N = 40000;
  for (let i = 0; i < N; i++) {
    const x = rng() < 0.5 ? 1 : 0;
    const y = rng() < 0.5 ? 1 : 0;
    const { a, b } = quantumRound(BEST, x, y, rng);
    if ((a ^ b) === (x & y)) wins++;
  }
  close(wins / N, gameWin(BEST), 0.006, 'sampled win rate');
});

test('density matrices: Bloch round trip, purity, entropy, partial trace of a Bell pair', () => {
  const r = [0.3, -0.4, 0.5];
  blochFromRho(rhoFromBloch(r)).forEach((v, k) => close(v, r[k], 1e-12, `component ${k}`));
  close(purity([0, 0, 1]), 1, 1e-12, 'pure');
  close(purity([0, 0, 0]), 0.5, 1e-12, 'maximally mixed');
  close(entropy([0, 0, 0]), 1, 1e-12, 'one bit');
  close(entropy([0, 0, 1]), 0, 1e-12, 'zero');
  const bell = runOps(2, [{ gate: 'H', target: 0 }, { gate: 'X', target: 1, controls: [0] }]).state;
  const rho = reducedQubit(bell, 0);
  close(rho.re[0], 0.5, 1e-12, 'half');
  close(Math.hypot(rho.re[1], rho.im[1]), 0, 1e-12, 'no coherence left');
  // a single-qubit state traced from a product state keeps its Bloch vector
  const s = zeroState(2);
  applyGate(s, 1, ry(1.1));
  applyGate(s, 1, rz(0.7));
  const v = blochFromRho(reducedQubit(s, 1));
  close(v[0], Math.sin(1.1) * Math.cos(0.7), 1e-12, 'x');
  close(v[1], Math.sin(1.1) * Math.sin(0.7), 1e-12, 'y');
  close(v[2], Math.cos(1.1), 1e-12, 'z');
});

test('decoherence: each environment qubit multiplies the coherence by cos(angle/2)', () => {
  for (const [n, angle] of [
    [1, Math.PI],
    [1, 1],
    [4, 0.8],
    [8, 0.5],
  ]) {
    const { bloch } = entangleWithEnvironment(n, angle);
    close(bloch[0], Math.cos(angle / 2) ** n, 1e-12, `${n} qubits at ${angle}`);
    close(bloch[2], 0, 1e-12, 'populations unchanged');
  }
  const v = evolveNoisy([1, 0, 0], 2, { T1: 4, T2: 3 });
  close(v[0], Math.exp(-2 / 3), 1e-12, 'T2 dephasing');
  close(v[2], 1 - Math.exp(-2 / 4), 1e-12, 'T1 relaxation toward |0>');
});

test('repetition code: 3p^2 - 2p^3, and bigger codes help only below p = 1/2', () => {
  for (const p of [0.01, 0.1, 0.3]) close(repetitionFailure(3, p), 3 * p * p - 2 * p ** 3, 1e-15, `d=3 at ${p}`);
  assert.ok(repetitionFailure(7, 0.1) < repetitionFailure(5, 0.1) && repetitionFailure(5, 0.1) < repetitionFailure(3, 0.1));
  assert.ok(repetitionFailure(7, 0.6) > repetitionFailure(3, 0.6));
  close(repetitionFailure(5, 0.5), 0.5, 1e-12, 'break-even at 1/2');
});

test("Shor's code corrects any single-qubit error, including arbitrary rotations", () => {
  const rng = seededRandom(1995);
  for (let trial = 0; trial < 6; trial++) {
    const theta = rng() * Math.PI;
    const phi = rng() * 2 * Math.PI;
    for (const kind of ['none', 'X', 'Y', 'Z', 'R']) {
      for (let q = 0; q < 9; q++) {
        const ops = [{ gate: 'RY', target: 0, angle: theta }, { gate: 'RZ', target: 0, angle: phi }, ...shorEncodeOps()];
        const err = errorOp(kind, q, 0.4 + rng());
        if (err) ops.push(err);
        ops.push(...shorDecodeOps());
        const { state } = runOps(9, ops);
        const v = blochFromRho(reducedQubit(state, 0));
        const want = [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
        v.forEach((c, k) => close(c, want[k], 1e-9, `${kind} on qubit ${q}, component ${k}`));
      }
    }
  }
  // Two bit flips in one block are too many: the majority vote completes them to XXX on the
  // block, which is a logical Z. The message comes back with its x component reversed.
  const ops = [{ gate: 'RY', target: 0, angle: 1 }, ...shorEncodeOps(), { gate: 'X', target: 1 }, { gate: 'X', target: 2 }, ...shorDecodeOps()];
  const v = blochFromRho(reducedQubit(runOps(9, ops).state, 0));
  close(v[0], -Math.sin(1), 1e-9, 'two errors in a block become a logical phase flip');
  close(v[2], Math.cos(1), 1e-9, 'which leaves z alone');
  assert.equal(typeof applyOp, 'function');
});
