import assert from 'node:assert/strict';
import test from 'node:test';

import { bandEnergies, exactDecay, firstOrder, goldenRate, lorentzian, selfEnergyShift, survival } from '../lib/decay.js';

const close = (a, b, what, tol) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);

test('first-order perturbation theory matches the exact evolution while the level is barely depleted', () => {
  const V = 0.004;
  const E = bandEnergies(41, 0.05);
  const psi = exactDecay(V, E);
  for (const t of [5, 20]) {
    const st = psi(t);
    // first order neglects the depletion of |0>, a relative error of order the probability lost
    const lost = 1 - (st.re[0] ** 2 + st.im[0] ** 2);
    E.forEach((w, k) => {
      const p1 = firstOrder(V, w, t);
      close(st.re[k + 1] ** 2 + st.im[k + 1] ** 2, p1, `P_${k} at t=${t}`, 1.5 * lost * p1 + 1e-9);
    });
  }
});

test('Fermi’s golden rule: the level decays as e^{−Γt} with Γ = 2πV²/δ', () => {
  const V = 0.02;
  const delta = 0.01;
  const E = bandEnergies(201, delta);
  const G = goldenRate(V, delta);
  const times = [10, 20, 40, 60];
  const P = survival(V, E, times);
  times.forEach((t, i) => close(P[i], Math.exp(-G * t), `P0(${t})`, 0.02));
});

test('a finite band gives the probability back at the recurrence time 2π/δ', () => {
  const V = 0.02;
  const delta = 0.01;
  const E = bandEnergies(201, delta);
  const [late, recur] = survival(V, E, [0.5 * (2 * Math.PI) / delta, (2 * Math.PI) / delta]);
  assert.ok(recur > 10 * late, `recurrence ${recur} should exceed ${late}`);
});

test('a level far outside the band does not decay', () => {
  const E = bandEnergies(101, 0.02, 3); // band from about 2 to 4, level at 0
  const [p] = survival(0.02, E, [200]);
  assert.ok(p > 0.99, `survival ${p}`);
});

test('after the decay the band holds a Lorentzian of width Γ (shifted by the band’s self-energy)', () => {
  const V = 0.02;
  const delta = 0.01;
  const N = 201;
  const E = bandEnergies(N, delta);
  const G = goldenRate(V, delta);
  const W = (N / 2) * delta;
  const st = exactDecay(V, E)(12 / G);
  for (const k of [100, 95, 90, 110, 120, 140]) {
    const p = st.re[k + 1] ** 2 + st.im[k + 1] ** 2;
    const shifted = E[k] - selfEnergyShift(V, 1 / delta, W, E[k]);
    const want = lorentzian(V, shifted, G);
    assert.ok(Math.abs(p - want) < 0.02 * want, `level ${k} (E = ${E[k].toFixed(2)}): ${p} vs ${want}`);
    // the plain Lorentzian is already within 15% this close to the centre
    assert.ok(Math.abs(p - lorentzian(V, E[k], G)) < 0.15 * want, `plain Lorentzian, level ${k}`);
  }
});
