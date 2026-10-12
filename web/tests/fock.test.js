import assert from 'node:assert/strict';
import test from 'node:test';

import { applyOperator, evolveExact, makeOperator } from '../lib/dynamics.js';
import { applyOp, applyProduct, chainOrbitals, freeDensity, hoppingChainTerms, hoppingPauli, toMasks, vacuum } from '../lib/fock.js';
import { symmetricEigen } from '../lib/linalg.js';

const basisState = (occ) => new Map([[occ.join(','), 1]]);
const allOcc = (M, max) => {
  const out = [];
  const rec = (pre) => {
    if (pre.length === M) return out.push(pre);
    for (let v = 0; v <= max; v++) rec([...pre, v]);
  };
  rec([]);
  return out;
};
// two states equal up to rounding
const close = (a, b) => {
  const keys = new Set([...a.keys(), ...b.keys()]);
  return [...keys].every((k) => Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0)) < 1e-12);
};
const combine = (a, b, sign) => {
  const out = new Map(a);
  for (const [k, v] of b) out.set(k, (out.get(k) ?? 0) + sign * v);
  for (const [k, v] of out) if (Math.abs(v) < 1e-12) out.delete(k);
  return out;
};

test('bosons obey [a_i, a†_j] = δ_ij and fermions {c_i, c†_j} = δ_ij, {c_i, c_j} = 0, on every basis state', () => {
  const M = 3;
  for (const occ of allOcc(M, 3)) {
    for (let i = 0; i < M; i++) {
      for (let j = 0; j < M; j++) {
        const st = basisState(occ);
        const a = (dag, mode) => ({ dag, mode, kind: 'boson' });
        const comm = combine(applyProduct([a(false, i), a(true, j)], st), applyProduct([a(true, j), a(false, i)], st), -1);
        assert.ok(close(comm, i === j ? st : new Map()), `[a_${i}, a†_${j}] on ${occ}`);
      }
    }
  }
  for (const occ of allOcc(4, 1)) {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const st = basisState(occ);
        const c = (dag, mode) => ({ dag, mode, kind: 'fermion' });
        const anti = combine(applyProduct([c(false, i), c(true, j)], st), applyProduct([c(true, j), c(false, i)], st), 1);
        assert.ok(close(anti, i === j ? st : new Map()), `{c_${i}, c†_${j}} on ${occ}`);
        const cc = combine(applyProduct([c(false, i), c(false, j)], st), applyProduct([c(false, j), c(false, i)], st), 1);
        assert.ok(close(cc, new Map()));
      }
    }
  }
  // Pauli exclusion and the exchange sign
  const f = (mode) => ({ dag: true, mode, kind: 'fermion' });
  assert.equal(applyProduct([f(1), f(1)], vacuum(3)).size, 0);
  assert.equal(applyProduct([f(0), f(2)], vacuum(3)).get('1,0,1'), 1);
  assert.equal(applyProduct([f(2), f(0)], vacuum(3)).get('1,0,1'), -1);
});

test('Jordan–Wigner: Z strings times σ± reproduce every fermion matrix element on 4 modes', () => {
  const M = 4;
  const dim = 1 << M;
  for (let j = 0; j < M; j++) {
    // c_j = Z…Z (X_j + i Y_j)/2 as a matrix on qubits (qubit k = bit k = occupation of mode k)
    const zs = Array.from({ length: j }, (_, k) => [k, 'Z']);
    const op = makeOperator(toMasks([{ coeff: 0.5, ops: [...zs, [j, 'X']] }]), M);
    const opY = makeOperator(toMasks([{ coeff: 0.5, ops: [...zs, [j, 'Y']] }]), M);
    for (let b = 0; b < dim; b++) {
      const re = new Float64Array(dim);
      const im = new Float64Array(dim);
      re[b] = 1;
      const [xr, xi, yr, yi] = [new Float64Array(dim), new Float64Array(dim), new Float64Array(dim), new Float64Array(dim)];
      applyOperator(op, re, im, xr, xi);
      applyOperator(opY, re, im, yr, yi);
      // (X + iY)/2 |b⟩: real part xr − yi, imaginary xi + yr
      const occ = Array.from({ length: M }, (_, k) => (b >> k) & 1);
      const want = applyOp(basisState(occ), { dag: false, mode: j, kind: 'fermion' });
      for (let c = 0; c < dim; c++) {
        const k = Array.from({ length: M }, (_, m) => (c >> m) & 1).join(',');
        assert.ok(Math.abs(xr[c] - yi[c] - (want.get(k) ?? 0)) < 1e-12);
        assert.ok(Math.abs(xi[c] + yr[c]) < 1e-12);
      }
    }
  }
  // long-range hopping carries the Z string between the sites
  assert.deepEqual(hoppingPauli(1, 4)[0].ops, [
    [1, 'X'],
    [2, 'Z'],
    [3, 'Z'],
    [4, 'X'],
  ]);
});

test('the qubit chain ½ Σ (XX + YY) has the free-fermion spectrum: sums of −2t cos(kπ/(N+1)) in every particle-number sector', () => {
  const N = 6;
  const op = makeOperator(hoppingChainTerms(N, 1), N);
  const eps = chainOrbitals(N).map((o) => o.energy);
  for (let nf = 0; nf <= N; nf++) {
    const sector = [];
    for (let b = 0; b < 1 << N; b++) if (popcount(b) === nf) sector.push(b);
    const d = sector.length;
    const H = new Float64Array(d * d);
    sector.forEach((b, col) => {
      const re = new Float64Array(1 << N);
      re[b] = 1;
      const [or, oi] = [new Float64Array(1 << N), new Float64Array(1 << N)];
      applyOperator(op, re, new Float64Array(1 << N), or, oi);
      sector.forEach((c, row) => (H[row * d + col] = or[c]));
    });
    const got = symmetricEigen(H, d).values;
    const want = [];
    for (let m = 0; m < 1 << N; m++) if (popcount(m) === nf) want.push(eps.reduce((s, e, k) => s + ((m >> k) & 1 ? e : 0), 0));
    want.sort((a, b) => a - b);
    want.forEach((v, k) => assert.ok(Math.abs(v - got[k]) < 1e-9, `N_f=${nf} level ${k}: ${got[k]} vs ${v}`));
  }
});

test('fermions hopping on qubits spread exactly like free particles (statevector against single-particle orbitals)', () => {
  const N = 8;
  const op = makeOperator(hoppingChainTerms(N, 1), N);
  const sites = [3, 4];
  const re = new Float64Array(1 << N);
  const im = new Float64Array(1 << N);
  re[sites.reduce((m, s) => m | (1 << s), 0)] = 1;
  let now = 0;
  for (const time of [0.5, 1.3, 2.7]) {
    evolveExact(op, re, im, time - now);
    now = time;
    const n = new Float64Array(N);
    for (let b = 0; b < 1 << N; b++) {
      const p = re[b] * re[b] + im[b] * im[b];
      for (let j = 0; j < N; j++) if ((b >> j) & 1) n[j] += p;
    }
    const free = freeDensity(N, sites, time);
    n.forEach((v, j) => assert.ok(Math.abs(v - free[j]) < 1e-9, `t=${time} site ${j}: ${v} vs ${free[j]}`));
  }
});

function popcount(x) {
  let c = 0;
  for (; x; x &= x - 1) c++;
  return c;
}
