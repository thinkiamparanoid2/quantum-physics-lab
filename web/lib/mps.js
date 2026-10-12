// Matrix product states for 1D chains: a complex SVD, compression of a statevector into an MPS of
// bond dimension χ, and TEBD time evolution for nearest-neighbour Hamiltonians.
//
// A site tensor A has shape (χl, 2, χr), stored row-major as { re, im, l, r }, element
// (a, s, b) at (a * 2 + s) * r + b. Qubit k of a statevector index is site k (site 0 is bit 0).

import { evolveExact, makeOperator } from './dynamics.js';
import { isingTerms } from './ising.js';
import { hermitianFunction } from './linalg.js';
import { lanczosGround } from './manybody.js';

// ----- complex SVD (one-sided Jacobi, Hestenes) -----
// A (m × n, re/im row-major) = U diag(S) V†, U m × r, V n × r, r = min(m, n), S descending.
export function csvd(reIn, imIn, m, n) {
  const transpose = m < n;
  const rows = transpose ? n : m;
  const cols = transpose ? m : n;
  // work on columns of B (rows × cols); B = A or A† (conjugate transpose)
  const Br = new Float64Array(rows * cols);
  const Bi = new Float64Array(rows * cols);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (transpose) {
        Br[j * cols + i] = reIn[i * n + j];
        Bi[j * cols + i] = -imIn[i * n + j];
      } else {
        Br[i * cols + j] = reIn[i * n + j];
        Bi[i * cols + j] = imIn[i * n + j];
      }
    }
  }
  const Vr = new Float64Array(cols * cols);
  const Vi = new Float64Array(cols * cols);
  for (let i = 0; i < cols; i++) Vr[i * cols + i] = 1;
  for (let sweep = 0; sweep < 60; sweep++) {
    let rotated = false;
    for (let p = 0; p < cols - 1; p++) {
      for (let q = p + 1; q < cols; q++) {
        let alpha = 0;
        let beta = 0;
        let gr = 0;
        let gi = 0; // γ = b_p† b_q
        for (let i = 0; i < rows; i++) {
          const k = i * cols;
          const [xr, xi, yr, yi] = [Br[k + p], Bi[k + p], Br[k + q], Bi[k + q]];
          alpha += xr * xr + xi * xi;
          beta += yr * yr + yi * yi;
          gr += xr * yr + xi * yi;
          gi += xr * yi - xi * yr;
        }
        const g = Math.hypot(gr, gi);
        if (g <= 1e-15 * Math.sqrt(alpha * beta) || g === 0) continue;
        rotated = true;
        const zeta = (beta - alpha) / (2 * g);
        const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = c * t;
        // e^{−iφ} with γ = g e^{iφ}
        const [er, ei] = [gr / g, -gi / g];
        const rot = (Mr, Mi, len, stride) => {
          for (let i = 0; i < len; i++) {
            const k = i * stride;
            const [xr, xi] = [Mr[k + p], Mi[k + p]];
            // y~ = e^{−iφ} y
            const yr = er * Mr[k + q] - ei * Mi[k + q];
            const yi = er * Mi[k + q] + ei * Mr[k + q];
            Mr[k + p] = c * xr - s * yr;
            Mi[k + p] = c * xi - s * yi;
            Mr[k + q] = s * xr + c * yr;
            Mi[k + q] = s * xi + c * yi;
          }
        };
        rot(Br, Bi, rows, cols);
        rot(Vr, Vi, cols, cols);
      }
    }
    if (!rotated) break;
  }
  // singular values are the column norms; sort descending
  const norms = Array.from({ length: cols }, (_, j) => {
    let s = 0;
    for (let i = 0; i < rows; i++) s += Br[i * cols + j] ** 2 + Bi[i * cols + j] ** 2;
    return Math.sqrt(s);
  });
  const order = norms.map((_, j) => j).sort((a, b) => norms[b] - norms[a]);
  const r = cols;
  const S = new Float64Array(r);
  const Ur = new Float64Array(rows * r);
  const Ui = new Float64Array(rows * r);
  const Wr = new Float64Array(cols * r);
  const Wi = new Float64Array(cols * r);
  order.forEach((j, k) => {
    S[k] = norms[j];
    for (let i = 0; i < rows; i++) {
      if (norms[j] > 1e-300) {
        Ur[i * r + k] = Br[i * cols + j] / norms[j];
        Ui[i * r + k] = Bi[i * cols + j] / norms[j];
      }
    }
    for (let i = 0; i < cols; i++) {
      Wr[i * r + k] = Vr[i * cols + j];
      Wi[i * r + k] = Vi[i * cols + j];
    }
  });
  // B = U S W†. If B = A†, then A = W S U†: swap roles.
  return transpose ? { Ur: Wr, Ui: Wi, S, Vr: Ur, Vi: Ui, m, n, r } : { Ur, Ui, S, Vr: Wr, Vi: Wi, m, n, r };
}

export const entropyOf = (S) => S.reduce((e, v) => (v * v > 1e-15 ? e - v * v * Math.log2(v * v) : e), 0);

// Schmidt values across the cut after the first `a` qubits of a statevector (bit k = qubit k).
export function schmidt(re, im, N, a) {
  const rows = 1 << a;
  const cols = 1 << (N - a);
  const Mr = new Float64Array(rows * cols);
  const Mi = new Float64Array(rows * cols);
  for (let b = 0; b < re.length; b++) {
    const k = (b & (rows - 1)) * cols + (b >> a);
    Mr[k] = re[b];
    Mi[k] = im ? im[b] : 0;
  }
  return csvd(Mr, Mi, rows, cols).S;
}

// ----- MPS from a statevector, by successive SVDs (left-canonical), keeping at most chi values -----
// Returns { tensors, discarded } where discarded[k] is the weight thrown away at bond k.
export function fromStatevector(re, im, N, chi = Infinity) {
  const tensors = [];
  const discarded = [];
  // current remainder: matrix (l * 2) × rest
  let Rr = Float64Array.from(re);
  let Ri = im ? Float64Array.from(im) : new Float64Array(re.length);
  let l = 1;
  for (let k = 0; k < N - 1; k++) {
    const rest = Rr.length / (l * 2);
    // reorder so the row index is (a, s_k) with s_k = lowest remaining bit: remainder index = a + l*(s + 2*rest')
    const Mr = new Float64Array(l * 2 * rest);
    const Mi = new Float64Array(l * 2 * rest);
    for (let a = 0; a < l; a++) {
      for (let s = 0; s < 2; s++) {
        for (let c = 0; c < rest; c++) {
          const src = a * 2 * rest + (c * 2 + s); // remainder stored as a * (2*rest) + bits, low bit = this site
          Mr[(a * 2 + s) * rest + c] = Rr[src];
          Mi[(a * 2 + s) * rest + c] = Ri[src];
        }
      }
    }
    const d = csvd(Mr, Mi, l * 2, rest);
    let keep = Math.min(d.r, chi);
    while (keep > 1 && d.S[keep - 1] < 1e-14) keep--;
    discarded.push(Array.from(d.S).slice(keep).reduce((s, v) => s + v * v, 0));
    const A = { re: new Float64Array(l * 2 * keep), im: new Float64Array(l * 2 * keep), l, r: keep };
    for (let i = 0; i < l * 2; i++) {
      for (let j = 0; j < keep; j++) {
        A.re[i * keep + j] = d.Ur[i * d.r + j];
        A.im[i * keep + j] = d.Ui[i * d.r + j];
      }
    }
    tensors.push(A);
    // remainder = S V† (keep × rest), stored as b * rest + bits
    Rr = new Float64Array(keep * rest);
    Ri = new Float64Array(keep * rest);
    for (let b = 0; b < keep; b++) {
      for (let c = 0; c < rest; c++) {
        Rr[b * rest + c] = d.S[b] * d.Vr[c * d.r + b];
        Ri[b * rest + c] = -d.S[b] * d.Vi[c * d.r + b];
      }
    }
    l = keep;
  }
  tensors.push({ re: Rr, im: Ri, l, r: 1 });
  return { tensors, discarded };
}

// Contract an MPS back to a statevector (small N only).
export function toStatevector(mps) {
  const N = mps.tensors.length;
  // vec indexed by (bits so far) * χ + bond
  let vr = Float64Array.from([1]);
  let vi = Float64Array.from([0]);
  let chi = 1;
  for (let k = 0; k < N; k++) {
    const A = mps.tensors[k];
    const states = vr.length / chi;
    const nr = new Float64Array(states * 2 * A.r);
    const ni = new Float64Array(states * 2 * A.r);
    for (let st = 0; st < states; st++) {
      for (let a = 0; a < chi; a++) {
        const [xr, xi] = [vr[st * chi + a], vi[st * chi + a]];
        if (!xr && !xi) continue;
        for (let s = 0; s < 2; s++) {
          const ns = st | (s << k);
          for (let b = 0; b < A.r; b++) {
            const [ar, ai] = [A.re[(a * 2 + s) * A.r + b], A.im[(a * 2 + s) * A.r + b]];
            nr[ns * A.r + b] += xr * ar - xi * ai;
            ni[ns * A.r + b] += xr * ai + xi * ar;
          }
        }
      }
    }
    vr = nr;
    vi = ni;
    chi = A.r;
  }
  return { re: vr, im: vi };
}

// ----- TEBD -----
// A product state as an MPS (bond dimension 1): spins[k] = 0 for |0⟩, 1 for |1⟩.
export function productMPS(spins) {
  return {
    tensors: spins.map((s) => {
      const A = { re: new Float64Array(2), im: new Float64Array(2), l: 1, r: 1 };
      A.re[s] = 1;
      return A;
    }),
  };
}

// exp(−i h dt) for a 4×4 Hermitian two-site Hamiltonian h (re/im, basis |s_i s_{i+1}⟩ = s_i*2 + s_{i+1})
// (built as cos(h dt) − i sin(h dt), since hermitianFunction takes a real function)
export function twoSiteGate(hRe, hIm, dt) {
  const C = hermitianFunction(hRe, hIm, 4, (lambda) => Math.cos(lambda * dt));
  const S = hermitianFunction(hRe, hIm, 4, (lambda) => Math.sin(lambda * dt));
  return { re: C.re.map((v, i) => v + S.im[i]), im: C.im.map((v, i) => v - S.re[i]) };
}

// Apply a 4×4 gate to sites k, k+1 and split with an SVD, keeping at most chi values.
// direction 'right': site k left-normalised, the centre moves to k+1; 'left': the reverse.
// Returns the kept Schmidt values and the discarded weight.
export function applyGate(mps, k, gate, chi, direction) {
  const A = mps.tensors[k];
  const B = mps.tensors[k + 1];
  const [l, m, r] = [A.l, A.r, B.r];
  // θ(a, s, t, c) = Σ_b A(a,s,b) B(b,t,c), then apply the gate on (s,t)
  const Tr = new Float64Array(l * 4 * r);
  const Ti = new Float64Array(l * 4 * r);
  for (let a = 0; a < l; a++) {
    for (let s = 0; s < 2; s++) {
      for (let b = 0; b < m; b++) {
        const [xr, xi] = [A.re[(a * 2 + s) * m + b], A.im[(a * 2 + s) * m + b]];
        if (!xr && !xi) continue;
        for (let t = 0; t < 2; t++) {
          for (let c = 0; c < r; c++) {
            const [yr, yi] = [B.re[(b * 2 + t) * r + c], B.im[(b * 2 + t) * r + c]];
            const idx = ((a * 2 + s) * 2 + t) * r + c;
            Tr[idx] += xr * yr - xi * yi;
            Ti[idx] += xr * yi + xi * yr;
          }
        }
      }
    }
  }
  const Gr = new Float64Array(l * 4 * r);
  const Gi = new Float64Array(l * 4 * r);
  for (let a = 0; a < l; a++) {
    for (let out = 0; out < 4; out++) {
      for (let inn = 0; inn < 4; inn++) {
        const [gr, gi] = [gate.re[out * 4 + inn], gate.im[out * 4 + inn]];
        if (!gr && !gi) continue;
        for (let c = 0; c < r; c++) {
          const src = (a * 4 + inn) * r + c;
          const dst = (a * 4 + out) * r + c;
          Gr[dst] += gr * Tr[src] - gi * Ti[src];
          Gi[dst] += gr * Ti[src] + gi * Tr[src];
        }
      }
    }
  }
  // matrix (a, s) × (t, c)
  const d = csvd(Gr, Gi, l * 2, 2 * r);
  let keep = Math.min(d.r, chi);
  while (keep > 1 && d.S[keep - 1] < 1e-13) keep--;
  const total = Array.from(d.S).reduce((s, v) => s + v * v, 0);
  const kept = Array.from(d.S).slice(0, keep);
  const keptNorm = Math.sqrt(kept.reduce((s, v) => s + v * v, 0));
  const discarded = 1 - (keptNorm * keptNorm) / total;
  const S = kept.map((v) => v / keptNorm); // renormalise the state after truncation
  const nA = { re: new Float64Array(l * 2 * keep), im: new Float64Array(l * 2 * keep), l, r: keep };
  const nB = { re: new Float64Array(keep * 2 * r), im: new Float64Array(keep * 2 * r), l: keep, r };
  for (let i = 0; i < l * 2; i++) {
    for (let j = 0; j < keep; j++) {
      const f = direction === 'left' ? S[j] : 1;
      nA.re[i * keep + j] = f * d.Ur[i * d.r + j];
      nA.im[i * keep + j] = f * d.Ui[i * d.r + j];
    }
  }
  for (let j = 0; j < keep; j++) {
    const f = direction === 'right' ? S[j] : 1;
    for (let i = 0; i < 2 * r; i++) {
      // V† element (j, i) = conj(V(i, j))
      nB.re[j * 2 * r + i] = f * d.Vr[i * d.r + j];
      nB.im[j * 2 * r + i] = -f * d.Vi[i * d.r + j];
    }
  }
  mps.tensors[k] = nA;
  mps.tensors[k + 1] = nB;
  return { S, discarded };
}

// Two-site terms of the transverse-field Ising chain H = −J Σ Z_i Z_{i+1} − h Σ X_i, with each
// single-site field shared between the two bonds it touches (whole on the end sites' only bond).
export function isingBondHamiltonians(N, J, h) {
  const out = [];
  for (let k = 0; k < N - 1; k++) {
    const wl = k === 0 ? 1 : 0.5;
    const wr = k === N - 2 ? 1 : 0.5;
    const re = new Float64Array(16);
    const im = new Float64Array(16);
    for (let s = 0; s < 2; s++) {
      for (let t = 0; t < 2; t++) {
        const i = s * 2 + t;
        re[i * 4 + i] = -J * (s === t ? 1 : -1);
        re[(i ^ 2) * 4 + i] += -h * wl; // X on the left site
        re[(i ^ 1) * 4 + i] += -h * wr; // X on the right site
      }
    }
    out.push({ re, im });
  }
  return out;
}

// One second-order step of length dt: bondGates[k] = twoSiteGate(h_k, dt / 2), applied sweeping right over all bonds, then sweeping back.
// The centre starts and ends at site 0. Returns the Schmidt values seen on the way back (true
// Schmidt values: everything left of the bond is left-normalised, everything right of it right-).
export function tebdStep(mps, bondGates, chi) {
  const N = mps.tensors.length;
  let discarded = 0;
  for (let k = 0; k < N - 1; k++) discarded += applyGate(mps, k, bondGates[k], chi, 'right').discarded;
  const spectra = new Array(N - 1);
  for (let k = N - 2; k >= 0; k--) {
    const r = applyGate(mps, k, bondGates[k], chi, 'left');
    discarded += r.discarded;
    spectra[k] = r.S;
  }
  return { spectra, discarded };
}

export const bondDimensions = (mps) => mps.tensors.slice(0, -1).map((A) => A.r);

// A global quench for the area-law lesson (runs in a Web Worker): start in |00…0⟩ and evolve with
// the transverse-field Ising chain, by TEBD at several bond dimensions and exactly (statevector).
// Returns the half-chain entropy against time for each, and every bond's entropy for the largest χ.
export function quenchRun({ N, J, h, T, steps, chis }, progress) {
  const dt = T / steps;
  const gates = isingBondHamiltonians(N, J, h).map((b) => twoSiteGate(b.re, b.im, dt / 2));
  const half = (N >> 1) - 1; // bond between sites N/2 − 1 and N/2
  const out = { times: Array.from({ length: steps + 1 }, (_, i) => i * dt), tebd: {}, bonds: [], exact: [] };
  const total = chis.length + 1;
  chis.forEach((chi, c) => {
    const mps = productMPS(new Array(N).fill(0));
    const S = [0];
    const truncation = [0];
    for (let s = 0; s < steps; s++) {
      const r = tebdStep(mps, gates, chi);
      S.push(entropyOf(r.spectra[half]));
      truncation.push(truncation[truncation.length - 1] + r.discarded);
      if (c === chis.length - 1) out.bonds.push(r.spectra.map(entropyOf));
    }
    out.tebd[chi] = { S, truncation };
    progress?.((c + 1) / total);
  });
  const op = makeOperator(isingTerms(N, J, h), N);
  const re = new Float64Array(1 << N);
  const im = new Float64Array(1 << N);
  re[0] = 1;
  out.exact.push(0);
  for (let s = 0; s < steps; s++) {
    evolveExact(op, re, im, dt);
    out.exact.push(entropyOf(schmidt(re, im, N, half + 1)));
  }
  progress?.(1);
  return out;
}

// The three states of the area-law lesson on N qubits (runs in a Web Worker): a gapped and a
// critical Ising ground state and a random state. For each, the entanglement across every cut and
// the infidelity and storage of its best MPS at each bond dimension.
export function areaLawStates({ N, chis, seed = 11 }, progress) {
  const dim = 1 << N;
  const real = (h) => ({ re: groundStateVector(N, h), im: new Float64Array(dim) });
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(rng() || 1e-12)) * Math.cos(2 * Math.PI * rng());
  const re = Float64Array.from({ length: dim }, gauss);
  const im = Float64Array.from({ length: dim }, gauss);
  const nrm = Math.sqrt(re.reduce((a, v, i) => a + v * v + im[i] * im[i], 0));
  for (let i = 0; i < dim; i++) {
    re[i] /= nrm;
    im[i] /= nrm;
  }
  const list = [
    { id: 'gapped', name: 'gapped ground state (Ising, h = 2.5J)', ...real(2.5) },
    { id: 'critical', name: 'critical ground state (Ising, h = J)', ...real(1) },
    { id: 'random', name: 'random state', re, im },
  ];
  return list.map((st, k) => {
    const cuts = Array.from({ length: N - 1 }, (_, a) => entropyOf(schmidt(st.re, st.im, N, a + 1)));
    const compress = chis.map((chi) => {
      const mps = fromStatevector(st.re, st.im, N, chi);
      const v = toStatevector(mps);
      let or = 0;
      let oi = 0;
      let nv = 0;
      for (let b = 0; b < dim; b++) {
        or += st.re[b] * v.re[b] + st.im[b] * v.im[b];
        oi += st.re[b] * v.im[b] - st.im[b] * v.re[b];
        nv += v.re[b] ** 2 + v.im[b] ** 2;
      }
      return { chi, infidelity: Math.max(0, 1 - (or * or + oi * oi) / nv), params: mps.tensors.reduce((a, A) => a + 4 * A.l * A.r, 0) };
    });
    progress?.((k + 1) / list.length);
    return { id: st.id, name: st.name, cuts, compress };
  });
}

function groundStateVector(N, h) {
  const op = makeOperator(isingTerms(N, 1, h), N);
  const dim = 1 << N;
  return lanczosGround(op, new Float64Array(dim).fill(1 / Math.sqrt(dim))).vector;
}
