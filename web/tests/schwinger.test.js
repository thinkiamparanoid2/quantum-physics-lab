import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { applyOperator, makeOperator } from '../lib/dynamics.js';
import { hermitianEigen } from '../lib/linalg.js';
import { lanczosGround, zExpectations } from '../lib/manybody.js';
import { parsePauliSum, toPauliTerms } from '../lib/pauli.js';
import { chargePair, observables, schwingerModel } from '../lib/schwinger.js';
import { schwinger } from '../playground/presets.js';

const ref = JSON.parse(readFileSync(new URL('./reference-schwinger.json', import.meta.url)));

function dense(op) {
  const dim = op.dim;
  const M = new Float64Array(dim * dim);
  const zero = new Float64Array(dim);
  const [or, oi] = [new Float64Array(dim), new Float64Array(dim)];
  for (let b = 0; b < dim; b++) {
    const re = new Float64Array(dim);
    re[b] = 1;
    applyOperator(op, re, zero, or, oi);
    for (let i = 0; i < dim; i++) M[i * dim + b] = or[i];
  }
  return M;
}

test('the Schwinger library equals the playground preset, and its bare vacuum has no particles and no flux', () => {
  const N = 6;
  const mine = schwingerModel(N, { x: 1, mass: 0.5, g: 0.6 });
  const pre = makeOperator(toPauliTerms(parsePauliSum(schwinger(N, 1, 0.5, 0.6).hamiltonian), N), N);
  const a = dense(mine.op);
  const b = dense(pre);
  assert.ok(a.every((v, i) => Math.abs(v - b[i]) < 1e-12));
  const z = zExpectations(N, Float64Array.from({ length: 1 << N }, (_, i) => (i === mine.vacuum ? 1 : 0)));
  const o = observables(mine, z);
  assert.equal(o.total, 0);
  assert.ok(o.field.every((L) => L === 0));
  // with no hopping the bare vacuum is the unique lowest diagonal entry
  const diag = dense(schwingerModel(N, { x: 0, mass: 0.5, g: 0.6 }).op).filter((_, i) => i % ((1 << N) + 1) === 0);
  const min = Math.min(...diag);
  assert.equal(diag.indexOf(min), mine.vacuum);
  assert.equal(diag.filter((v) => Math.abs(v - min) < 1e-12).length, 1);
});

test('Lanczos finds the same ground energy as dense diagonalisation', () => {
  for (const charges of [[], chargePair(6, 3).charges]) {
    const m = schwingerModel(6, { x: 0.7, mass: 0.4, g: 0.9, charges });
    const evals = hermitianEigen(dense(m.op), null, 64).values;
    // the start vector fixes the neutral sector, so compare with the lowest neutral level
    const neutral = [];
    const vecs = hermitianEigen(dense(m.op), null, 64).vectors;
    evals.forEach((e, k) => {
      const w = vecs[k].re.reduce((s, v, i) => s + (popcount(i) === 3 ? v * v : 0), 0);
      if (w > 0.5) neutral.push(e);
    });
    const lz = lanczosGround(m.op, m.vacuum);
    assert.ok(Math.abs(lz.energy - Math.min(...neutral)) < 1e-9, `${lz.energy} vs ${Math.min(...neutral)}`);
  }
});

test('string breaking: ground energies and particle numbers with static charges match an independent bit-string build (numpy)', () => {
  for (const c of ref.ground) {
    const m = schwingerModel(c.N, { x: c.x, mass: c.mass, g: c.g, background: c.background ?? 0, charges: c.charges });
    const r = lanczosGround(m.op, m.vacuum);
    assert.ok(Math.abs(r.energy - c.energy) < 1e-8, `ℓ=${c.length}: ${r.energy} vs ${c.energy}`);
    const o = observables(m, zExpectations(c.N, r.vector));
    assert.ok(Math.abs(o.total - c.particles) < 1e-6, `ℓ=${c.length} particles: ${o.total} vs ${c.particles}`);
  }
  // the potential rises by about g per link, then the string breaks: about two extra particles appear
  const g = ref.ground.filter((c) => c.N === 10);
  const V = (len) => g.find((c) => c.length === len).energy - g.find((c) => c.length === 0).energy;
  assert.ok(Math.abs((V(5) - V(1)) / 4 - 0.5) < 0.05, 'slope ≈ g before breaking');
  assert.ok(V(7) - V(5) < 0.6 * (V(5) - V(3)), 'flattens after breaking (only partly on 10 sites, where ℓ = 7 nearly spans the chain)');
  const n = (len) => g.find((c) => c.length === len).particles;
  assert.ok(n(7) - n(0) > 1.5 && n(5) - n(0) < 0.5);
});

function popcount(x) {
  let c = 0;
  for (; x; x &= x - 1) c++;
  return c;
}
