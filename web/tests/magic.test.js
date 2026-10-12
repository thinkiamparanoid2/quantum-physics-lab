import assert from 'node:assert/strict';
import test from 'node:test';

import { applyGate, GATES, runOps, seededRandom } from '../lib/circuit.js';
import { breakEven, codeWords, distill, injectionOps, levels, N, popcount, verdict, weightEnumerator } from '../lib/magic.js';

const binom = (n, k) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
};

test('the undetected error patterns are the Hamming [15,11] code: weight enumerator by MacWilliams, 35 of weight 3', () => {
  const A = weightEnumerator();
  // MacWilliams from the dual simplex code (1 word of weight 0, 15 of weight 8):
  // A(z) = [(1 + z)^15 + 15 (1 + z)^7 (1 − z)^8] / 16
  const poly = (a, b) => {
    // coefficients of (1 + z)^a (1 − z)^b
    const c = new Array(a + b + 1).fill(0);
    for (let i = 0; i <= a; i++) for (let j = 0; j <= b; j++) c[i + j] += binom(a, i) * binom(b, j) * (j % 2 ? -1 : 1);
    return c;
  };
  const p1 = poly(15, 0);
  const p2 = poly(7, 8);
  for (let w = 0; w <= N; w++) assert.equal(A[w], (p1[w] + 15 * p2[w]) / 16, `A_${w}`);
  assert.equal(A[3], 35);
  assert.equal(A.reduce((a, b) => a + b, 0), 2048);
});

test('the code states are a valid [[15,1,3]] code, and fifteen T gates act on it as a logical T†', () => {
  const { zero, one } = codeWords();
  assert.ok(zero.every((m) => [0, 8].includes(popcount(m))));
  assert.ok(one.every((m) => [7, 15].includes(popcount(m))));
  // every Z stabilizer (even-weight undetected pattern) has even overlap with every code word
  for (let z = 0; z < 1 << N; z++) {
    if (verdict(z) !== 'good') continue;
    for (const m of [...zero, ...one]) assert.equal(popcount(z & m) % 2, 0);
  }
  // statevector: α|0̄⟩ + β|1̄⟩, apply T to all fifteen qubits, compare with α|0̄⟩ + β e^{−iπ/4}|1̄⟩
  const [ar, ai, br, bi] = [0.6, 0.0, 0.48, 0.64];
  const dim = 1 << N;
  const s = { n: N, dim, re: new Float64Array(dim), im: new Float64Array(dim) };
  for (const m of zero) [s.re[m], s.im[m]] = [ar / 4, ai / 4];
  for (const m of one) [s.re[m], s.im[m]] = [br / 4, bi / 4];
  for (let q = 0; q < N; q++) applyGate(s, q, GATES.T);
  const c = Math.SQRT1_2;
  const [er, ei] = [br * c + bi * c, bi * c - br * c]; // β e^{−iπ/4}
  for (const m of zero) assert.ok(Math.abs(s.re[m] - ar / 4) < 1e-12 && Math.abs(s.im[m] - ai / 4) < 1e-12);
  for (const m of one) assert.ok(Math.abs(s.re[m] - er / 4) < 1e-12 && Math.abs(s.im[m] - ei / 4) < 1e-12);
});

test('15-to-1 distillation: output error → 35p³, acceptance → 1 − 15p, and Monte Carlo agrees', () => {
  for (const p of [1e-4, 1e-3]) {
    const d = distill(p);
    assert.ok(Math.abs(d.out / (35 * p ** 3) - 1) < 50 * p, `p=${p}: ${d.out} vs ${35 * p ** 3}`);
    assert.ok(Math.abs(d.accept - (1 - 15 * p)) < 200 * p * p);
  }
  const rng = seededRandom(17);
  const p = 0.08;
  const shots = 200000;
  let accepted = 0;
  let bad = 0;
  for (let k = 0; k < shots; k++) {
    let mask = 0;
    for (let q = 0; q < N; q++) if (rng() < p) mask |= 1 << q;
    const v = verdict(mask);
    if (v !== 'reject') accepted++;
    if (v === 'bad') bad++;
  }
  const d = distill(p);
  const sa = Math.sqrt((d.accept * (1 - d.accept)) / shots);
  assert.ok(Math.abs(accepted / shots - d.accept) < 4 * sa);
  const so = Math.sqrt((d.out * (1 - d.out)) / accepted);
  assert.ok(Math.abs(bad / accepted - d.out) < 4 * so, `${bad / accepted} vs ${d.out}`);
});

test('distillation helps below a break-even error rate, and two rounds compound', () => {
  const pb = breakEven();
  assert.ok(Math.abs(distill(pb).out - pb) < 1e-9);
  assert.ok(pb > 0.1 && pb < 0.2, `break-even ${pb}`);
  // at p = 1% the exact output is 3% above 35p³ (the next order); each round costs 15 / acceptance
  const [, one, two] = levels(1e-2, 2);
  assert.ok(Math.abs(one.error / 35e-6 - 1) < 0.05);
  assert.ok(Math.abs(two.error / (35 * one.error ** 3) - 1) < 1e-3);
  assert.ok(Math.abs(two.cost - 225 / (distill(1e-2).accept * distill(one.error).accept)) < 1e-9);
});

test('T-gate injection: both measurement outcomes leave T|ψ⟩ (after the S fix), without it outcome 1 gives T†|ψ⟩', () => {
  const rng = seededRandom(4);
  for (let k = 0; k < 20; k++) {
    const theta = Math.PI * rng();
    const phi = 2 * Math.PI * rng();
    const a = [Math.cos(theta / 2), 0];
    const b = [Math.sin(theta / 2) * Math.cos(phi), Math.sin(theta / 2) * Math.sin(phi)];
    const target = (sign) => {
      const c = Math.SQRT1_2;
      return [a, [b[0] * c - sign * b[1] * c, b[1] * c + sign * b[0] * c]]; // T (sign 1) or T† (−1)
    };
    for (const [u, outcome] of [
      [0.01, 0],
      [0.99, 1],
    ]) {
      for (const fix of [true, false]) {
        const { state, bits } = runOps(2, injectionOps({ theta, phi, fix }), undefined, () => u);
        assert.equal(bits[0], outcome);
        const o = outcome << 1;
        const out = [
          [state.re[o], state.im[o]],
          [state.re[o | 1], state.im[o | 1]],
        ];
        const want = target(outcome === 1 && !fix ? -1 : 1);
        // fidelity |⟨want|out⟩|²
        const re = want[0][0] * out[0][0] + want[0][1] * out[0][1] + want[1][0] * out[1][0] + want[1][1] * out[1][1];
        const im = want[0][0] * out[0][1] - want[0][1] * out[0][0] + want[1][0] * out[1][1] - want[1][1] * out[1][0];
        assert.ok(Math.abs(re * re + im * im - 1) < 1e-12, `θ=${theta} φ=${phi} m=${outcome} fix=${fix}`);
      }
    }
  }
});
