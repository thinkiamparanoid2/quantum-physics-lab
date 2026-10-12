// The HHL algorithm (Harrow, Hassidim & Lloyd 2009) for a 2 × 2 real symmetric system A x = b.
// Qubits: system 0, clock 1 … c (qubit 1 most significant), ancilla c + 1.
//   1. |b⟩ on the system;  2. phase estimation of U = e^{iAt₀} with t₀ = 2π/2^c, so an eigenvalue λ
//   that is a whole number below 2^c is read out exactly as the clock value y = λ;  3. rotate the
//   ancilla by RY(2 arcsin(C/y)) for each clock value;  4. undo the phase estimation;  5. keep runs
//   whose ancilla reads 1: the system is then ∝ A⁻¹|b⟩.

import { inverseQftOps, qftOps } from './algorithms.js';
import { applyGate, runOps } from './circuit.js';

// A with eigenvalues l1, l2 and eigenvectors at angle phi: A = R(φ) diag(l1, l2) R(φ)ᵀ.
export function matrixOf(l1, l2, phi) {
  const [c, s] = [Math.cos(phi), Math.sin(phi)];
  return [
    [l1 * c * c + l2 * s * s, (l1 - l2) * c * s],
    [(l1 - l2) * c * s, l1 * s * s + l2 * c * c],
  ];
}

// e^{iAt} for real symmetric 2 × 2 A, as { re, im } in the GATES layout [a, b, c, d].
function expiAt(A, t) {
  const alpha = (A[0][0] + A[1][1]) / 2;
  const gz = (A[0][0] - A[1][1]) / 2;
  const gx = A[0][1];
  const r = Math.hypot(gx, gz);
  const [cr, sr] = [Math.cos(r * t), r ? Math.sin(r * t) / r : t];
  // e^{iαt} (cos rt + i sin(rt)/r (gx X + gz Z))
  const M = { re: [cr, 0, 0, cr], im: [sr * gz, sr * gx, sr * gx, -sr * gz] };
  const [pr, pi] = [Math.cos(alpha * t), Math.sin(alpha * t)];
  return { re: M.re.map((v, k) => pr * v - pi * M.im[k]), im: M.im.map((v, k) => pr * v + pi * M.re[k]) };
}

function matPow(M, k) {
  let R = { re: [1, 0, 0, 1], im: [0, 0, 0, 0] };
  const mul = (P, Q) => {
    const out = { re: [0, 0, 0, 0], im: [0, 0, 0, 0] };
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        for (let l = 0; l < 2; l++) {
          const [ar, ai, br, bi] = [P.re[2 * i + l], P.im[2 * i + l], Q.re[2 * l + j], Q.im[2 * l + j]];
          out.re[2 * i + j] += ar * br - ai * bi;
          out.im[2 * i + j] += ar * bi + ai * br;
        }
      }
    }
    return out;
  };
  for (let i = 0; i < k; i++) R = mul(R, M);
  return R;
}

export function hhlCircuit({ l1, l2, phi, beta, c }) {
  const A = matrixOf(l1, l2, phi);
  const t0 = (2 * Math.PI) / 2 ** c;
  const U = expiAt(A, t0);
  const clock = Array.from({ length: c }, (_, i) => i + 1);
  const anc = c + 1;
  const C = Math.min(l1, l2, 1); // the rotation needs C ≤ every clock value it acts on
  const prep = [{ gate: 'RY', target: 0, angle: 2 * beta, label: 'b' }, ...clock.map((q) => ({ gate: 'H', target: q }))];
  // clock qubit j (1 = most significant) controls U^{2^(c−j)}
  const qpe = clock.map((q, j) => {
    const P = matPow(U, 2 ** (c - 1 - j));
    return { gate: 'BLOCK', targets: [q, 0], label: `U^${2 ** (c - 1 - j)}`, apply: (s) => applyGate(s, 0, P, [q]) };
  });
  const iqft = inverseQftOps(clock);
  const rotate = {
    gate: 'BLOCK',
    targets: [...clock, anc],
    label: 'RY(2 asin(C/λ))',
    apply: (s) => {
      for (let b = 0; b < s.dim; b++) {
        if ((b >> anc) & 1) continue;
        // clock value, qubit 1 most significant
        let y = 0;
        for (const q of clock) y = (y << 1) | ((b >> q) & 1);
        if (y === 0) continue;
        const th = 2 * Math.asin(Math.min(1, C / y));
        const [cs, sn] = [Math.cos(th / 2), Math.sin(th / 2)];
        const b1 = b | (1 << anc);
        const [r0, i0, r1, i1] = [s.re[b], s.im[b], s.re[b1], s.im[b1]];
        s.re[b] = cs * r0 - sn * r1;
        s.im[b] = cs * i0 - sn * i1;
        s.re[b1] = sn * r0 + cs * r1;
        s.im[b1] = sn * i0 + cs * i1;
      }
    },
  };
  // uncompute: QFT, then the inverse controlled powers
  const qft = qftOps(clock);
  const unqpe = clock
    .map((q, j) => {
      const P = matPow(U, 2 ** (c - 1 - j));
      const Pinv = { re: [P.re[0], P.re[2], P.re[1], P.re[3]], im: [-P.im[0], -P.im[2], -P.im[1], -P.im[3]] }; // P† (P unitary)
      return { gate: 'BLOCK', targets: [q, 0], label: `U^−${2 ** (c - 1 - j)}`, apply: (s) => applyGate(s, 0, Pinv, [q]) };
    })
    .reverse();
  const unprep = clock.map((q) => ({ gate: 'H', target: q }));
  const ops = [...prep, ...qpe, ...iqft, rotate, ...qft, ...unqpe, ...unprep];
  return { ops, A, C, n: c + 2, anc, clock, at: { estimated: prep.length + qpe.length + iqft.length, rotated: prep.length + qpe.length + iqft.length + 1 } };
}

// Run the circuit and postselect the ancilla on 1 with the clock back in |0…0⟩.
export function runHHL(params) {
  const circ = hhlCircuit(params);
  const { state } = runOps(circ.n, circ.ops);
  const anc = 1 << circ.anc;
  let x = [state.re[anc], state.re[anc | 1]];
  let xi = [state.im[anc], state.im[anc | 1]];
  // remove the global phase so the answer can be drawn as a real vector
  const big = Math.hypot(x[0], xi[0]) >= Math.hypot(x[1], xi[1]) ? 0 : 1;
  const ph = Math.atan2(xi[big], x[big]);
  const [c, s] = [Math.cos(ph), Math.sin(ph)];
  [x, xi] = [x.map((v, k) => v * c + xi[k] * s), xi.map((v, k) => v * c - x[k] * s)];
  let success = 0;
  for (let b = 0; b < state.dim; b++) if (b & anc) success += state.re[b] ** 2 + state.im[b] ** 2;
  const norm = Math.hypot(x[0], x[1], xi[0], xi[1]);
  // exact solution
  const { A } = circ;
  const det = A[0][0] * A[1][1] - A[0][1] ** 2;
  const bvec = [Math.cos(params.beta), Math.sin(params.beta)];
  const exact = [(A[1][1] * bvec[0] - A[0][1] * bvec[1]) / det, (-A[0][1] * bvec[0] + A[0][0] * bvec[1]) / det];
  const en = Math.hypot(...exact);
  const fidelity = norm ? ((x[0] * exact[0] + x[1] * exact[1]) ** 2 + (xi[0] * exact[0] + xi[1] * exact[1]) ** 2) / (norm * norm * en * en) : 0;
  // the overall sign of a state is not observable: match it to the exact answer for drawing
  const sign = x[0] * exact[0] + x[1] * exact[1] < 0 ? -1 : 1;
  return { circ, x: [(sign * x[0]) / norm, (sign * x[1]) / norm], xi: [(sign * xi[0]) / norm, (sign * xi[1]) / norm], success, exact: [exact[0] / en, exact[1] / en], exactNorm: en, fidelity };
}

