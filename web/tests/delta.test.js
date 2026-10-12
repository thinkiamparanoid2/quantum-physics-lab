import assert from 'node:assert/strict';
import test from 'node:test';

import { boundEnergy, boundState, doubleDeltaLevels, doubleDeltaState, scattering } from '../lib/delta.js';
import { eigenstates, makeGrid, transmission } from '../lib/wave.js';

const close = (a, b, what, tol) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);

// A delta function on a grid: one cell of depth alpha/dx.
function gridDelta(grid, alpha, centres) {
  const V = new Float64Array(grid.n);
  for (const c of centres) V[grid.x.findIndex((x) => x > c - grid.dx / 2)] -= alpha / grid.dx;
  return V;
}

test('the bound state has E = −α²/2, is normalised and has the derivative jump −2α ψ(0)', () => {
  const alpha = 1.3;
  let n = 0;
  for (let i = -200000; i <= 200000; i++) n += boundState(i * 1e-4, alpha) ** 2 * 1e-4;
  close(n, 1, 'norm', 1e-6);
  const h = 1e-6;
  const jump = (boundState(h, alpha) - boundState(0, alpha)) / h - (boundState(0, alpha) - boundState(-h, alpha)) / h;
  close(jump, -2 * alpha * boundState(0, alpha), 'kink', 1e-4);
  const grid = makeGrid(6000, -15, 15);
  const [ground, next] = eigenstates(gridDelta(grid, alpha, [0]), grid.dx, 2);
  close(ground.E, boundEnergy(alpha), 'grid ground energy', 5e-3);
  assert.ok(next.E > 0, 'only one bound state');
});

test('transmission is k²/(k² + α²) for attractive and repulsive spikes alike', () => {
  const grid = makeGrid(6000, -6, 6);
  for (const alpha of [0.8, -0.8, 1.5]) {
    for (const E of [0.2, 0.9, 2.5]) {
      const k = Math.sqrt(2 * E);
      const exact = scattering(k, Math.abs(alpha)).T;
      const numeric = transmission(gridDelta(grid, alpha, [0]), grid.dx, E).T;
      close(numeric, exact, `α=${alpha} E=${E}`, 4e-3);
      const s = scattering(k, alpha);
      close(s.T + s.R, 1, 'T + R', 1e-12);
    }
  }
});

test('the double delta has an even level, and an odd one only when αa > 1/2, matching the grid solver', () => {
  const alpha = 1;
  for (const a of [0.3, 1.2]) {
    const lv = doubleDeltaLevels(alpha, a);
    assert.equal(lv.odd === null, alpha * a <= 0.5, `odd state at a=${a}`);
    const grid = makeGrid(8000, -20, 20);
    const states = eigenstates(gridDelta(grid, alpha, [-a, a]), grid.dx, 2);
    close(states[0].E, lv.even.E, `even level a=${a}`, 6e-3);
    if (lv.odd) close(states[1].E, lv.odd.E, `odd level a=${a}`, 6e-3);
    else assert.ok(states[1].E > -1e-3, 'no second bound state');
    // the analytic state is normalised
    const xs = Array.from({ length: 40001 }, (_, i) => -20 + i * 1e-3);
    const st = doubleDeltaState(xs, alpha, a, 'even');
    close(st.psi.reduce((s, v) => s + v * v * 1e-3, 0), 1, 'norm', 1e-4);
  }
});
