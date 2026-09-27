// Statevector simulation of Hamiltonian dynamics: exact evolution and the Trotterized
// circuit a quantum computer would run. Qubit q is bit q of the basis-state index.
// Terms come from pauli.js as { coeff, xmask, zmask }.

export const MAX_QUBITS = 10;

const I_POW = [[1, 0], [0, 1], [-1, 0], [0, -1]];

function parity(x) {
  x ^= x >>> 16;
  x ^= x >>> 8;
  x ^= x >>> 4;
  x ^= x >>> 2;
  x ^= x >>> 1;
  return x & 1;
}

function popcount(x) {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

// A Pauli string P maps |b> to phase(b) |b ^ xmask>, with phase(b) = i^(#Y) (-1)^popcount(b & zmask).
// Terms sharing an xmask are folded into one diagonal vector, so applying H costs
// (number of distinct xmasks) x 2^n instead of (number of terms) x 2^n.
export function makeOperator(terms, n) {
  const dim = 1 << n;
  const groups = new Map();
  let norm = 0;
  for (const t of terms) {
    norm += Math.abs(t.coeff);
    let g = groups.get(t.xmask);
    if (!g) {
      g = { xmask: t.xmask, re: new Float64Array(dim), im: new Float64Array(dim) };
      groups.set(t.xmask, g);
    }
    const [pr, pi] = I_POW[popcount(t.xmask & t.zmask) & 3];
    for (let b = 0; b < dim; b++) {
      const c = parity(b & t.zmask) ? -t.coeff : t.coeff;
      g.re[b] += c * pr;
      g.im[b] += c * pi;
    }
  }
  return { n, dim, terms, groups: [...groups.values()], norm };
}

export function applyOperator(op, re, im, outRe, outIm) {
  outRe.fill(0);
  outIm.fill(0);
  for (const g of op.groups) {
    const x = g.xmask;
    const gr = g.re;
    const gi = g.im;
    for (let b = 0; b < op.dim; b++) {
      const cr = gr[b];
      const ci = gi[b];
      if (cr === 0 && ci === 0) continue;
      const t = b ^ x;
      outRe[t] += cr * re[b] - ci * im[b];
      outIm[t] += cr * im[b] + ci * re[b];
    }
  }
}

function workspace(dim) {
  return {
    re: new Float64Array(dim),
    im: new Float64Array(dim),
    vRe: new Float64Array(dim),
    vIm: new Float64Array(dim),
  };
}

export function expectation(op, re, im, w = workspace(op.dim)) {
  applyOperator(op, re, im, w.re, w.im);
  let s = 0;
  for (let b = 0; b < op.dim; b++) s += re[b] * w.re[b] + im[b] * w.im[b];
  return s;
}

// psi <- exp(-i H h) psi as a Taylor series, summed until terms fall below machine precision.
// Callers keep |h| * norm(H) <= 0.5 so the series converges in ~20 terms.
function taylorStep(op, re, im, h, w) {
  w.vRe.set(re);
  w.vIm.set(im);
  for (let k = 1; k < 80; k++) {
    applyOperator(op, w.vRe, w.vIm, w.re, w.im);
    const f = h / k;
    let size = 0;
    for (let b = 0; b < op.dim; b++) {
      const vr = f * w.im[b];
      const vi = -f * w.re[b];
      w.vRe[b] = vr;
      w.vIm[b] = vi;
      re[b] += vr;
      im[b] += vi;
      size += vr * vr + vi * vi;
    }
    if (size < 1e-32) break;
  }
}

export function evolveExact(op, re, im, duration, w = workspace(op.dim)) {
  if (duration <= 0) return;
  const substeps = Math.max(1, Math.ceil((duration * op.norm) / 0.5));
  const h = duration / substeps;
  for (let s = 0; s < substeps; s++) taylorStep(op, re, im, h, w);
}

// psi <- exp(-i theta P) psi = cos(theta) psi - i sin(theta) P psi, using P^2 = I.
function rotate(term, re, im, theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const { xmask, zmask } = term;
  const dim = re.length;
  if (xmask === 0) {
    for (let b = 0; b < dim; b++) {
      const si = parity(b & zmask) ? s : -s;
      const r = re[b];
      const i = im[b];
      re[b] = c * r - si * i;
      im[b] = c * i + si * r;
    }
    return;
  }
  const [pr, pi] = I_POW[popcount(xmask & zmask) & 3];
  for (let b = 0; b < dim; b++) {
    const b2 = b ^ xmask;
    if (b2 < b) continue;
    const sb = parity(b & zmask) ? -1 : 1;
    const sb2 = parity(b2 & zmask) ? -1 : 1;
    // (P psi)[b] = phase(b2) psi[b2] and (P psi)[b2] = phase(b) psi[b]
    const qr = sb2 * (pr * re[b2] - pi * im[b2]);
    const qi = sb2 * (pr * im[b2] + pi * re[b2]);
    const rr = sb * (pr * re[b] - pi * im[b]);
    const ri = sb * (pr * im[b] + pi * re[b]);
    const ar = re[b];
    const ai = im[b];
    re[b] = c * ar + s * qi;
    im[b] = c * ai - s * qr;
    const br = re[b2];
    const bi = im[b2];
    re[b2] = c * br + s * ri;
    im[b2] = c * bi - s * rr;
  }
}

export function trotterStep(terms, re, im, dt, order) {
  if (order === 1) {
    for (const t of terms) rotate(t, re, im, t.coeff * dt);
    return;
  }
  for (const t of terms) rotate(t, re, im, (t.coeff * dt) / 2);
  for (let k = terms.length - 1; k >= 0; k--) rotate(terms[k], re, im, (terms[k].coeff * dt) / 2);
}

export function productState(chars) {
  const n = chars.length;
  const dim = 1 << n;
  const r = Math.SQRT1_2;
  const amp = { 0: [1, 0], 1: [0, 1], '+': [r, r], '-': [r, -r] };
  const re = new Float64Array(dim);
  const im = new Float64Array(dim);
  for (let b = 0; b < dim; b++) {
    let a = 1;
    for (let q = 0; q < n; q++) a *= amp[chars[q]][(b >> q) & 1];
    re[b] = a;
  }
  return { re, im };
}

// Rough gate count for one Trotter step: each weight-w Pauli rotation compiles to one
// single-qubit rotation sandwiched between two CNOT ladders of w - 1 gates each.
export function circuitCost(terms, order) {
  let rotations = 0;
  let cnots = 0;
  for (const t of terms) {
    const w = popcount(t.xmask | t.zmask);
    if (w === 0) continue;
    rotations++;
    cnots += 2 * (w - 1);
  }
  const f = order === 1 ? 1 : 2;
  return { rotations: rotations * f, cnots: cnots * f };
}

function series(samples, n, dim) {
  return {
    times: new Float64Array(samples),
    z: new Float64Array(samples * n),
    obs: new Float64Array(samples),
    probs: new Float64Array(samples * dim),
  };
}

function record(s, idx, re, im, n, O, w) {
  const dim = re.length;
  const zOff = idx * n;
  const pOff = idx * dim;
  for (let b = 0; b < dim; b++) {
    const p = re[b] * re[b] + im[b] * im[b];
    s.probs[pOff + b] = p;
    for (let q = 0; q < n; q++) s.z[zOff + q] += (b >> q) & 1 ? -p : p;
  }
  s.obs[idx] = expectation(O, re, im, w);
}

export function simulate({ H, O, psi0, totalTime, steps, order, frames = 200 }) {
  const { n, dim } = H;
  const w = workspace(dim);
  const dt = totalTime / steps;

  const trotter = series(steps + 1, n, dim);
  trotter.infidelity = new Float64Array(steps + 1);
  const keptRe = new Float64Array((steps + 1) * dim);
  const keptIm = new Float64Array((steps + 1) * dim);
  const re = Float64Array.from(psi0.re);
  const im = Float64Array.from(psi0.im);
  for (let k = 0; k <= steps; k++) {
    if (k > 0) trotterStep(H.terms, re, im, dt, order);
    trotter.times[k] = k * dt;
    record(trotter, k, re, im, n, O, w);
    keptRe.set(re, k * dim);
    keptIm.set(im, k * dim);
  }

  // Walk the exact state through the union of the plotting grid and the Trotter step
  // times, so the Trotter error is measured against the exact state at the same instant.
  const exact = series(frames + 1, n, dim);
  re.set(psi0.re);
  im.set(psi0.im);
  const eps = 1e-9 * totalTime;
  let t = 0;
  let j = 0;
  let k = 0;
  while (j <= frames || k <= steps) {
    const tj = j <= frames ? (j * totalTime) / frames : Infinity;
    const tk = k <= steps ? k * dt : Infinity;
    const next = Math.min(tj, tk);
    evolveExact(H, re, im, next - t, w);
    t = next;
    if (Math.abs(tj - next) <= eps) {
      exact.times[j] = tj;
      record(exact, j, re, im, n, O, w);
      j++;
    }
    if (Math.abs(tk - next) <= eps) {
      const off = k * dim;
      let or = 0;
      let oi = 0;
      for (let b = 0; b < dim; b++) {
        or += re[b] * keptRe[off + b] + im[b] * keptIm[off + b];
        oi += re[b] * keptIm[off + b] - im[b] * keptRe[off + b];
      }
      trotter.infidelity[k] = Math.max(0, 1 - (or * or + oi * oi));
      k++;
    }
  }

  let maxProb = 0;
  for (const p of exact.probs) if (p > maxProb) maxProb = p;
  for (const p of trotter.probs) if (p > maxProb) maxProb = p;

  return { n, dim, totalTime, steps, order, frames, dt, exact, trotter, maxProb };
}
