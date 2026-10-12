// Fock space: creation and annihilation operators on occupation-number states, for bosons and
// fermions, and the Jordan–Wigner map that writes fermions as qubits.
//
// Modes are numbered 0 … M − 1. A state is a Map from an occupation key ("1,0,2") to a real
// amplitude (every operator here has real matrix elements in this basis).

const key = (occ) => occ.join(',');
const unkey = (k) => k.split(',').map(Number);

// Apply one operator: { dag: true|false, mode, kind: 'boson'|'fermion' }.
//   boson:   a†|n⟩ = √(n + 1)|n + 1⟩,  a|n⟩ = √n |n − 1⟩
//   fermion: c†|n⟩ = (−1)^(occupied modes before it) (1 − n)|n + 1⟩, and likewise for c with n
export function applyOp(state, { dag, mode, kind }) {
  const out = new Map();
  for (const [k, amp] of state) {
    const occ = unkey(k);
    const n = occ[mode];
    let f;
    if (kind === 'boson') {
      f = dag ? Math.sqrt(n + 1) : Math.sqrt(n);
    } else {
      if (dag ? n === 1 : n === 0) continue;
      f = occ.slice(0, mode).reduce((s, v) => s + v, 0) % 2 ? -1 : 1;
    }
    if (f === 0) continue;
    occ[mode] = n + (dag ? 1 : -1);
    const k2 = key(occ);
    out.set(k2, (out.get(k2) ?? 0) + f * amp);
  }
  for (const [k, v] of out) if (Math.abs(v) < 1e-14) out.delete(k);
  return out;
}

export const vacuum = (M) => new Map([[key(new Array(M).fill(0)), 1]]);

// A product of operators written left to right, acting on `state`: the rightmost acts first.
export function applyProduct(ops, state) {
  let s = state;
  for (let i = ops.length - 1; i >= 0; i--) s = applyOp(s, ops[i]);
  return s;
}

export const terms = (state) => [...state].map(([k, amp]) => ({ occ: unkey(k), amp }));

// ----- Jordan–Wigner -----
// Occupied = |1⟩. c_j = Z_0 … Z_{j−1} σ⁻_j with σ⁻ = |0⟩⟨1| = (X + iY)/2, and c†_j = Z…Z σ⁺_j.
// As Pauli letters for drawing: the string of Z's, then the σ± on site j, then identities.
export function jwLetters(N, j, dag) {
  return Array.from({ length: N }, (_, k) => (k < j ? 'Z' : k === j ? (dag ? 'σ⁺' : 'σ⁻') : 'I'));
}

// c†_i c_j + c†_j c_i (i < j) as Pauli terms: ½ (X_i Z…Z X_j + Y_i Z…Z Y_j); the Z string covers
// the sites strictly between i and j, so nearest-neighbour hopping is local: ½ (X X + Y Y).
export function hoppingPauli(i, j) {
  const [a, b] = i < j ? [i, j] : [j, i];
  const zs = [];
  for (let k = a + 1; k < b; k++) zs.push(k);
  return [
    { coeff: 0.5, ops: [[a, 'X'], ...zs.map((k) => [k, 'Z']), [b, 'X']] },
    { coeff: 0.5, ops: [[a, 'Y'], ...zs.map((k) => [k, 'Z']), [b, 'Y']] },
  ];
}

// Pauli terms in the bitmask form of lib/dynamics.js.
export function toMasks(list) {
  return list.map(({ coeff, ops }) => {
    let xmask = 0;
    let zmask = 0;
    for (const [q, p] of ops) {
      if (p === 'X' || p === 'Y') xmask |= 1 << q;
      if (p === 'Z' || p === 'Y') zmask |= 1 << q;
    }
    return { coeff, xmask, zmask };
  });
}

// The open tight-binding chain H = −t Σ_j (c†_j c_{j+1} + h.c.) as qubits.
export function hoppingChainTerms(N, t = 1) {
  const list = [];
  for (let j = 0; j + 1 < N; j++) for (const term of hoppingPauli(j, j + 1)) list.push({ ...term, coeff: -t * term.coeff });
  return toMasks(list);
}

// Its single-particle solution: orbitals φ_k(j) = √(2/(N+1)) sin((j+1)kπ/(N+1)), ε_k = −2t cos(kπ/(N+1)).
export function chainOrbitals(N, t = 1) {
  return Array.from({ length: N }, (_, i) => {
    const q = ((i + 1) * Math.PI) / (N + 1);
    return { energy: -2 * t * Math.cos(q), phi: Array.from({ length: N }, (_, j) => Math.sqrt(2 / (N + 1)) * Math.sin((j + 1) * q)) };
  });
}

// Density ⟨n_j(t)⟩ of free fermions that start on the given sites (one per site): each particle's
// orbital spreads independently, and the densities add (the state stays a Slater determinant).
export function freeDensity(N, sites, time, t = 1) {
  const orb = chainOrbitals(N, t);
  const n = new Float64Array(N);
  for (const s0 of sites) {
    for (let j = 0; j < N; j++) {
      let re = 0;
      let im = 0;
      for (const o of orb) {
        const a = o.phi[j] * o.phi[s0];
        re += a * Math.cos(o.energy * time);
        im -= a * Math.sin(o.energy * time);
      }
      n[j] += re * re + im * im;
    }
  }
  return n;
}
