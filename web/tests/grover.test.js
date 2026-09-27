// Checks the gate engine and Grover's search against closed-form results.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GATES, applyGate, applyToAll, cloneState, ket, probabilities, sampleOutcome, zeroState } from '../lib/circuit.js';
import {
  analyticSuccess,
  diffuser,
  groverAngle,
  groverSteps,
  optimalRounds,
  planeCoordinates,
} from '../lib/grover.js';

const close = (a, b, what, tol = 1e-12) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);

function norm2(s) {
  let t = 0;
  for (let b = 0; b < s.dim; b++) t += s.re[b] ** 2 + s.im[b] ** 2;
  return t;
}

test('gates: H twice is identity, X flips the right qubit, CNOT makes a Bell state', () => {
  const s = zeroState(3);
  applyToAll(s, GATES.H);
  applyToAll(s, GATES.H);
  close(s.re[0], 1, 'H H |000>');

  const x = applyGate(zeroState(3), 1, GATES.X);
  close(x.re[0b010], 1, 'X on qubit 1 sets bit 1');
  assert.equal(ket(0b010, 3), '|010⟩');

  const bell = applyGate(applyGate(zeroState(2), 0, GATES.H), 1, GATES.X, [0]);
  close(bell.re[0b00], Math.SQRT1_2, 'Bell |00>');
  close(bell.re[0b11], Math.SQRT1_2, 'Bell |11>');
  close(bell.re[0b01] ** 2 + bell.re[0b10] ** 2, 0, 'Bell has no |01>, |10>');
});

test('gates preserve the norm, including complex and controlled ones', () => {
  const s = zeroState(4);
  const sequence = [['H', 0], ['T', 0], ['H', 2], ['Y', 1, [0]], ['S', 3, [1, 2]], ['H', 3], ['X', 2, [3]]];
  for (const [g, q, c] of sequence) applyGate(s, q, GATES[g], c);
  close(norm2(s), 1, 'norm');
});

test('diffuser reflects every amplitude about the average', () => {
  const s = zeroState(3);
  const values = [0.3, -0.1, 0.5, 0.2, -0.4, 0.1, 0.35, -0.25];
  values.forEach((v, b) => (s.re[b] = v));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const out = diffuser(cloneState(s));
  values.forEach((v, b) => close(out.re[b], 2 * mean - v, `amplitude ${b}`));
});

test('success probability after k rounds is sin^2((2k+1) theta)', () => {
  for (const [n, marked] of [[2, [3]], [3, [5]], [4, [1, 7, 12]], [5, [0]], [6, [9, 40]]]) {
    const N = 1 << n;
    const set = new Set(marked);
    const steps = groverSteps(n, set, 6);
    for (const step of steps.filter((s) => s.kind === 'diffuse' || s.kind === 'superpose')) {
      close(step.success, analyticSuccess(N, set.size, step.round), `n=${n}, M=${set.size}, k=${step.round}`);
    }
  }
});

test('optimal rounds reach the first (fewest-queries) peak of the success probability', () => {
  for (let n = 2; n <= 6; n++) {
    const N = 1 << n;
    for (let M = 1; M < N; M++) {
      // The probability keeps oscillating; later peaks can be marginally higher but cost more
      // oracle calls, so compare only within the first half-period, (2k+1) theta <= pi.
      const theta = groverAngle(N, M);
      let best = 0;
      for (let k = 0; k === 0 || (2 * k + 1) * theta <= Math.PI; k++) best = Math.max(best, analyticSuccess(N, M, k));
      close(analyticSuccess(N, M, optimalRounds(N, M)), best, `N=${N}, M=${M}`, 1e-9);
    }
  }
  assert.equal(optimalRounds(8, 1), 2);
  assert.equal(optimalRounds(64, 1), 6);
});

test('the state stays in the Grover plane and rotates by 2 theta per round', () => {
  const n = 4;
  const marked = new Set([6, 11]);
  const theta = groverAngle(16, 2);
  for (const step of groverSteps(n, marked, 5)) {
    if (step.kind !== 'diffuse' && step.kind !== 'superpose') continue;
    const { x, y } = planeCoordinates(step.amps, marked);
    close(x * x + y * y, 1, `in plane after round ${step.round}`);
    const angle = (2 * step.round + 1) * theta;
    close(x, Math.cos(angle), `x after round ${step.round}`);
    close(y, Math.sin(angle), `y after round ${step.round}`);
  }
});

test('step sequence and sampling', () => {
  const steps = groverSteps(3, new Set([5]), 2);
  assert.deepEqual(steps.map((s) => s.kind), ['start', 'superpose', 'oracle', 'diffuse', 'oracle', 'diffuse', 'measure']);
  const probs = probabilities(zeroState(2));
  assert.equal(sampleOutcome(probs, 0.999), 0);
  assert.equal(sampleOutcome([0.25, 0.25, 0.5], 0.6), 2);
});
