// A stabilizer (Clifford) simulator in the Aaronson-Gottesman tableau form. An n-qubit stabilizer
// state is described by n commuting Pauli operators that leave it unchanged, so circuits of H, S,
// CNOT and Pauli gates with measurements run in polynomial time on hundreds of qubits.
//
// Rows 0..n-1 are destabilizers, rows n..2n-1 stabilizers, row 2n is scratch. Row i is the Pauli
// i^? X^x Z^z with x, z bit vectors and sign bit r (the phase is (-1)^r).

export class Tableau {
  constructor(n) {
    this.n = n;
    const rows = 2 * n + 1;
    this.x = Array.from({ length: rows }, () => new Uint8Array(n));
    this.z = Array.from({ length: rows }, () => new Uint8Array(n));
    this.r = new Uint8Array(rows);
    for (let i = 0; i < n; i++) {
      this.x[i][i] = 1; // destabilizer X_i
      this.z[n + i][i] = 1; // stabilizer Z_i: the state |0...0>
    }
  }

  clone() {
    const t = new Tableau(this.n);
    t.x = this.x.map((row) => Uint8Array.from(row));
    t.z = this.z.map((row) => Uint8Array.from(row));
    t.r = Uint8Array.from(this.r);
    return t;
  }

  h(a) {
    for (let i = 0; i < 2 * this.n; i++) {
      this.r[i] ^= this.x[i][a] & this.z[i][a];
      const t = this.x[i][a];
      this.x[i][a] = this.z[i][a];
      this.z[i][a] = t;
    }
  }

  s(a) {
    for (let i = 0; i < 2 * this.n; i++) {
      this.r[i] ^= this.x[i][a] & this.z[i][a];
      this.z[i][a] ^= this.x[i][a];
    }
  }

  cnot(a, b) {
    for (let i = 0; i < 2 * this.n; i++) {
      this.r[i] ^= this.x[i][a] & this.z[i][b] & (this.x[i][b] ^ this.z[i][a] ^ 1);
      this.x[i][b] ^= this.x[i][a];
      this.z[i][a] ^= this.z[i][b];
    }
  }

  // Pauli gates only flip signs: X anticommutes with Z components, Z with X components.
  xGate(a) {
    for (let i = 0; i < 2 * this.n; i++) this.r[i] ^= this.z[i][a];
  }

  zGate(a) {
    for (let i = 0; i < 2 * this.n; i++) this.r[i] ^= this.x[i][a];
  }

  yGate(a) {
    for (let i = 0; i < 2 * this.n; i++) this.r[i] ^= this.x[i][a] ^ this.z[i][a];
  }

  sdg(a) {
    this.s(a);
    this.s(a);
    this.s(a);
  }

  cz(a, b) {
    this.h(b);
    this.cnot(a, b);
    this.h(b);
  }

  // Exponent of i (mod 4) contributed when multiplying single-qubit Paulis (x1,z1)(x2,z2).
  static g(x1, z1, x2, z2) {
    if (!x1 && !z1) return 0;
    if (x1 && z1) return z2 - x2;
    if (x1 && !z1) return z2 * (2 * x2 - 1);
    return x2 * (1 - 2 * z2);
  }

  // row h <- row i * row h
  rowsum(h, i) {
    let e = 2 * this.r[h] + 2 * this.r[i];
    for (let j = 0; j < this.n; j++) e += Tableau.g(this.x[i][j], this.z[i][j], this.x[h][j], this.z[h][j]);
    e = ((e % 4) + 4) % 4;
    this.r[h] = e === 2 ? 1 : 0;
    for (let j = 0; j < this.n; j++) {
      this.x[h][j] ^= this.x[i][j];
      this.z[h][j] ^= this.z[i][j];
    }
  }

  // Measure qubit a in the Z basis. rng() supplies randomness for random outcomes.
  // Returns { outcome, random }.
  measure(a, rng = Math.random) {
    const n = this.n;
    let p = -1;
    for (let i = n; i < 2 * n; i++) {
      if (this.x[i][a]) {
        p = i;
        break;
      }
    }
    if (p >= 0) {
      for (let i = 0; i < 2 * n; i++) if (i !== p && this.x[i][a]) this.rowsum(i, p);
      this.x[p - n] = Uint8Array.from(this.x[p]);
      this.z[p - n] = Uint8Array.from(this.z[p]);
      this.r[p - n] = this.r[p];
      this.x[p].fill(0);
      this.z[p].fill(0);
      this.z[p][a] = 1;
      const outcome = rng() < 0.5 ? 0 : 1;
      this.r[p] = outcome;
      return { outcome, random: true };
    }
    const s = 2 * n;
    this.x[s].fill(0);
    this.z[s].fill(0);
    this.r[s] = 0;
    for (let i = 0; i < n; i++) if (this.x[i][a]) this.rowsum(s, i + n);
    return { outcome: this.r[s], random: false };
  }

  // Expectation value of a Pauli product given as { x: [...qubits], z: [...qubits] } (Y = both):
  // +1 or -1 if it (or minus it) stabilizes the state, 0 if it anticommutes with a stabilizer.
  // The state is not changed.
  expectation({ x = [], z = [] }) {
    const n = this.n;
    const px = new Uint8Array(n);
    const pz = new Uint8Array(n);
    for (const q of x) px[q] ^= 1;
    for (const q of z) pz[q] ^= 1;
    const anticommutes = (row) => {
      let s = 0;
      for (let j = 0; j < n; j++) s ^= (this.x[row][j] & pz[j]) ^ (this.z[row][j] & px[j]);
      return s;
    };
    for (let i = n; i < 2 * n; i++) if (anticommutes(i)) return 0;
    // P is ± a product of stabilizers: those whose destabilizer partners anticommute with P.
    const t = this.clone();
    const s = 2 * n;
    t.x[s].fill(0);
    t.z[s].fill(0);
    t.r[s] = 0;
    for (let i = 0; i < n; i++) if (anticommutes(i)) t.rowsum(s, i + n);
    // The accumulated row has the same bits as P (a Y is the pair x = z = 1 in both), so its sign
    // bit is the eigenvalue.
    return t.r[s] ? -1 : 1;
  }

  // A readable generating set: Gaussian elimination on the stabilizer rows (X pivots first, then
  // Z), the same group written in a canonical order. Returns strings like "+XXI".
  canonicalStabilizers() {
    const t = this.clone();
    const n = this.n;
    const rows = Array.from({ length: n }, (_, k) => n + k);
    let top = 0;
    const swap = (a, b) => {
      [t.x[a], t.x[b]] = [t.x[b], t.x[a]];
      [t.z[a], t.z[b]] = [t.z[b], t.z[a]];
      [t.r[a], t.r[b]] = [t.r[b], t.r[a]];
    };
    for (const bits of ['x', 'z']) {
      for (let j = 0; j < n && top < n; j++) {
        let piv = -1;
        for (let k = top; k < n; k++) {
          if (t[bits][rows[k]][j]) {
            piv = k;
            break;
          }
        }
        if (piv < 0) continue;
        swap(rows[top], rows[piv]);
        for (let k = 0; k < n; k++) if (k !== top && t[bits][rows[k]][j]) t.rowsum(rows[k], rows[top]);
        top++;
      }
    }
    return rows.map((i) => {
      let s = t.r[i] ? '−' : '+';
      for (let j = 0; j < n; j++) s += t.x[i][j] ? (t.z[i][j] ? 'Y' : 'X') : t.z[i][j] ? 'Z' : 'I';
      return s;
    });
  }

  // The stabilizer generators as strings like "+XZZXI" (qubit 0 first).
  stabilizers() {
    const out = [];
    for (let i = this.n; i < 2 * this.n; i++) {
      let s = this.r[i] ? '−' : '+';
      for (let j = 0; j < this.n; j++) s += this.x[i][j] ? (this.z[i][j] ? 'Y' : 'X') : this.z[i][j] ? 'Z' : 'I';
      out.push(s);
    }
    return out;
  }

  // Apply a circuit op in the format of lib/circuit.js (Clifford gates only).
  apply(op, rng) {
    const c = op.controls ?? [];
    switch (op.gate) {
      case 'H':
        return this.h(op.target);
      case 'S':
        return this.s(op.target);
      case 'SDG':
        return this.sdg(op.target);
      case 'X':
        if (c.length === 1) return this.cnot(c[0], op.target);
        return this.xGate(op.target);
      case 'Y':
        return this.yGate(op.target);
      case 'Z':
        if (c.length === 1) return this.cz(c[0], op.target);
        return this.zGate(op.target);
      case 'MEASURE':
        return this.measure(op.target, rng);
      default:
        throw new Error(`${op.gate} is not a Clifford gate this simulator supports`);
    }
  }
}
