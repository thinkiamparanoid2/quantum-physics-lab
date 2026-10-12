import assert from 'node:assert/strict';
import test from 'node:test';

import { GATES, applyGate, cloneState, runOps, seededRandom } from '../lib/circuit.js';
import { Tableau } from '../lib/stabilizer.js';

const close = (a, b, what, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);

function randomClifford(n, len, rng) {
  const ops = [];
  for (let k = 0; k < len; k++) {
    const r = rng();
    const q = Math.floor(rng() * n);
    if (r < 0.3) ops.push({ gate: 'H', target: q });
    else if (r < 0.5) ops.push({ gate: 'S', target: q });
    else if (r < 0.6) ops.push({ gate: ['X', 'Y', 'Z'][Math.floor(rng() * 3)], target: q });
    else {
      let t = Math.floor(rng() * n);
      if (t === q) t = (t + 1) % n;
      ops.push({ gate: rng() < 0.7 ? 'X' : 'Z', target: t, controls: [q] });
    }
  }
  return ops;
}

// Apply a Pauli string (from Tableau.stabilizers) to a statevector.
function applyPauli(state, str) {
  const s = cloneState(state);
  for (let q = 0; q < str.length - 1; q++) {
    const p = str[q + 1];
    if (p !== 'I') applyGate(s, q, GATES[p]);
  }
  return s;
}

test('every stabilizer the tableau reports leaves the statevector unchanged (random Clifford circuits)', () => {
  const rng = seededRandom(17);
  for (let trial = 0; trial < 40; trial++) {
    const n = 2 + Math.floor(rng() * 4);
    const ops = randomClifford(n, 30, rng);
    const tab = new Tableau(n);
    for (const op of ops) tab.apply(op);
    const { state } = runOps(n, ops);
    for (const str of tab.stabilizers()) {
      const sign = str[0] === '−' ? -1 : 1;
      const after = applyPauli(state, str);
      for (let b = 0; b < state.dim; b++) {
        close(after.re[b], sign * state.re[b], `${str} re[${b}]`);
        close(after.im[b], sign * state.im[b], `${str} im[${b}]`);
      }
    }
  }
});

test('measurements: deterministic exactly when the statevector says so, with the same outcome', () => {
  const rng = seededRandom(5);
  for (let trial = 0; trial < 40; trial++) {
    const n = 2 + Math.floor(rng() * 4);
    const ops = randomClifford(n, 25, rng);
    const tab = new Tableau(n);
    for (const op of ops) tab.apply(op);
    const { state } = runOps(n, ops);
    for (let q = 0; q < n; q++) {
      let p1 = 0;
      for (let b = 0; b < state.dim; b++) if ((b >> q) & 1) p1 += state.re[b] ** 2 + state.im[b] ** 2;
      const m = tab.clone().measure(q, () => 0.3);
      if (p1 < 1e-9 || p1 > 1 - 1e-9) {
        assert.equal(m.random, false, 'deterministic');
        assert.equal(m.outcome, p1 > 0.5 ? 1 : 0, 'deterministic outcome');
      } else {
        close(p1, 0.5, 'Clifford states give 50/50 when not deterministic');
        assert.equal(m.random, true, 'random');
      }
    }
  }
});

test('Pauli expectations: ±1 for stabilizer elements, 0 otherwise (Bell and GHZ)', () => {
  const bell = new Tableau(2);
  bell.h(0);
  bell.cnot(0, 1);
  assert.equal(bell.expectation({ x: [0, 1] }), 1, 'XX');
  assert.equal(bell.expectation({ z: [0, 1] }), 1, 'ZZ');
  assert.equal(bell.expectation({ x: [0, 1], z: [0, 1] }), -1, 'YY = −1 on |Φ+⟩');
  assert.equal(bell.expectation({ z: [0] }), 0, 'Z alone is random');
  const ghz = new Tableau(5);
  ghz.h(0);
  for (let q = 1; q < 5; q++) ghz.cnot(q - 1, q);
  assert.equal(ghz.expectation({ x: [0, 1, 2, 3, 4] }), 1, 'XXXXX');
  assert.equal(ghz.expectation({ z: [1, 3] }), 1, 'Z1 Z3');
});

test('the tableau handles hundreds of qubits: a 300-qubit GHZ state measures all-equal', () => {
  const n = 300;
  const t = new Tableau(n);
  t.h(0);
  for (let q = 1; q < n; q++) t.cnot(q - 1, q);
  const rng = seededRandom(2);
  const first = t.measure(0, rng);
  assert.equal(first.random, true);
  for (let q = 1; q < n; q += 37) {
    const m = t.measure(q, rng);
    assert.equal(m.random, false);
    assert.equal(m.outcome, first.outcome);
  }
});

test('the canonical generators describe the same state (each one stabilizes the statevector)', () => {
  const rng = seededRandom(23);
  for (let trial = 0; trial < 20; trial++) {
    const n = 2 + Math.floor(rng() * 4);
    const ops = randomClifford(n, 30, rng);
    const tab = new Tableau(n);
    for (const op of ops) tab.apply(op);
    const { state } = runOps(n, ops);
    for (const str of tab.canonicalStabilizers()) {
      const sign = str[0] === '−' ? -1 : 1;
      const after = applyPauli(state, str);
      for (let b = 0; b < state.dim; b++) close(after.re[b], sign * state.re[b], `${str} re[${b}]`);
    }
  }
});
