// Kitaev's toric code on an L × L torus. Qubits live on edges: the horizontal edge from vertex
// (i, j) to (i, j + 1) is h(i, j) = i L + j, the vertical edge from (i, j) to (i + 1, j) is
// v(i, j) = L² + i L + j (indices mod L, so the lattice wraps both ways).
//   Star A_v = X on the four edges at vertex v.      A Z error flips the two stars at its ends: e anyons.
//   Plaquette B_p = Z around the face p.            An X error flips the two faces beside it: m anyons.
// 2L² qubits, 2L² − 2 independent checks: two logical qubits, carried by loops around the torus.

import { Tableau } from './stabilizer.js';

export function toricCode(L) {
  const m = (a) => ((a % L) + L) % L;
  const h = (i, j) => m(i) * L + m(j);
  const v = (i, j) => L * L + m(i) * L + m(j);
  const stars = [];
  const plaquettes = [];
  for (let i = 0; i < L; i++) {
    for (let j = 0; j < L; j++) {
      stars.push({ i, j, edges: [h(i, j), h(i, j - 1), v(i, j), v(i - 1, j)] });
      plaquettes.push({ i, j, edges: [h(i, j), h(i + 1, j), v(i, j), v(i, j + 1)] });
    }
  }
  // logical operators: Z on a loop of edges, X on a loop of the dual lattice (edges it crosses)
  const row = (i) => Array.from({ length: L }, (_, j) => h(i, j));
  const col = (j) => Array.from({ length: L }, (_, i) => v(i, j));
  const logicals = {
    Z1: row(0), // horizontal loop
    X1: Array.from({ length: L }, (_, i) => h(i, 0)), // vertical dual loop, crosses row 0's h(0, 0)
    Z2: col(0), // vertical loop
    X2: Array.from({ length: L }, (_, j) => v(0, j)), // horizontal dual loop
  };
  // endpoints of each edge, for drawing and for strings
  const ends = [];
  for (let i = 0; i < L; i++) for (let j = 0; j < L; j++) ends[h(i, j)] = [[i, j], [i, m(j + 1)]];
  for (let i = 0; i < L; i++) for (let j = 0; j < L; j++) ends[v(i, j)] = [[i, j], [m(i + 1), j]];
  return { L, n: 2 * L * L, h, v, stars, plaquettes, logicals, ends };
}

// A tableau holding the ground state with Z̄1 = Z̄2 = +1: start from |0…0⟩ (every plaquette +1)
// and apply (1 + A_v)/√2 for all stars but one, using a spanning tree: each vertex's edge to its
// parent is a fresh |0⟩ pivot (H, then CNOTs onto the rest of the star). Vertices are added
// leaves first, so no pivot is ever touched by an earlier star. Returns the circuit too, so the
// tests can run it on the statevector engine.
export function groundState(code) {
  const { L } = code;
  const ops = [];
  // BFS tree from vertex (0, 0) along right and down steps
  const parentEdge = new Map();
  const order = [];
  const seen = new Set(['0,0']);
  const queue = [[0, 0]];
  while (queue.length) {
    const [i, j] = queue.shift();
    order.push([i, j]);
    const steps = [
      [i, (j + 1) % L, code.h(i, j)],
      [(i + 1) % L, j, code.v(i, j)],
      [i, (j - 1 + L) % L, code.h(i, j - 1)],
      [(i - 1 + L) % L, j, code.v(i - 1, j)],
    ];
    for (const [a, b, e] of steps) {
      if (seen.has(`${a},${b}`)) continue;
      seen.add(`${a},${b}`);
      parentEdge.set(`${a},${b}`, e);
      queue.push([a, b]);
    }
  }
  for (const [i, j] of order.slice(1).reverse()) {
    const pivot = parentEdge.get(`${i},${j}`);
    const star = code.stars[i * L + j].edges;
    ops.push({ gate: 'H', target: pivot });
    for (const e of star) if (e !== pivot) ops.push({ gate: 'X', target: e, controls: [pivot] });
  }
  const t = new Tableau(code.n);
  for (const op of ops) {
    if (op.gate === 'H') t.h(op.target);
    else t.cnot(op.controls[0], op.target);
  }
  return { tableau: t, ops };
}

// Anyons for given Pauli errors (bit arrays over the edges): e where a star is flipped by Z
// errors, m where a plaquette is flipped by X errors.
export function anyons(code, zErr, xErr) {
  const parity = (edges, err) => edges.reduce((s, e) => s ^ err[e], 0);
  return {
    e: code.stars.map((s, k) => (parity(s.edges, zErr) ? k : -1)).filter((k) => k >= 0),
    m: code.plaquettes.map((p, k) => (parity(p.edges, xErr) ? k : -1)).filter((k) => k >= 0),
  };
}

// The edges around a rectangle of plaquettes (rows i0 … i0 + rows − 1, columns j0 … j0 + cols − 1),
// in order, walking clockwise from its top-left vertex: a closed path an e anyon can travel.
export function loopAround(code, i0, j0, rows, cols) {
  const { h, v } = code;
  const path = [];
  for (let j = j0; j < j0 + cols; j++) path.push(h(i0, j)); // along the top, left to right
  for (let i = i0; i < i0 + rows; i++) path.push(v(i, j0 + cols)); // down the right side
  for (let j = j0 + cols - 1; j >= j0; j--) path.push(h(i0 + rows, j)); // back along the bottom
  for (let i = i0 + rows - 1; i >= i0; i--) path.push(v(i, j0)); // up the left side
  return path;
}

// Plaquettes inside that rectangle.
export function plaquettesInside(code, i0, j0, rows, cols) {
  const out = [];
  for (let i = i0; i < i0 + rows; i++) for (let j = j0; j < j0 + cols; j++) out.push(((i % code.L) * code.L) + (j % code.L));
  return out;
}
