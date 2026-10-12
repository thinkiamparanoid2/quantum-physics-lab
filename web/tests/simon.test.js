import assert from 'node:assert/strict';
import test from 'node:test';

import { registerProbs } from '../lib/algorithms.js';
import { probabilities, runOps, seededRandom } from '../lib/circuit.js';
import { dot, simonCircuit, simonF, solveSimon } from '../lib/simon.js';

// registerProbs reads qubit 0 as the most significant bit; Simon's strings use bit i = qubit i
const reverseBits = (v, n) => Array.from({ length: n }, (_, i) => ((v >> i) & 1) << (n - 1 - i)).reduce((a, b) => a | b, 0);

test('Simon: the oracle is two-to-one with period s, and the circuit outputs only y with y·s = 0, uniformly', () => {
  for (const n of [2, 3, 4]) {
    for (let s = 1; s < 1 << n; s++) {
      const f = simonF(n, s);
      for (let x = 0; x < 1 << n; x++) {
        assert.equal(f(x), f(x ^ s));
        for (let z = 0; z < 1 << n; z++) if (z !== x && z !== (x ^ s)) assert.notEqual(f(x), f(z));
      }
      const { ops, input } = simonCircuit(n, s);
      const P = registerProbs(probabilities(runOps(2 * n, ops).state), input);
      for (let v = 0; v < 1 << n; v++) {
        const y = reverseBits(v, n);
        assert.ok(Math.abs(P[v] - (dot(y, s) === 0 ? 2 ** -(n - 1) : 0)) < 1e-12, `n=${n} s=${s} y=${y}`);
      }
    }
  }
});

test('Simon: n − 1 independent outcomes determine s by linear algebra over GF(2)', () => {
  const rng = seededRandom(12);
  for (const n of [3, 4, 5]) {
    for (let s = 1; s < 1 << n; s++) {
      const good = [];
      for (let y = 0; y < 1 << n; y++) if (dot(y, s) === 0) good.push(y);
      const ys = [];
      let result;
      do {
        ys.push(good[Math.floor(rng() * good.length)]);
        result = solveSimon(n, ys);
      } while (!result.s);
      assert.equal(result.s, s);
    }
  }
});
