import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blochVector, rotateVector, rotationOf } from '../lib/bloch.js';
import { GATES, applyGate, phase, rx, ry, rz, zeroState } from '../lib/circuit.js';

const near = (a, b, what, tol = 1e-12) => {
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) < tol, `${what}: [${a}] vs [${b}]`);
};

test('Bloch vectors of the six cardinal states', () => {
  const cases = [
    [[], [0, 0, 1]],
    [[GATES.X], [0, 0, -1]],
    [[GATES.H], [1, 0, 0]],
    [[GATES.X, GATES.H], [-1, 0, 0]],
    [[GATES.H, GATES.S], [0, 1, 0]],
    [[GATES.H, GATES.SDG], [0, -1, 0]],
  ];
  for (const [gates, expected] of cases) {
    const s = zeroState(1);
    for (const g of gates) applyGate(s, 0, g);
    near(blochVector(s, 0), expected, `after ${gates.length} gates`);
  }
});

test('an entangled qubit has a zero-length Bloch vector', () => {
  const s = applyGate(applyGate(zeroState(2), 0, GATES.H), 1, GATES.X, [0]);
  near(blochVector(s, 0), [0, 0, 0], 'qubit 0 of a Bell pair');
  near(blochVector(s, 1), [0, 0, 0], 'qubit 1 of a Bell pair');
});

test('rotationOf recovers axis and angle, and predicts what the gate does to the arrow', () => {
  const h = rotationOf(GATES.H);
  near(h.axis, [Math.SQRT1_2, 0, Math.SQRT1_2], 'H axis');
  assert.ok(Math.abs(h.angle - Math.PI) < 1e-12);

  const gates = { X: GATES.X, Y: GATES.Y, Z: GATES.Z, H: GATES.H, S: GATES.S, T: GATES.T, rx: rx(0.7), ry: ry(-1.3), rz: rz(2.1), p: phase(0.9) };
  for (const [name, g] of Object.entries(gates)) {
    const s = applyGate(applyGate(applyGate(zeroState(1), 0, ry(0.83)), 0, rz(0.41)), 0, rx(-0.2));
    const before = blochVector(s, 0);
    const { axis, angle } = rotationOf(g);
    applyGate(s, 0, g);
    near(rotateVector(before, axis, angle), blochVector(s, 0), `gate ${name}`, 1e-10);
  }
});
