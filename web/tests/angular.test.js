import assert from 'node:assert/strict';
import test from 'node:test';

import { add, clebsch, coupledByDiagonalising, mOf, mul, rotationY, spinMatrices, tiltedProbabilities, totalJ, wignerD } from '../lib/angular.js';

const close = (a, b, what, tol = 1e-10) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);
const SPINS = [0.5, 1, 1.5, 2, 3];

test('[Jx, Jy] = i Jz and J² = j(j + 1) for every spin', () => {
  for (const j of SPINS) {
    const { d, Jx, Jy, Jz } = spinMatrices(j);
    const comm = add(mul(Jx, Jy, d), mul(Jy, Jx, d), d, -1);
    for (let i = 0; i < d * d; i++) {
      close(comm.re[i], 0, `Re [Jx,Jy] j=${j}`);
      close(comm.im[i], Jz.re[i], `Im [Jx,Jy] = Jz, j=${j}`);
    }
    const J2 = add(add(mul(Jx, Jx, d), mul(Jy, Jy, d), d), mul(Jz, Jz, d), d);
    for (let r = 0; r < d; r++) for (let c = 0; c < d; c++) close(J2.re[r * d + c], r === c ? j * (j + 1) : 0, `J² j=${j}`);
  }
});

test('the rotation exp(−iβJy) built from eigenvectors equals Wigner’s closed formula', () => {
  for (const j of SPINS) {
    for (const beta of [0.3, 1.2, 2.9]) {
      const d = Math.round(2 * j + 1);
      const R = rotationY(j, beta);
      for (let r = 0; r < d; r++) for (let c = 0; c < d; c++) close(R[r * d + c], wignerD(j, mOf(j, r), mOf(j, c), beta), `j=${j} β=${beta} (${r},${c})`, 1e-9);
      const p = tiltedProbabilities(j, beta);
      close(p.reduce((s, v) => s + v, 0), 1, 'probabilities sum to 1');
    }
  }
  // spin 1/2: P(up) = cos²(β/2), as in the Stern-Gerlach lesson
  close(tiltedProbabilities(0.5, 1)[0], Math.cos(0.5) ** 2, 'spin-1/2 tilt');
});

test('Clebsch–Gordan: textbook values and orthonormality', () => {
  close(clebsch(0.5, 0.5, 0.5, -0.5, 1, 0), Math.SQRT1_2, '<½½;½−½|10>');
  close(clebsch(0.5, 0.5, 0.5, -0.5, 0, 0), Math.SQRT1_2, '<½½;½−½|00>');
  close(clebsch(0.5, -0.5, 0.5, 0.5, 0, 0), -Math.SQRT1_2, '<½−½;½½|00>');
  close(clebsch(1, 1, 0.5, -0.5, 0.5, 0.5), Math.sqrt(2 / 3), '<11;½−½|½½>');
  close(clebsch(1, 0, 0.5, 0.5, 0.5, 0.5), -Math.sqrt(1 / 3), '<10;½½|½½>');
  for (const [j1, j2] of [
    [1, 0.5],
    [1, 1],
    [1.5, 1],
  ]) {
    for (const J of totalJ(j1, j2)) {
      for (const Jp of totalJ(j1, j2)) {
        for (let M = -Math.min(J, Jp); M <= Math.min(J, Jp) + 1e-9; M++) {
          let s = 0;
          for (let m1 = -j1; m1 <= j1 + 1e-9; m1++) s += clebsch(j1, m1, j2, M - m1, J, M) * clebsch(j1, m1, j2, M - m1, Jp, M);
          close(s, J === Jp ? 1 : 0, `orthonormal j1=${j1} j2=${j2} J=${J} J'=${Jp} M=${M}`);
        }
      }
    }
  }
});

test('diagonalising J² gives the allowed J values and the Clebsch–Gordan states (up to sign)', () => {
  for (const [j1, j2] of [
    [0.5, 0.5],
    [1, 0.5],
    [1, 1],
  ]) {
    const { states } = coupledByDiagonalising(j1, j2);
    const d2 = Math.round(2 * j2 + 1);
    const counts = {};
    for (const st of states) counts[st.J] = (counts[st.J] ?? 0) + 1;
    for (const J of totalJ(j1, j2)) assert.equal(counts[J], 2 * J + 1, `multiplicity of J=${J}`);
    for (const st of states) {
      for (let i = 0; i < st.vector.re.length; i++) {
        const m1 = mOf(j1, Math.floor(i / d2));
        const m2 = mOf(j2, i % d2);
        const amp = Math.hypot(st.vector.re[i], st.vector.im[i]);
        close(amp, Math.abs(clebsch(j1, m1, j2, m2, st.J, st.M)), `|CG| j1=${j1} j2=${j2} J=${st.J} M=${st.M}`, 1e-6);
      }
    }
  }
});
