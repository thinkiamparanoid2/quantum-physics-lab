// Single-qubit randomized benchmarking. The 24 single-qubit Cliffords (up to global phase) are
// generated from H and S. A sequence of m random Cliffords is followed by the one Clifford that
// inverts it; a noise channel Λ acts after every gate. Averaged over sequences, any such noise is
// twirled into a depolarizing channel with parameter f, so the survival probability of |0⟩ decays
// as A f^m + B, and the average gate fidelity is F = (1 + f)/2.
//
// 2 × 2 complex matrices are { re: [a, b, c, d], im: [...] }; density matrices likewise.

const R = Math.SQRT1_2;
const H = { re: [R, R, R, -R], im: [0, 0, 0, 0] };
const S = { re: [1, 0, 0, 0], im: [0, 0, 0, 1] };

export function mul(A, B) {
  const re = [0, 0, 0, 0];
  const im = [0, 0, 0, 0];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 2; k++) {
        re[2 * i + j] += A.re[2 * i + k] * B.re[2 * k + j] - A.im[2 * i + k] * B.im[2 * k + j];
        im[2 * i + j] += A.re[2 * i + k] * B.im[2 * k + j] + A.im[2 * i + k] * B.re[2 * k + j];
      }
    }
  }
  return { re, im };
}
export const dagger = (A) => ({ re: [A.re[0], A.re[2], A.re[1], A.re[3]], im: [-A.im[0], -A.im[2], -A.im[1], -A.im[3]] });

// Canonical key up to global phase: divide by the phase of the first sizeable entry.
function keyOf(U) {
  const k = [0, 1, 2, 3].find((i) => Math.hypot(U.re[i], U.im[i]) > 1e-6);
  const ph = Math.atan2(U.im[k], U.re[k]);
  const [c, s] = [Math.cos(ph), Math.sin(ph)];
  return [0, 1, 2, 3].map((i) => `${(U.re[i] * c + U.im[i] * s).toFixed(6)},${(U.im[i] * c - U.re[i] * s).toFixed(6)}`).join('|').replace(/-0\.000000/g, '0.000000');
}

let group = null;
export function cliffords() {
  if (group) return group;
  const I = { re: [1, 0, 0, 1], im: [0, 0, 0, 0] };
  const seen = new Map([[keyOf(I), { U: I, name: 'I' }]]);
  const queue = [{ U: I, name: 'I' }];
  while (queue.length) {
    const g = queue.shift();
    for (const [G, n] of [
      [H, 'H'],
      [S, 'S'],
    ]) {
      const U = mul(G, g.U);
      const key = keyOf(U);
      if (!seen.has(key)) {
        const item = { U, name: g.name === 'I' ? n : `${n}·${g.name}` };
        seen.set(key, item);
        queue.push(item);
      }
    }
  }
  group = { list: [...seen.values()], index: (U) => [...seen.keys()].indexOf(keyOf(U)) };
  return group;
}

// ----- noise channels on 2 × 2 density matrices -----
const conj = (U, rho) => mul(mul(U, rho), dagger(U));
export const NOISE = {
  depolarizing: (p) => (rho) => ({ re: rho.re.map((v, i) => (1 - p) * v + (i === 0 || i === 3 ? p / 2 : 0)), im: rho.im.map((v) => (1 - p) * v) }),
  damping: (g) => (rho) => {
    // amplitude damping with probability g (energy relaxation, T1)
    const s = Math.sqrt(1 - g);
    return { re: [rho.re[0] + g * rho.re[3], s * rho.re[1], s * rho.re[2], (1 - g) * rho.re[3]], im: [0, s * rho.im[1], s * rho.im[2], 0] };
  },
  overrotation: (eps) => (rho) => conj({ re: [Math.cos(eps / 2), 0, 0, Math.cos(eps / 2)], im: [0, -Math.sin(eps / 2), -Math.sin(eps / 2), 0] }, rho),
};

// The exact twirled parameter f of a noise channel Λ: f = (Tr of the Pauli transfer matrix − 1)/3,
// computed from how Λ acts on the Paulis.
export function twirledF(noise) {
  const paulis = [
    { re: [0, 1, 1, 0], im: [0, 0, 0, 0] },
    { re: [0, 0, 0, 0], im: [0, -1, 1, 0] },
    { re: [1, 0, 0, -1], im: [0, 0, 0, 0] },
  ];
  let tr = 0;
  for (const P of paulis) {
    // apply Λ to (I + P)/2 and (I − P)/2 and take the difference: Λ(P)
    const plus = noise({ re: P.re.map((v, i) => (v + (i === 0 || i === 3 ? 1 : 0)) / 2), im: P.im.map((v) => v / 2) });
    const minus = noise({ re: P.re.map((v, i) => (-v + (i === 0 || i === 3 ? 1 : 0)) / 2), im: P.im.map((v) => -v / 2) });
    const LP = { re: plus.re.map((v, i) => v - minus.re[i]), im: plus.im.map((v, i) => v - minus.im[i]) };
    // Tr(P Λ(P)) / 2
    const PL = mul(P, LP);
    tr += (PL.re[0] + PL.re[3]) / 2;
  }
  return tr / 3;
}

// Run RB: for each length, `samples` random sequences; returns mean survival and its standard error.
export function runRB({ noise, lengths, samples, prepError = 0, readError = 0, seed = 1 }) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const { list } = cliffords();
  const rho0 = { re: [1 - prepError, 0, 0, prepError], im: [0, 0, 0, 0] };
  return lengths.map((m) => {
    const vals = [];
    for (let k = 0; k < samples; k++) {
      let rho = rho0;
      let total = { re: [1, 0, 0, 1], im: [0, 0, 0, 0] };
      for (let j = 0; j < m; j++) {
        const C = list[Math.floor(rng() * list.length)].U;
        rho = noise(conj(C, rho));
        total = mul(C, total);
      }
      rho = noise(conj(dagger(total), rho)); // the inverting Clifford, also noisy
      const p0 = rho.re[0];
      vals.push((1 - readError) * p0 + readError * (1 - p0));
    }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length - 1));
    return { m, mean, err: sd / Math.sqrt(vals.length) };
  });
}

// Fit A f^m + B by scanning f and solving for A, B by least squares (A, B kept physical: with few
// samples and little decay, A and B can otherwise trade off against f).
export function fitDecay(points) {
  let best = null;
  for (let k = 0; k <= 20000; k++) {
    const f = 0.9 + (0.1 * k) / 20000;
    const xs = points.map((p) => f ** p.m);
    const n = xs.length;
    const sx = xs.reduce((a, b) => a + b, 0);
    const sy = points.reduce((a, p) => a + p.mean, 0);
    const sxx = xs.reduce((a, b) => a + b * b, 0);
    const sxy = xs.reduce((a, x, i) => a + x * points[i].mean, 0);
    const den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-15) continue;
    const A = (n * sxy - sx * sy) / den;
    const B = (sy - A * sx) / n;
    if (A < 0 || A > 1.2 || B < -0.2 || B > 1.2) continue; // keep the fit physical
    const res = points.reduce((a, p, i) => a + (A * xs[i] + B - p.mean) ** 2, 0);
    if (!best || res < best.res) best = { f, A, B, res };
  }
  return best;
}
