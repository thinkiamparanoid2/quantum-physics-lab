import assert from 'node:assert/strict';
import test from 'node:test';

import { applyGate, cloneState, GATES, runOps } from '../lib/circuit.js';
import { anyons, groundState, loopAround, plaquettesInside, toricCode } from '../lib/toric.js';

// rank over GF(2) of a list of bit rows (arrays of 0/1)
function rank(rows) {
  const m = rows.map((r) => r.slice());
  let rk = 0;
  const cols = m[0].length;
  for (let c = 0; c < cols && rk < m.length; c++) {
    const p = m.findIndex((r, k) => k >= rk && r[c]);
    if (p < 0) continue;
    [m[rk], m[p]] = [m[p], m[rk]];
    for (let k = 0; k < m.length; k++) if (k !== rk && m[k][c]) for (let j = 0; j < cols; j++) m[k][j] ^= m[rk][j];
    rk++;
  }
  return rk;
}

test('toric code: stars and plaquettes commute, and 2L² − 2 of them are independent (two logical qubits)', () => {
  for (const L of [3, 4, 5]) {
    const code = toricCode(L);
    for (const s of code.stars) for (const p of code.plaquettes) assert.equal(s.edges.filter((e) => p.edges.includes(e)).length % 2, 0);
    // symplectic rows: X part then Z part
    const rows = [
      ...code.stars.map((s) => Array.from({ length: 2 * code.n }, (_, k) => (k < code.n && s.edges.includes(k) ? 1 : 0))),
      ...code.plaquettes.map((p) => Array.from({ length: 2 * code.n }, (_, k) => (k >= code.n && p.edges.includes(k - code.n) ? 1 : 0))),
    ];
    assert.equal(rank(rows), 2 * L * L - 2);
    // logical pairs anticommute with each other and commute with every check
    const { Z1, X1, Z2, X2 } = code.logicals;
    const overlap = (a, b) => a.filter((e) => b.includes(e)).length % 2;
    assert.equal(overlap(Z1, X1), 1);
    assert.equal(overlap(Z2, X2), 1);
    assert.equal(overlap(Z1, X2), 0);
    assert.equal(overlap(Z2, X1), 0);
    for (const s of code.stars) assert.equal(overlap(s.edges, Z1) + overlap(s.edges, Z2), 0);
    for (const p of code.plaquettes) assert.equal(overlap(p.edges, X1) + overlap(p.edges, X2), 0);
  }
});

test('the prepared ground state has every star and plaquette at +1 and Z̄ = +1 (tableau, and statevector for L = 3)', () => {
  for (const L of [3, 4, 5]) {
    const code = toricCode(L);
    const { tableau } = groundState(code);
    for (const s of code.stars) assert.equal(tableau.expectation({ x: s.edges }), 1);
    for (const p of code.plaquettes) assert.equal(tableau.expectation({ z: p.edges }), 1);
    assert.equal(tableau.expectation({ z: code.logicals.Z1 }), 1);
    assert.equal(tableau.expectation({ z: code.logicals.Z2 }), 1);
    assert.equal(tableau.expectation({ x: code.logicals.X1 }), 0);
  }
  // the same circuit on the statevector engine (18 qubits)
  const code = toricCode(3);
  const { state } = runOps(code.n, groundState(code).ops);
  const same = (a, b, sign = 1) => a.re.every((v, k) => Math.abs(v - sign * b.re[k]) < 1e-12 && Math.abs(a.im[k] - sign * b.im[k]) < 1e-12);
  for (const s of code.stars) {
    const t = cloneState(state);
    for (const e of s.edges) applyGate(t, e, GATES.X);
    assert.ok(same(t, state), 'A_v |ψ⟩ = |ψ⟩');
  }
  for (const p of code.plaquettes) {
    const t = cloneState(state);
    for (const e of p.edges) applyGate(t, e, GATES.Z);
    assert.ok(same(t, state), 'B_p |ψ⟩ = |ψ⟩');
  }
});

test('strings create anyons only at their ends: Z strings make e pairs, X strings on the dual lattice make m pairs', () => {
  const code = toricCode(5);
  const z = new Uint8Array(code.n);
  for (const e of [code.h(1, 1), code.h(1, 2), code.v(1, 3)]) z[e] = 1; // path (1,1) → (1,3) → (2,3)
  assert.deepEqual(anyons(code, z, new Uint8Array(code.n)).e, [1 * 5 + 1, 2 * 5 + 3]);
  const x = new Uint8Array(code.n);
  for (const e of [code.v(2, 1), code.v(2, 2)]) x[e] = 1; // crosses from face (2,0) through (2,1) to (2,2)
  assert.deepEqual(anyons(code, new Uint8Array(code.n), x).m, [2 * 5 + 0, 2 * 5 + 2]);
  // a closed loop creates nothing
  const loop = new Uint8Array(code.n);
  for (const e of loopAround(code, 1, 1, 2, 2)) loop[e] ^= 1;
  assert.deepEqual(anyons(code, loop, new Uint8Array(code.n)).e, []);
});

test('braiding: an e carried around one m picks up −1, around both or none +1 (tableau and statevector)', () => {
  const code = toricCode(5);
  const { tableau } = groundState(code);
  const t = tableau.clone();
  t.xGate(code.v(2, 2)); // m anyons in faces (2, 1) and (2, 2)
  assert.deepEqual(anyons(code, new Uint8Array(code.n), Uint8Array.from({ length: code.n }, (_, k) => (k === code.v(2, 2) ? 1 : 0))).m, [11, 12]);
  const loopValue = (i0, j0, r, c) => t.expectation({ z: loopAround(code, i0, j0, r, c) });
  assert.equal(loopValue(2, 1, 1, 1), -1); // around face (2,1) only
  assert.equal(loopValue(1, 2, 2, 2), -1); // around (2,2) but not (2,1)
  assert.equal(loopValue(2, 1, 1, 2), 1); // around both
  assert.equal(loopValue(0, 0, 1, 1), 1); // around neither
  // the loop operator is the product of the plaquettes inside
  const inside = plaquettesInside(code, 1, 2, 2, 2);
  const product = new Uint8Array(code.n);
  for (const k of inside) for (const e of code.plaquettes[k].edges) product[e] ^= 1;
  const loop = new Uint8Array(code.n);
  for (const e of loopAround(code, 1, 2, 2, 2)) loop[e] ^= 1;
  assert.deepEqual(product, loop);

  // statevector, L = 3: Z on the loop around one m returns exactly −|ψ⟩
  const small = toricCode(3);
  const { state } = runOps(small.n, groundState(small).ops);
  applyGate(state, small.v(1, 1), GATES.X); // m in faces (1, 0) and (1, 1)
  const after = cloneState(state);
  for (const e of loopAround(small, 1, 1, 1, 1)) applyGate(after, e, GATES.Z);
  assert.ok(after.re.every((v, k) => Math.abs(v + state.re[k]) < 1e-12 && Math.abs(after.im[k] + state.im[k]) < 1e-12));
});

test('a loop around the torus flips a logical qubit without creating any anyon', () => {
  const code = toricCode(4);
  const t = groundState(code).tableau;
  for (const e of code.logicals.X1) t.xGate(e);
  for (const s of code.stars) assert.equal(t.expectation({ x: s.edges }), 1);
  for (const p of code.plaquettes) assert.equal(t.expectation({ z: p.edges }), 1);
  assert.equal(t.expectation({ z: code.logicals.Z1 }), -1);
  assert.equal(t.expectation({ z: code.logicals.Z2 }), 1);
});
