import assert from 'node:assert/strict';
import test from 'node:test';

import { seededRandom } from '../lib/circuit.js';
import { evolveExact, makeOperator } from '../lib/dynamics.js';
import { compareMethods, qdriftSample, skewedModel } from '../lib/hamsim.js';

const model = skewedModel(3, 12, 5);

test('qDRIFT: the exact channel equals the average over sampled gate sequences, and stays within Campbell’s bound', () => {
  const [n, start, t, N] = [3, 0b011, 1.5, 24];
  const exact = compareMethods({ terms: model, n, start, t, stepsList: [2] }).qdrift[0]; // N·L = 24 samples
  assert.equal(exact.steps, N);
  const op = makeOperator(model, n);
  const er = new Float64Array(8);
  const ei = new Float64Array(8);
  er[start] = 1;
  evolveExact(op, er, ei, t);
  const rng = seededRandom(31);
  const runs = 4000;
  let sum = 0;
  let sum2 = 0;
  for (let r = 0; r < runs; r++) {
    const { re, im } = qdriftSample({ terms: model, n, start, t, N }, rng);
    let or = 0;
    let oi = 0;
    for (let b = 0; b < 8; b++) {
      or += er[b] * re[b] + ei[b] * im[b];
      oi += er[b] * im[b] - ei[b] * re[b];
    }
    const f = or * or + oi * oi;
    sum += f;
    sum2 += f * f;
  }
  const mean = sum / runs;
  const sigma = Math.sqrt((sum2 / runs - mean * mean) / runs);
  assert.ok(Math.abs(1 - exact.infidelity - mean) < 4 * sigma, `${1 - exact.infidelity} vs ${mean} ± ${sigma}`);
  assert.ok(exact.infidelity <= exact.bound);
});

test('Trotter orders 1 and 2 and qDRIFT converge at their expected rates (1/N², 1/N⁴ and 1/N in infidelity)', () => {
  const r = compareMethods({ terms: model, n: 3, start: 0b011, t: 1.5, stepsList: [16, 32] });
  const ratio = (k) => r[k][0].infidelity / r[k][1].infidelity;
  assert.ok(Math.abs(ratio('trotter1') - 4) < 0.6, `order 1: ${ratio('trotter1')}`);
  assert.ok(Math.abs(ratio('trotter2') - 16) < 2.5, `order 2: ${ratio('trotter2')}`);
  assert.ok(Math.abs(ratio('qdrift') - 2) < 0.3, `qDRIFT: ${ratio('qdrift')}`);
  // a Hamiltonian of one term: every method is exact
  const one = compareMethods({ terms: [{ coeff: 0.7, xmask: 0b101, zmask: 0b001 }], n: 3, start: 0, t: 2, stepsList: [3] });
  for (const k of ['trotter1', 'trotter2', 'qdrift']) assert.ok(one[k][0].infidelity < 1e-12);
});
