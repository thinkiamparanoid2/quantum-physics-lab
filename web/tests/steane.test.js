import assert from 'node:assert/strict';
import test from 'node:test';

import { blochVector } from '../lib/bloch.js';
import { runOps, seededRandom } from '../lib/circuit.js';
import { MESSAGE, ROWS, encodeOps, steaneCircuit } from '../lib/steane.js';

const close = (a, b, what, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);

test('the encoder makes |0_L> an equal superposition of the 8 even codewords', () => {
  const { state } = runOps(7, encodeOps());
  const words = [];
  for (let b = 0; b < 128; b++) if (state.re[b] ** 2 > 1e-12) words.push(b);
  assert.equal(words.length, 8);
  for (const w of words) {
    close(state.re[w], 1 / Math.sqrt(8), 'amplitude');
    for (const row of ROWS) assert.equal(row.reduce((s, q) => s ^ ((w >> q) & 1), 0), 0, 'satisfies every check');
  }
});

test('any single X, Y or Z error on any of the 7 qubits is corrected; the message comes back', () => {
  const rng = seededRandom(31);
  for (const error of ['none', 'X', 'Y', 'Z']) {
    for (let qubit = 0; qubit < (error === 'none' ? 1 : 7); qubit++) {
      const theta = rng() * Math.PI;
      const phi = rng() * 2 * Math.PI;
      const { ops, at } = steaneCircuit({ theta, phi, error, qubit });
      const { state, bits } = runOps(13, ops, ops.length, rng);
      const v = blochVector(state, MESSAGE);
      const want = [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
      want.forEach((c, i) => close(v[i], c, `${error} on ${qubit}: component ${i}`));
      // the syndrome names the qubit in binary
      const zs = bits[7] | (bits[8] << 1) | (bits[9] << 2);
      const xs = bits[10] | (bits[11] << 1) | (bits[12] << 2);
      assert.equal(zs, error === 'X' || error === 'Y' ? qubit + 1 : 0, `Z-check syndrome for ${error} on ${qubit}`);
      assert.equal(xs, error === 'Z' || error === 'Y' ? qubit + 1 : 0, `X-check syndrome for ${error} on ${qubit}`);
      assert.ok(at.decoded === ops.length);
    }
  }
});
