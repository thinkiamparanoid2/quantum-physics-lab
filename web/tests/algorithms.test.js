import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DJ_ORACLES,
  basisPrep,
  bvCircuit,
  classicalPeriod,
  convergents,
  djCircuit,
  inverseQftOps,
  qftOps,
  qpeCircuit,
  registerProbs,
  registerValue,
  shorCircuit,
  shorPostProcess,
} from '../lib/algorithms.js';
import { probabilities, runOps, seededRandom } from '../lib/circuit.js';

const close = (a, b, what, tol = 1e-10) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);
const range = (n) => Array.from({ length: n }, (_, i) => i);

test('Deutsch-Jozsa: |0...0> has probability 1 for constant and 0 for balanced functions', () => {
  for (const n of [1, 2, 3, 4]) {
    for (const [name, oracle] of Object.entries(DJ_ORACLES)) {
      if (n === 1 && name === 'last') continue;
      for (const reveal of [true, false]) {
        const { ops, at, f } = djCircuit(n, name, reveal);
        const counts = [0, 0];
        for (let x = 0; x < 1 << n; x++) counts[f(x, n)]++;
        const balanced = counts[0] === counts[1];
        assert.equal(balanced, oracle.kind === 'balanced', `${name} is ${oracle.kind}`);
        const { state } = runOps(n + 1, ops, at.interfered);
        const p0 = registerProbs(probabilities(state), range(n))[0];
        close(p0, oracle.kind === 'constant' ? 1 : 0, `n=${n}, ${name}, reveal=${reveal}`);
      }
    }
  }
});

test('Bernstein-Vazirani reads the secret string in one query', () => {
  for (let s = 0; s < 16; s++) {
    const secret = s.toString(2).padStart(4, '0');
    const { ops } = bvCircuit(secret, false);
    const { bits } = runOps(5, ops, ops.length, seededRandom(s));
    assert.equal(range(4).map((q) => bits[q]).join(''), secret);
  }
});

test('QFT matches the discrete Fourier transform, and the inverse undoes it', () => {
  for (const n of [2, 3, 4]) {
    const reg = range(n);
    const N = 1 << n;
    for (let x = 0; x < N; x++) {
      const ops = [...basisPrep(x, reg), ...qftOps(reg)];
      const { state } = runOps(n, ops);
      for (let b = 0; b < N; b++) {
        const y = registerValue(b, reg);
        const angle = (2 * Math.PI * x * y) / N;
        close(state.re[b], Math.cos(angle) / Math.sqrt(N), `n=${n} x=${x} y=${y} re`);
        close(state.im[b], Math.sin(angle) / Math.sqrt(N), `n=${n} x=${x} y=${y} im`);
      }
      const back = runOps(n, [...ops, ...inverseQftOps(reg)]).state;
      const bx = reg.reduce((acc, q, i) => acc | (((x >> (n - 1 - i)) & 1) << q), 0);
      close(back.re[bx], 1, `inverse restores |${x}>`);
    }
  }
});

test('phase estimation: exact binary fractions give a certain answer, others peak nearby', () => {
  for (const t of [3, 4]) {
    for (let k = 0; k < 1 << t; k++) {
      const { ops, at, count } = qpeCircuit(t, k / 2 ** t);
      const probs = registerProbs(probabilities(runOps(t + 1, ops, at.transformed).state), count);
      close(probs[k], 1, `t=${t}, phi=${k}/${2 ** t}`);
    }
  }
  for (const phi of [0.3, 0.71, 0.123]) {
    const t = 4;
    const { ops, at, count } = qpeCircuit(t, phi);
    const probs = registerProbs(probabilities(runOps(t + 1, ops, at.transformed).state), count);
    const nearest = Math.round(phi * 16) % 16;
    assert.ok(probs[nearest] >= 4 / Math.PI ** 2 - 1e-9, `phi=${phi}: P(nearest) = ${probs[nearest]}`);
  }
});

test("Shor's algorithm factors 15", () => {
  assert.deepEqual(convergents(12, 16).map((c) => `${c.p}/${c.q}`), ['0/1', '1/1', '3/4']);
  for (const a of [2, 4, 7, 8, 11, 13, 14]) {
    const r = classicalPeriod(a, 15);
    const { ops, at, count } = shorCircuit(a);
    const probs = registerProbs(probabilities(runOps(8, ops, at.transformed, seededRandom(a)).state), count);
    let total = 0;
    for (let y = 0; y < 16; y++) {
      if (y % (16 / r) === 0) {
        close(probs[y], 1 / r, `a=${a}: P(y=${y})`);
        total += probs[y];
        if (y > 0) {
          const result = shorPostProcess(y, 4, a);
          if (a === 14) {
            assert.equal(result.ok, false, 'a=14 only gives trivial factors');
          } else if (result.ok) {
            assert.deepEqual([result.f1, result.f2].sort((p, q) => p - q), [3, 5], `a=${a}, y=${y}`);
            assert.equal(result.r, r);
          }
        }
      } else {
        close(probs[y], 0, `a=${a}: P(y=${y})`);
      }
    }
    close(total, 1, `a=${a}: peaks carry all the probability`);
    const peaks = range(r).map((k) => (k * 16) / r).filter((y) => y > 0);
    if (a !== 14) assert.ok(peaks.some((y) => shorPostProcess(y, 4, a).ok), `a=${a}: some peak factors 15`);
  }
});
