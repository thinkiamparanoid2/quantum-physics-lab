import assert from 'node:assert/strict';
import { test } from 'node:test';

import { qftOps } from '../lib/algorithms.js';
import { blochVector } from '../lib/bloch.js';
import { GATES, applyGate, runOps, seededRandom, zeroState } from '../lib/circuit.js';
import { messageVector, teleportOps } from '../lib/protocols.js';
import { decode, encode, fromOps, setCell, toOps } from '../lib/sandbox.js';

const close = (a, b, what, tol = 1e-10) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);

test('encode and decode round-trip, including angles', () => {
  const model = { n: 3, cols: [[{ g: 'H', q: 0 }], [{ g: 'C', q: 0 }, { g: 'X', q: 2 }], [{ g: 'RY', q: 1, a: -Math.PI / 4 }]] };
  const text = encode(model);
  assert.equal(text, 'n=3&c=H0/C0_X2/RY1@-45');
  const back = decode(`#${text}`);
  assert.equal(back.n, 3);
  assert.equal(back.cols[1].length, 2);
  close(back.cols[2][0].a, -Math.PI / 4, 'angle');
  assert.equal(decode('#n=9&c=H0'), null, 'too many qubits');
  assert.deepEqual(decode('#n=2&c=H0_Q1_X5').cols, [[{ g: 'H', q: 0 }]], 'unknown gates and out-of-range qubits are dropped');
});

test('a control dot plus X makes a Bell pair', () => {
  const model = decode('#n=2&c=H0/C0_X1');
  const { state } = runOps(2, toOps(model).ops);
  close(state.re[0b00], Math.SQRT1_2, '|00>');
  close(state.re[0b11], Math.SQRT1_2, '|11>');
});

test('controlled swap works and malformed columns produce warnings', () => {
  for (let input = 0; input < 8; input++) {
    const prep = [0, 1, 2].filter((q) => (input >> q) & 1).map((q) => ({ g: 'X', q }));
    const model = { n: 3, cols: [prep, [{ g: 'C', q: 0 }, { g: 'W', q: 1 }, { g: 'W', q: 2 }]] };
    const { state } = runOps(3, toOps(model).ops);
    const b1 = (input >> 1) & 1;
    const b2 = (input >> 2) & 1;
    const expected = input & 1 ? (input & 1) | (b2 << 1) | (b1 << 2) : input;
    close(state.re[expected] ** 2 + state.im[expected] ** 2, 1, `Fredkin on input ${input}`);
  }
  assert.equal(toOps({ n: 2, cols: [[{ g: 'W', q: 0 }]] }).warnings.length, 1);
  assert.equal(toOps({ n: 2, cols: [[{ g: 'C', q: 0 }]] }).warnings.length, 1);
});

test('lesson circuits survive the trip into the sandbox', () => {
  const reg = [0, 1, 2];
  const direct = runOps(3, [{ gate: 'X', target: 0 }, ...qftOps(reg)]).state;
  const viaSandbox = runOps(3, toOps(fromOps(3, [{ gate: 'X', target: 0 }, ...qftOps(reg)])).ops).state;
  for (let b = 0; b < 8; b++) {
    close(viaSandbox.re[b], direct.re[b], `QFT re ${b}`);
    close(viaSandbox.im[b], direct.im[b], `QFT im ${b}`);
  }

  const theta = 1.3;
  const phi = 0.7;
  const model = fromOps(3, teleportOps(theta, phi));
  assert.ok(model, 'teleportation converts (classical control becomes a control dot)');
  for (let s = 0; s < 6; s++) {
    const { state } = runOps(3, toOps(model).ops, undefined, seededRandom(s));
    const v = blochVector(state, 2);
    messageVector(theta, phi).forEach((m, i) => close(v[i], m, `teleported component ${i}, seed ${s}`));
  }
  assert.equal(fromOps(2, [{ gate: 'BLOCK', targets: [0, 1], label: 'U', apply() {} }]), null);
});

test('setCell keeps one cell per wire per column and trims empty columns', () => {
  const model = { n: 2, cols: [] };
  setCell(model, 2, 0, { g: 'H' });
  assert.equal(model.cols.length, 3);
  setCell(model, 2, 0, { g: 'X' });
  assert.deepEqual(model.cols[2], [{ g: 'X', q: 0 }]);
  setCell(model, 2, 0, null);
  assert.equal(model.cols.length, 0);
  const s = applyGate(zeroState(1), 0, GATES.H);
  close(s.re[1], Math.SQRT1_2, 'sanity');
});
