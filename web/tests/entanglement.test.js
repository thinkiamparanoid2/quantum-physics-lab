import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { GATES, applyGate, ry, seededRandom, zeroState } from '../lib/circuit.js';
import {
  concurrence,
  concurrenceMatrix,
  entanglementEntropy,
  negativity,
  pureConcurrence,
  reducedDensity,
  schmidtCoefficients,
  vonNeumann,
  werner,
} from '../lib/entanglement.js';

const close = (a, b, what, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);
const ref = JSON.parse(readFileSync(new URL('./reference-entanglement.json', import.meta.url), 'utf8'));

function bell() {
  const s = zeroState(2);
  applyGate(s, 0, GATES.H);
  return applyGate(s, 1, GATES.X, [0]);
}

function randomState(n, rng) {
  const s = zeroState(n);
  let norm = 0;
  for (let b = 0; b < s.dim; b++) {
    s.re[b] = rng() - 0.5;
    s.im[b] = rng() - 0.5;
    norm += s.re[b] ** 2 + s.im[b] ** 2;
  }
  for (let b = 0; b < s.dim; b++) {
    s.re[b] /= Math.sqrt(norm);
    s.im[b] /= Math.sqrt(norm);
  }
  return s;
}

test('a Bell pair carries one ebit; a product state none', () => {
  const b = bell();
  close(entanglementEntropy(b, [0]), 1, 'S(Bell)');
  close(concurrence(reducedDensity(b, [0, 1])), 1, 'C(Bell)');
  close(pureConcurrence(b), 1, 'pure C(Bell)');
  close(negativity(reducedDensity(b, [0, 1])), 0.5, 'N(Bell)');
  const p = zeroState(2);
  applyGate(p, 0, ry(1.1));
  applyGate(p, 1, ry(-0.4));
  close(entanglementEntropy(p, [0]), 0, 'S(product)');
  close(concurrence(reducedDensity(p, [0, 1])), 0, 'C(product)');
});

test('cos(t/2)|00> + sin(t/2)|11> has C = sin t and the Schmidt coefficients cos(t/2), sin(t/2)', () => {
  for (const t of [0.3, 1, Math.PI / 2, 2.5]) {
    const s = zeroState(2);
    applyGate(s, 0, ry(t));
    applyGate(s, 1, GATES.X, [0]);
    close(pureConcurrence(s), Math.abs(Math.sin(t)), `C at ${t}`);
    const [a, b] = schmidtCoefficients(s, [0]);
    close(a, Math.max(Math.abs(Math.cos(t / 2)), Math.abs(Math.sin(t / 2))), 'first Schmidt coefficient');
    close(b, Math.min(Math.abs(Math.cos(t / 2)), Math.abs(Math.sin(t / 2))), 'second Schmidt coefficient');
  }
});

test('Wootters concurrence equals 2|ad - bc| for random pure states, and S(A) = S(B)', () => {
  const rng = seededRandom(11);
  for (let k = 0; k < 20; k++) {
    const s = randomState(2, rng);
    close(concurrence(reducedDensity(s, [0, 1])), pureConcurrence(s), 'C', 1e-8);
    close(entanglementEntropy(s, [0]), entanglementEntropy(s, [1]), 'S(A) = S(B)');
  }
});

test('Werner states are entangled only above p = 1/3', () => {
  for (const p of [0, 0.2, 1 / 3, 0.5, 0.8, 1]) {
    close(concurrence(werner(p)), Math.max(0, (3 * p - 1) / 2), `C at p = ${p}`, 1e-8);
    close(negativity(werner(p)), Math.max(0, (3 * p - 1) / 4), `N at p = ${p}`, 1e-10);
  }
});

test('GHZ has no pairwise entanglement; W has C = 2/3 for every pair', () => {
  const ghz = zeroState(3);
  applyGate(ghz, 0, GATES.H);
  applyGate(ghz, 1, GATES.X, [0]);
  applyGate(ghz, 2, GATES.X, [1]);
  const cg = concurrenceMatrix(ghz);
  for (let i = 0; i < 9; i++) close(cg[i], 0, 'GHZ pair', 1e-8);
  close(entanglementEntropy(ghz, [0]), 1, 'GHZ one qubit vs the rest');
  const w = zeroState(3);
  w.re[0] = 0;
  for (const b of [1, 2, 4]) w.re[b] = 1 / Math.sqrt(3);
  const cw = concurrenceMatrix(w);
  close(cw[0 * 3 + 1], 2 / 3, 'W pair 01', 1e-8);
  close(cw[1 * 3 + 2], 2 / 3, 'W pair 12', 1e-8);
});

test('entropies and concurrences match numpy on a random 4-qubit state', () => {
  const s = zeroState(ref.state.n);
  s.re.set(ref.state.re);
  s.im.set(ref.state.im);
  ref.partitions.forEach((part, i) => close(entanglementEntropy(s, part), ref.entropies[i], `S(${part})`, 1e-9));
  const cm = concurrenceMatrix(s);
  ref.pairs.forEach(([a, b], i) => close(cm[a * s.n + b], ref.pairConcurrence[i], `C(${a},${b})`, 1e-8));
  const rho = { dim: 4, re: Float64Array.from(ref.mixed.re), im: Float64Array.from(ref.mixed.im) };
  close(concurrence(rho), ref.mixed.concurrence, 'mixed C', 1e-8);
  close(negativity(rho), ref.mixed.negativity, 'mixed N', 1e-10);
  close(vonNeumann(rho), ref.mixed.entropy, 'mixed S', 1e-10);
});
