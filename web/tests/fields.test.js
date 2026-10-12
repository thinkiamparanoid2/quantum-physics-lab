import assert from 'node:assert/strict';
import test from 'node:test';

import { chainModes, chainModesNumerical, energyOf, fluctuations, twoOscillatorsExact, twoOscillatorsFock } from '../lib/fields.js';

test('chain normal modes: ω_k² = w₀² + 4 sin²(q_k/2) matches diagonalising the spring matrix, and the modes are orthonormal', () => {
  for (const [N, w0] of [
    [5, 0],
    [8, 0.7],
    [13, 1.2],
  ]) {
    const modes = chainModes(N, w0);
    const num = chainModesNumerical(N, w0);
    modes.forEach((m, i) => assert.ok(Math.abs(m.omega - num[i]) < 1e-10));
    for (const a of modes) for (const b of modes) {
      const dot = a.shape.reduce((s, v, j) => s + v * b.shape[j], 0);
      assert.ok(Math.abs(dot - (a === b ? 1 : 0)) < 1e-12);
    }
  }
});

test('two coupled quantum oscillators in a truncated Fock basis have exactly the phonon spectrum ω₊(n₊ + ½) + ω₋(n₋ + ½)', () => {
  const values = twoOscillatorsFock(12, 1, 0.6);
  twoOscillatorsExact(1, 0.6, 10).forEach((x, i) => assert.ok(Math.abs(values[i] - x.E) < 1e-5, `level ${i}: ${values[i]} vs ${x.E}`));
  // stronger coupling needs more quanta in the basis: the error falls fast as the cutoff grows
  const exact = twoOscillatorsExact(0.8, 1.5, 10);
  const worst = (nmax) => {
    const v = twoOscillatorsFock(nmax, 0.8, 1.5);
    return Math.max(...exact.map((x, i) => Math.abs(v[i] - x.E)));
  };
  const [e8, e14] = [worst(8), worst(14)];
  assert.ok(e14 < 1e-4 && e14 < e8 / 100, `cutoff 8: ${e8}, cutoff 14: ${e14}`);
});

test('zero-point energy and fluctuations: ⟨u²⟩ grows by 1/ω per phonon added to a mode where it is large', () => {
  const modes = chainModes(6, 0.5);
  const E0 = energyOf(modes, []);
  assert.ok(Math.abs(E0 - modes.reduce((s, m) => s + m.omega / 2, 0)) < 1e-12);
  assert.ok(Math.abs(energyOf(modes, [0, 2]) - E0 - 2 * modes[1].omega) < 1e-12);
  const s0 = fluctuations(modes, []);
  const s1 = fluctuations(modes, [1]);
  s0.forEach((v, j) => assert.ok(Math.abs(s1[j] ** 2 - v ** 2 - modes[0].shape[j] ** 2 / modes[0].omega) < 1e-12));
});
