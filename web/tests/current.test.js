import assert from 'node:assert/strict';
import test from 'node:test';

import { Propagator, gaussianPacket, makeGrid, normalize, probabilityBeyond, probabilityCurrent, smoothBarrier } from '../lib/wave.js';

const close = (a, b, what, tol) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);

test('a plane wave e^{ikx} carries current j = k (ħ = m = 1) and a real wave carries none', () => {
  const grid = makeGrid(4000, -20, 20);
  const k = 1.3;
  const plane = { re: Float64Array.from(grid.x, (x) => Math.cos(k * x)), im: Float64Array.from(grid.x, (x) => Math.sin(k * x)) };
  const j = probabilityCurrent(grid, plane);
  close(j[2000], k, 'plane wave', 1e-4);
  const standing = { re: Float64Array.from(grid.x, (x) => Math.cos(k * x)), im: new Float64Array(grid.n) };
  assert.ok(probabilityCurrent(grid, standing).every((v) => Math.abs(v) < 1e-12), 'standing wave');
});

test('the total current of a packet is its mean momentum: ∫ j dx = ħk0/m', () => {
  const grid = makeGrid(4096, -60, 60);
  const psi = normalize(gaussianPacket(grid, { x0: -5, sigma: 3, k0: 1.7 }), grid.dx);
  const total = probabilityCurrent(grid, psi).reduce((s, v) => s + v * grid.dx, 0);
  close(total, 1.7, '∫ j dx', 1e-3);
});

test('continuity: the probability that crosses a gate equals the time integral of j there', () => {
  const grid = makeGrid(4096, -60, 60);
  const V = Float64Array.from(grid.x, smoothBarrier(1.2, 0, 1));
  const dt = 0.01;
  const prop = new Propagator(grid, V, dt);
  const psi = normalize(gaussianPacket(grid, { x0: -15, sigma: 3, k0: 1.4 }), grid.dx);
  const gate = 5;
  const gi = grid.x.findIndex((x) => x > gate);
  const xg = grid.x[gi] - grid.dx / 2;
  const start = probabilityBeyond(grid, psi, xg);
  let flux = 0;
  // the current at the midpoint between grid points gi - 1 and gi, where the gate sits
  const jGate = () => {
    const j = probabilityCurrent(grid, psi);
    return (j[gi - 1] + j[gi]) / 2;
  };
  let jPrev = jGate();
  for (let s = 0; s < 2500; s++) {
    prop.step(psi);
    const j = jGate();
    flux += ((jPrev + j) / 2) * dt;
    jPrev = j;
  }
  close(probabilityBeyond(grid, psi, xg) - start, flux, 'crossed vs ∫ j dt', 1e-3);
});
