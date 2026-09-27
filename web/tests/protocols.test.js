import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blochVector } from '../lib/bloch.js';
import { runOps, seededRandom } from '../lib/circuit.js';
import { TELEPORT, messageVector, runBB84, superdenseOps, teleportOps } from '../lib/protocols.js';

const near = (a, b, what, tol = 1e-10) => {
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) < tol, `${what}: [${a}] vs [${b}]`);
};

test('teleportation delivers the message to Bob for every measurement outcome', () => {
  const states = [
    [0, 0],
    [Math.PI, 0],
    [Math.PI / 2, 0],
    [Math.PI / 2, Math.PI / 2],
    [1.1, 2.3],
    [2.7, -0.8],
  ];
  for (const [theta, phi] of states) {
    const ops = teleportOps(theta, phi);
    const seen = new Set();
    // Force each of the four (m0, m1) outcome combinations via the uniform draws.
    for (const [u0, u1] of [[0.001, 0.001], [0.001, 0.999], [0.999, 0.001], [0.999, 0.999]]) {
      const draws = [u0, u1];
      const { state, bits, results } = runOps(3, ops, ops.length, () => draws.shift());
      if (results[6].probability < 1e-9 || results[7].probability < 1e-9) continue;
      seen.add(`${bits[0]}${bits[1]}`);
      near(blochVector(state, 2), messageVector(theta, phi), `theta=${theta}, phi=${phi}, m=${bits[0]}${bits[1]}`);
    }
    assert.equal(seen.size, 4, 'all four outcomes are possible');
  }
});

test("before Bob's correction, his qubit alone carries no information", () => {
  const ops = teleportOps(1.2, 0.4);
  const { state } = runOps(3, ops, TELEPORT.hadamard, seededRandom(1));
  near(blochVector(state, 2), [0, 0, 0], "Bob's qubit before Alice measures");
});

test('superdense coding: Bob always reads the two bits Alice encoded', () => {
  for (const message of ['00', '01', '10', '11']) {
    const { ops } = superdenseOps(message);
    for (let s = 0; s < 5; s++) {
      const { bits } = runOps(2, ops, ops.length, seededRandom(s));
      assert.equal(`${bits[0]}${bits[1]}`, message);
    }
  }
});

test('BB84: no eavesdropper, no errors; intercept-and-resend causes about 25% errors', () => {
  const clean = runBB84({ count: 4000, rng: seededRandom(7) });
  assert.equal(clean.errors, 0);
  assert.ok(Math.abs(clean.sifted / 4000 - 0.5) < 0.03, `sifted fraction ${clean.sifted / 4000}`);

  const tapped = runBB84({ count: 20000, eve: true, rng: seededRandom(8) });
  assert.ok(Math.abs(tapped.qber - 0.25) < 0.015, `QBER with Eve ${tapped.qber}`);

  const noisy = runBB84({ count: 20000, noise: 0.05, rng: seededRandom(9) });
  assert.ok(Math.abs(noisy.qber - 0.05) < 0.01, `QBER from 5% noise ${noisy.qber}`);
});
