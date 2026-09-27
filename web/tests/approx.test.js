import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bestGaussian,
  boxPairDensity,
  gaussianTrialEnergy,
  kpBands,
  kronigPenney,
  meanSquaredSeparation,
  perturbed,
  wkbLevel,
  wkbTransmission,
} from '../lib/approx.js';
import { eigenstates, makeGrid, potentialFrom, transmission } from '../lib/wave.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('Kronig-Penney bands agree with the levels of a long chain of wells', () => {
  const p = { V0: 4, a: 1, b: 0.4 };
  const bands = kpBands(p, 12);
  assert.ok(bands.length >= 2, 'at least two bands');
  // f(E) crosses +-1 at the band edges
  for (const [lo, hi] of bands.slice(0, 2)) {
    close(Math.abs(kronigPenney(lo, p)), 1, 1e-6, 'lower edge');
    if (hi < 12) close(Math.abs(kronigPenney(hi, p)), 1, 1e-6, 'upper edge');
  }
  // 12 wells between hard walls: the lowest 12 levels all fall inside (or at the edge of) band 1
  const cells = 12;
  const period = p.a + p.b;
  const L = cells * period + p.b;
  const g = makeGrid(3000, 0, L);
  const V = potentialFrom(g, (x) => ((x % period) < p.b ? p.V0 : 0));
  const levels = eigenstates(V, g.dx, 13).map((s) => s.E);
  const [lo, hi] = bands[0];
  for (let k = 0; k < cells; k++) assert.ok(levels[k] > lo - 0.03 && levels[k] < hi + 0.03, `level ${k} = ${levels[k]} in [${lo}, ${hi}]`);
  assert.ok(levels[12] > hi + 0.1, 'the next level is across the gap');
});

test('identical particles: fermions avoid each other, bosons bunch, same state forbidden for fermions', () => {
  const dist = meanSquaredSeparation(1, 2, 'distinguishable');
  const bos = meanSquaredSeparation(1, 2, 'bosons');
  const fer = meanSquaredSeparation(1, 2, 'fermions');
  assert.ok(fer > dist && dist > bos, `fermions ${fer} > distinguishable ${dist} > bosons ${bos}`);
  // exchange term: <(x1-x2)^2>_{S/A} = <...>_d -/+ 2 <x>_{12}^2 with <x>_12 = -16 L / (9 pi^2) for n = 1, 2
  const x12 = -16 / (9 * Math.PI * Math.PI);
  close(bos, dist - 2 * x12 * x12, 1e-4, 'bosons');
  close(fer, dist + 2 * x12 * x12, 1e-4, 'fermions');
  const pauli = boxPairDensity(2, 2, 'fermions', 1, 50);
  assert.ok(pauli.every((v) => v === 0), 'two fermions cannot share a level');
  const diag = boxPairDensity(1, 3, 'fermions', 1, 51);
  for (let i = 0; i < 51; i++) close(diag[i * 51 + i], 0, 1e-15, 'no two fermions at the same place');
});

test('perturbation theory: a linear field on the oscillator shifts every level by -F^2/2 at second order', () => {
  const g = makeGrid(1200, -14, 14);
  const V = potentialFrom(g, (x) => (x * x) / 2);
  const states = eigenstates(V, g.dx, 40);
  const W = Float64Array.from(g.x, (x) => x);
  for (const n of [0, 1, 3]) {
    const r = perturbed(states, W, g.dx, n, 0.3);
    close(r.first, 0, 1e-9, `first order vanishes for level ${n}`);
    close(r.second, -0.5, 2e-3, `second order coefficient for level ${n}`);
    // exact: shifted oscillator, E = n + 1/2 - F^2/2
    const exact = eigenstates(potentialFrom(g, (x) => (x * x) / 2 + 0.3 * x), g.dx, n + 1)[n].E;
    close(r.order2, exact, 3e-3, `second order vs exact for level ${n}`);
  }
});

test('variational method: exact for the oscillator, an upper bound for the quartic well', () => {
  const osc = bestGaussian((x) => (x * x) / 2);
  close(osc.E, 0.5, 1e-6, 'oscillator ground energy');
  close(osc.s, Math.SQRT1_2, 1e-4, 'width of the true ground state');
  const quartic = (x) => x ** 4;
  const g = makeGrid(1500, -6, 6);
  const exact = eigenstates(potentialFrom(g, quartic), g.dx, 1)[0].E;
  const v = bestGaussian(quartic);
  assert.ok(v.E >= exact - 1e-6, 'never below the true ground state');
  close(v.E, exact, 0.025 * exact, 'within 2.5%');
  assert.ok(gaussianTrialEnergy(quartic, 0.2) > v.E && gaussianTrialEnergy(quartic, 1.5) > v.E, 'minimum really is a minimum');
});

test('WKB: exact for the oscillator, close for a V-shaped well, and a tunnelling estimate', () => {
  for (const n of [0, 1, 5]) close(wkbLevel((x) => (x * x) / 2, n), n + 0.5, 2e-3, `oscillator level ${n}`);
  const vee = (x) => Math.abs(x);
  const g = makeGrid(3000, -30, 30);
  const exact = eigenstates(potentialFrom(g, vee), g.dx, 8).map((s) => s.E);
  // WKB error shrinks for higher levels
  const err0 = Math.abs(wkbLevel(vee, 0, { range: [-30, 30] }) - exact[0]) / exact[0];
  const err7 = Math.abs(wkbLevel(vee, 7, { range: [-30, 30] }) - exact[7]) / exact[7];
  assert.ok(err0 < 0.1 && err7 < 0.005 && err7 < err0, `errors ${err0}, ${err7}`);
  // tunnelling through a thick barrier: WKB exponent matches the exact result's slope
  const tg = makeGrid(4000, -10, 10);
  const barrier = (x) => (Math.abs(x) < 2 ? 2 : 0);
  const exactT = transmission(potentialFrom(tg, barrier), tg.dx, 0.5).T;
  const est = wkbTransmission(barrier, 0.5, [-10, 10]);
  assert.ok(est / exactT > 0.2 && est / exactT < 5, `same order of magnitude: ${est} vs ${exactT}`);
});
