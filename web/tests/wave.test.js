// The 1D engine against exact results (hbar = m = 1).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fft } from '../lib/fft.js';
import {
  Propagator,
  barrierTransmission,
  eigenstates,
  gaussianPacket,
  makeGrid,
  momentumDistribution,
  norm,
  positionStats,
  potentialFrom,
  project,
  shootLevel,
  superpose,
  transmission,
} from '../lib/wave.js';

const rel = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);

test('FFT matches a direct DFT and inverts', () => {
  const n = 16;
  const re = Float64Array.from({ length: n }, (_, i) => Math.sin(i * 0.7) + i / 5);
  const im = Float64Array.from({ length: n }, (_, i) => Math.cos(i * 1.3));
  const r2 = Float64Array.from(re);
  const i2 = Float64Array.from(im);
  fft(r2, i2);
  for (let k = 0; k < n; k++) {
    let sr = 0;
    let si = 0;
    for (let j = 0; j < n; j++) {
      const a = (-2 * Math.PI * k * j) / n;
      sr += re[j] * Math.cos(a) - im[j] * Math.sin(a);
      si += re[j] * Math.sin(a) + im[j] * Math.cos(a);
    }
    rel(r2[k], sr, 1e-12, `re[${k}]`);
    rel(i2[k], si, 1e-12, `im[${k}]`);
  }
  fft(r2, i2, true);
  for (let j = 0; j < n; j++) rel(r2[j], re[j], 1e-12, `inverse ${j}`);
});

test('particle in a box: E_n = n^2 pi^2 / (2 L^2), orthonormal states with n-1 nodes', () => {
  const L = 1;
  const g = makeGrid(800, 0, L);
  const states = eigenstates(new Float64Array(g.n), g.dx, 5);
  states.forEach(({ E, psi }, i) => {
    const n = i + 1;
    rel(E, (n * n * Math.PI * Math.PI) / 2, 2e-4, `E_${n}`);
    let nodes = 0;
    for (let j = 1; j < psi.length; j++) if (psi[j] * psi[j - 1] < 0) nodes++;
    assert.equal(nodes, n - 1, `nodes of state ${n}`);
    // Shooting lands on the right wall itself, so it gets the box levels to Numerov accuracy.
    rel(shootLevel(new Float64Array(g.n), g.dx, i, 0, 400), (n * n * Math.PI * Math.PI) / 2, 1e-7, `shooting E_${n}`);
  });
  for (let a = 0; a < 5; a++) {
    for (let b = 0; b < 5; b++) {
      let s = 0;
      for (let j = 0; j < g.n; j++) s += states[a].psi[j] * states[b].psi[j];
      rel(s * g.dx, a === b ? 1 : 0, 1e-8, `<${a}|${b}>`);
    }
  }
});

test('harmonic oscillator: E_n = n + 1/2, and the shooting method agrees', () => {
  const g = makeGrid(1024, -10, 10);
  const V = potentialFrom(g, (x) => (x * x) / 2);
  const states = eigenstates(V, g.dx, 8);
  states.forEach(({ E }, n) => rel(E, n + 0.5, 2e-4, `E_${n}`));
  for (let n = 0; n < 5; n++) rel(shootLevel(V, g.dx, n, 0, 10), n + 0.5, 1e-6, `shooting E_${n}`);
});

test('Gaussian packet: minimum uncertainty, then free spreading as sigma(t) = sigma sqrt(1 + (t / 2 sigma^2)^2)', () => {
  const g = makeGrid(2048, -60, 60);
  const sigma = 1.2;
  const psi = gaussianPacket(g, { x0: -10, sigma, k0: 2 });
  rel(norm(psi, g.dx), 1, 1e-10, 'normalised');
  const x = positionStats(g, psi);
  const p = momentumDistribution(g, psi);
  rel(x.spread, sigma, 1e-6, 'dx');
  rel(p.spread, 1 / (2 * sigma), 1e-4, 'dk');
  rel(x.spread * p.spread, 0.5, 1e-4, 'dx dk = 1/2');
  rel(p.mean, 2, 1e-6, '<k>');

  const prop = new Propagator(g, new Float64Array(g.n), 0.01);
  prop.step(psi, 500);
  const t = 5;
  const later = positionStats(g, psi);
  rel(later.spread, sigma * Math.sqrt(1 + (t / (2 * sigma * sigma)) ** 2), 1e-4, 'spread at t=5');
  rel(later.mean, -10 + 2 * t, 1e-4, 'moves at speed k0');
  rel(norm(psi, g.dx), 1, 1e-9, 'unitary');
});

test('a coherent state in the oscillator swings like a classical ball without spreading', () => {
  const g = makeGrid(1024, -12, 12);
  const V = potentialFrom(g, (x) => (x * x) / 2);
  const psi = gaussianPacket(g, { x0: 3, sigma: Math.SQRT1_2, k0: 0 });
  const prop = new Propagator(g, V, 0.005);
  for (const t of [Math.PI / 2, Math.PI]) {
    const p = gaussianPacket(g, { x0: 3, sigma: Math.SQRT1_2, k0: 0 });
    prop.step(p, Math.round(t / 0.005));
    const s = positionStats(g, p);
    rel(s.mean, 3 * Math.cos(t), 5e-3, `<x>(${t.toFixed(2)})`);
    rel(s.spread, Math.SQRT1_2, 5e-3, `width at ${t.toFixed(2)}`);
  }
  // The same answer from the eigenstate expansion.
  const states = eigenstates(V, g.dx, 40);
  const c = project(states, psi, g.dx);
  const viaModes = positionStats(g, superpose(states, c, Math.PI));
  rel(viaModes.mean, -3, 5e-3, 'eigen-expansion <x>(pi)');
});

test('transmission matches the exact rectangular-barrier formula, below and above the top', () => {
  const g = makeGrid(4000, -20, 20);
  const V0 = 1;
  const a = 1.5;
  const V = potentialFrom(g, (x) => (Math.abs(x) < a / 2 ? V0 : 0));
  for (const E of [0.2, 0.6, 0.95, 1.4, 3]) {
    const { T, R } = transmission(V, g.dx, E);
    rel(T, barrierTransmission(E, V0, a), 3e-3, `T(${E})`);
    rel(T + R, 1, 1e-6, `T + R at ${E}`);
  }
});
