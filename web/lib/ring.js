// A particle on a ring of radius R (hbar = m = 1), optionally threaded by a magnetic flux Phi
// (in units of the flux quantum h/e). Stationary states e^{i n phi}/sqrt(2 pi) with integer n
// (the wavefunction must come back to itself) and E_n = (n - Phi)² / (2 R²).
// States are stored by their Fourier coefficients, so time evolution is exact.

import { fft } from './fft.js';

export const energy = (n, R = 1, flux = 0) => (n - flux) ** 2 / (2 * R * R);

// Mode number of FFT index j on an N-point ring.
export const modeOf = (j, N) => (j < N / 2 ? j : j - N);

// Full revival: every phase e^{-i n² t / 2R²} returns to 1 when t = 4 pi R².
export const revivalTime = (R = 1) => 4 * Math.PI * R * R;

// Fourier coefficients (FFT order) of psi given on N equally spaced angles.
export function toModes(re, im) {
  const r = Float64Array.from(re);
  const i = Float64Array.from(im);
  fft(r, i);
  return { re: r, im: i };
}

// psi(phi_k, t) on the N grid angles from modes c_n: sum_n c_n e^{-i E_n t} e^{i n phi}.
export function evolve(modes, t, R = 1, flux = 0) {
  const N = modes.re.length;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let j = 0; j < N; j++) {
    const ph = -energy(modeOf(j, N), R, flux) * t;
    const c = Math.cos(ph);
    const s = Math.sin(ph);
    re[j] = modes.re[j] * c - modes.im[j] * s;
    im[j] = modes.re[j] * s + modes.im[j] * c;
  }
  fft(re, im, true);
  return { re, im };
}

// A Gaussian packet on the ring (normalised so that sum |psi|² dphi = 1), centred at phi0 with
// angular width sigma and winding number k0 (mean angular momentum).
export function ringPacket(N, phi0, sigma, k0) {
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const dphi = (2 * Math.PI) / N;
  let norm = 0;
  for (let j = 0; j < N; j++) {
    const phi = j * dphi;
    let d = phi - phi0;
    d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    const env = Math.exp(-(d * d) / (4 * sigma * sigma));
    re[j] = env * Math.cos(k0 * phi);
    im[j] = env * Math.sin(k0 * phi);
    norm += env * env * dphi;
  }
  const s = 1 / Math.sqrt(norm);
  for (let j = 0; j < N; j++) {
    re[j] *= s;
    im[j] *= s;
  }
  return { re, im };
}

// A single stationary state, or an equal mix of +n and -n (a standing wave).
export function modeState(N, n, standing = false) {
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const dphi = (2 * Math.PI) / N;
  for (let j = 0; j < N; j++) {
    const phi = j * dphi;
    if (standing) re[j] = Math.cos(n * phi) / Math.sqrt(Math.PI);
    else {
      re[j] = Math.cos(n * phi) / Math.sqrt(2 * Math.PI);
      im[j] = Math.sin(n * phi) / Math.sqrt(2 * Math.PI);
    }
  }
  return { re, im };
}

// Angular probability current (1/R²) Im(psi* dpsi/dphi) summed over the ring = mean of (n - Phi)/R².
export function meanAngularMomentum(modes, flux = 0) {
  const N = modes.re.length;
  let num = 0;
  let den = 0;
  for (let j = 0; j < N; j++) {
    const w = modes.re[j] ** 2 + modes.im[j] ** 2;
    num += w * (modeOf(j, N) - flux);
    den += w;
  }
  return num / den;
}
