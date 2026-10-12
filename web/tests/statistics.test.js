import assert from 'node:assert/strict';
import test from 'node:test';

import { ZETA3, chemicalPotential, fermiEnergy, levels, occupation, totalN, trapTc } from '../lib/statistics.js';

const close = (a, b, what, tol) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);

test('the chemical potential reproduces the particle number for all three statistics', () => {
  const lv = levels('trap', 200);
  for (const kind of ['fermi', 'bose', 'classical']) {
    for (const T of [0.5, 3, 20]) {
      const mu = chemicalPotential(kind, lv, 300, T);
      close(totalN(kind, lv, mu, T), 300, `${kind} T=${T}`, 1e-6);
    }
  }
});

test('at high temperature Fermi–Dirac and Bose–Einstein both approach Boltzmann', () => {
  const lv = levels('ladder', 4000);
  const T = 400;
  const N = 20;
  const occ = (kind) => {
    const mu = chemicalPotential(kind, lv, N, T);
    return occupation(kind, (lv[0].E - mu) / T);
  };
  const f = occ('fermi');
  const b = occ('bose');
  const c = occ('classical');
  assert.ok(f < 0.06 && b < 0.06, 'dilute');
  close(f / c, 1, 'FD/MB', 0.03);
  close(b / c, 1, 'BE/MB', 0.03);
});

test('Sommerfeld: fermions in a 3D trap have μ ≈ E_F [1 − (π²/3)(T/E_F)²]', () => {
  const N = 1e6;
  const lv = levels('trap', 400);
  const EF = Math.cbrt(6 * N); // continuum Fermi energy for g(E) = E²/2
  close(fermiEnergy(lv, N), EF, 'T = 0 Fermi energy', 2.5);
  const T = 15;
  const mu = chemicalPotential('fermi', lv, N, T);
  const predicted = EF * (1 - ((Math.PI ** 2) / 3) * (T / EF) ** 2);
  close(mu, predicted, `μ at T=${T}`, 1.6);
});

test('Bose–Einstein condensation in a trap: N0/N → 1 − (T/Tc)³', () => {
  const N = 2e5;
  const lv = levels('trap', 600);
  const Tc = trapTc(N);
  for (const r of [0.3, 0.6, 0.8]) {
    const T = r * Tc;
    const mu = chemicalPotential('bose', lv, N, T);
    const N0 = occupation('bose', (lv[0].E - mu) / T);
    // leading finite-size correction: -(3 zeta(2) / 2 zeta(3)^(2/3)) (T/Tc)² N^(-1/3)
    const corr = ((3 * (Math.PI ** 2 / 6)) / (2 * ZETA3 ** (2 / 3))) * r * r * N ** (-1 / 3);
    close(N0 / N, 1 - r ** 3 - corr, `N0/N at T = ${r} Tc`, 0.01);
  }
});
