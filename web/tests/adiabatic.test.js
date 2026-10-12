import assert from 'node:assert/strict';
import test from 'node:test';

import { berryLoop, landauZener, lzProbability, wrap } from '../lib/adiabatic.js';

const close = (a, b, what, tol) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);

test('a Landau–Zener sweep jumps diabatically with probability exp(−πΔ²/2α)', () => {
  for (const [Delta, alpha] of [
    [1, 1],
    [1, 4],
    [0.5, 0.3],
    [1, 0.5],
  ]) {
    const T = 60 / Math.sqrt(alpha) + (10 * Delta) / alpha;
    const { diabatic } = landauZener({ Delta, alpha, T, steps: 40000 });
    close(diabatic, lzProbability(Delta, alpha), `Δ=${Delta} α=${alpha}`, 0.01);
  }
});

test('a slow sweep follows the ground state (adiabatic theorem); a sudden one stays put', () => {
  const slow = landauZener({ Delta: 1, alpha: 0.05, T: 200, steps: 40000 });
  assert.ok(slow.excited < 1e-3, `slow sweep excited ${slow.excited}`);
  const fast = landauZener({ Delta: 1, alpha: 200, T: 2, steps: 40000 });
  assert.ok(fast.diabatic > 0.98, `fast sweep stayed ${fast.diabatic}`);
});

test('Berry’s phase: a slow loop adds −Ω/2 on top of the dynamic phase', () => {
  for (const theta of [0.4, 1, Math.PI / 2, 2.2]) {
    const r = berryLoop({ B: 4, theta, Tloop: 400, steps: 80000 });
    assert.ok(r.fidelity > 0.999, 'returns to the start state');
    close(wrap(r.total - r.dynamic - r.geometric), 0, `θ=${theta}`, 0.02);
  }
});
