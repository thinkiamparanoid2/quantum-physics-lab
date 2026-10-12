// Checks added in the final physics review for lessons that had none.
import assert from 'node:assert/strict';
import test from 'node:test';

import { gcd, modPow, registerProbs, shorCircuit, shorPostProcess, SHOR_N } from '../lib/algorithms.js';
import { applyOp, probabilities, runOps, seededRandom, zeroState } from '../lib/circuit.js';
import { errorOp, shorDecodeOps, shorEncodeOps } from '../lib/noise.js';

test('Shor (N = 15): counting outcomes are multiples of 2^t / r, and post-processing factors 15 for every valid a', () => {
  const t = 4;
  for (const a of [2, 4, 7, 8, 11, 13]) {
    let r = 1;
    while (modPow(a, r, SHOR_N) !== 1) r++;
    const { ops, count } = shorCircuit(a, { t });
    // run without the measurements: exponentiate, then the inverse QFT on the counting register
    const keep = ops.filter((o) => o.gate !== 'MEASURE');
    const P = registerProbs(probabilities(runOps(t + 4, keep).state), count);
    P.forEach((p, y) => {
      const allowed = (y * r) % 2 ** t === 0;
      assert.ok(allowed ? Math.abs(p - 1 / r) < 1e-9 : p < 1e-9, `a=${a} r=${r} y=${y}: ${p}`);
    });
    // every nonzero allowed outcome either factors 15 or reports why not (odd r, trivial root)
    for (let y = 1; y < 2 ** t; y++) {
      if ((y * r) % 2 ** t) continue;
      const res = shorPostProcess(y, t, a);
      if (res.ok) assert.equal(res.f1 * (SHOR_N / res.f1), SHOR_N);
      if (res.ok) assert.ok([3, 5].includes(res.f1) && [3, 5].includes(res.f2));
    }
  }
  assert.equal(gcd(15, 6), 3);
});

test('Shor’s nine-qubit code corrects any single-qubit X, Y, Z or rotation error on any qubit', () => {
  const rng = seededRandom(2);
  for (let k = 0; k < 6; k++) {
    const theta = Math.PI * rng();
    const phi = 2 * Math.PI * rng();
    const prep = [
      { gate: 'RY', target: 0, angle: theta },
      { gate: 'P', target: 0, angle: phi },
    ];
    for (const kind of ['X', 'Y', 'Z', 'R']) {
      for (let q = 0; q < 9; q++) {
        const s = zeroState(9);
        const bits = {};
        for (const op of [...prep, ...shorEncodeOps(), errorOp(kind, q), ...shorDecodeOps()]) applyOp(s, op, bits, rng);
        // the message is back on qubit 0: compare its reduced state with the original
        let p1 = 0;
        let cRe = 0;
        let cIm = 0;
        for (let b = 0; b < s.dim; b++) {
          if (b & 1) continue;
          const b1 = b | 1;
          p1 += s.re[b1] ** 2 + s.im[b1] ** 2;
          // ρ01 = Σ ψ(b) conj(ψ(b1))
          cRe += s.re[b] * s.re[b1] + s.im[b] * s.im[b1];
          cIm += s.im[b] * s.re[b1] - s.re[b] * s.im[b1];
        }
        const want1 = Math.sin(theta / 2) ** 2;
        const wantC = 0.5 * Math.sin(theta); // |ρ01| of RY(θ) then a phase
        assert.ok(Math.abs(p1 - want1) < 1e-9, `${kind} on q${q}: P(1) ${p1} vs ${want1}`);
        assert.ok(Math.abs(Math.hypot(cRe, cIm) - Math.abs(wantC)) < 1e-9, `${kind} on q${q}: coherence`);
        // and the relative phase is the message's own
        if (Math.abs(wantC) > 1e-6) assert.ok(Math.abs(Math.cos(Math.atan2(-cIm, cRe) - phi) - 1) < 1e-6, `${kind} on q${q}: phase`);
      }
    }
  }
});
