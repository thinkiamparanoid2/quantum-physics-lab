import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GATES, applyGate, ket, ketOrder, measureQubit, runOps, seededRandom, swapQubits, zeroState } from '../lib/circuit.js';
import { formatComplex, formatState, niceReal, percent } from '../lib/format.js';

const close = (a, b, what, tol = 1e-12) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);

test('measurement collapses the state with the right probabilities', () => {
  const s = applyGate(zeroState(1), 0, GATES.H);
  const r0 = measureQubit(structuredClone(s), 0, 0.3);
  assert.equal(r0.outcome, 0);
  close(r0.probability, 0.5, 'P(0)');
  const s1 = structuredClone(s);
  const r1 = measureQubit(s1, 0, 0.7);
  assert.equal(r1.outcome, 1);
  close(s1.re[1], 1, 'collapsed onto |1>');
  close(s1.re[0], 0, 'no |0> left');
});

test('measuring one half of a Bell pair fixes the other half', () => {
  for (const u of [0.1, 0.9]) {
    const { state, bits } = runOps(2, [
      { gate: 'H', target: 0 },
      { gate: 'X', target: 1, controls: [0] },
      { gate: 'MEASURE', target: 0, bit: 0 },
    ], undefined, () => u);
    const other = bits[0] === 0 ? 0b00 : 0b11;
    close(state.re[other] ** 2, 1, `outcome ${bits[0]}`);
  }
});

test('classically controlled gates only fire on the right bit', () => {
  const ops = [
    { gate: 'H', target: 0 },
    { gate: 'MEASURE', target: 0, bit: 0 },
    { gate: 'X', target: 1, if: { bit: 0, value: 1 } },
  ];
  for (const u of [0.2, 0.8]) {
    const { state, bits } = runOps(2, ops, undefined, () => u);
    const expected = bits[0] === 1 ? 0b11 : 0b00;
    close(state.re[expected], 1, `bit ${bits[0]}`);
  }
});

test('ketOrder lists basis states in reading order', () => {
  assert.deepEqual(ketOrder(2).map((b) => ket(b, 2)), ['|00⟩', '|01⟩', '|10⟩', '|11⟩']);
  assert.deepEqual(ketOrder(3).map((b) => ket(b, 3)), ['|000⟩', '|001⟩', '|010⟩', '|011⟩', '|100⟩', '|101⟩', '|110⟩', '|111⟩']);
});

test('swap exchanges qubits and the seeded RNG is repeatable', () => {
  const s = applyGate(zeroState(3), 0, GATES.X);
  swapQubits(s, 0, 2);
  close(s.re[0b100], 1, 'X on q0 moved to q2');
  const a = seededRandom(42);
  const b = seededRandom(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('states are written the way a textbook would', () => {
  const plus = applyGate(zeroState(1), 0, GATES.H);
  assert.equal(formatState(plus.re, plus.im, 1), '(|0⟩ + |1⟩)/√2');
  const minus = applyGate(applyGate(zeroState(1), 0, GATES.X), 0, GATES.H);
  assert.equal(formatState(minus.re, minus.im, 1), '(|0⟩ − |1⟩)/√2');
  const plusI = applyGate(applyGate(zeroState(1), 0, GATES.H), 0, GATES.S);
  assert.equal(formatState(plusI.re, plusI.im, 1), '(|0⟩ + i|1⟩)/√2');
  const bell = applyGate(applyGate(zeroState(2), 0, GATES.H), 1, GATES.X, [0]);
  assert.equal(formatState(bell.re, bell.im, 2), '(|00⟩ + |11⟩)/√2');
  const uniform = zeroState(2);
  applyGate(applyGate(uniform, 0, GATES.H), 1, GATES.H);
  assert.equal(formatState(uniform.re, uniform.im, 2), '(|00⟩ + |01⟩ + |10⟩ + |11⟩)/2');
  assert.equal(formatState(zeroState(2).re, zeroState(2).im, 2), '|00⟩');
  assert.equal(niceReal(-Math.SQRT1_2), '−1/√2');
  assert.equal(formatComplex(0.5, 0.5), '(1/2 + i/2)');
  assert.equal(formatComplex(0, -1), '−i');
  assert.equal(percent(0.5), '50%');
  assert.equal(percent(0.0625), '6.3%');
});
