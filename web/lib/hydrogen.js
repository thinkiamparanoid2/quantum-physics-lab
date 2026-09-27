// The hydrogen atom in atomic units (Bohr radius a0 = 1, energies in hartree): radial functions,
// real spherical harmonics (the orbitals chemists draw), energy levels and spectral lines.

export const HARTREE_EV = 27.211386;
// Rydberg constant for hydrogen (reduced-mass corrected), per metre. Gives vacuum wavelengths.
export const R_H = 10967758.3;
// A reduced-mass correction also shifts the levels: E_n = -13.598 eV / n^2.
export const RYDBERG_EV = 13.598434;

function factorial(n) {
  let f = 1;
  for (let k = 2; k <= n; k++) f *= k;
  return f;
}

// Generalised Laguerre polynomial L_k^a(x), by the three-term recurrence.
export function laguerre(k, a, x) {
  if (k === 0) return 1;
  let prev = 1;
  let cur = 1 + a - x;
  for (let j = 1; j < k; j++) {
    const next = ((2 * j + 1 + a - x) * cur - (j + a) * prev) / (j + 1);
    prev = cur;
    cur = next;
  }
  return cur;
}

// R_nl(r), normalised so that the integral of r^2 R^2 dr is 1.
export function radial(n, l, r) {
  const rho = (2 * r) / n;
  const norm = Math.sqrt((2 / n) ** 3 * (factorial(n - l - 1) / (2 * n * factorial(n + l))));
  return norm * Math.exp(-rho / 2) * rho ** l * laguerre(n - l - 1, 2 * l + 1, rho);
}

// Associated Legendre P_l^m(x) for m >= 0, without the Condon-Shortley phase.
export function legendre(l, m, x) {
  let pmm = 1;
  const s = Math.sqrt(Math.max(0, 1 - x * x));
  for (let i = 1; i <= m; i++) pmm *= (2 * i - 1) * s;
  if (l === m) return pmm;
  let pm1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) return pm1;
  let pll = 0;
  for (let ll = m + 2; ll <= l; ll++) {
    pll = ((2 * ll - 1) * x * pm1 - (ll + m - 1) * pmm) / (ll - m);
    pmm = pm1;
    pm1 = pll;
  }
  return pll;
}

// Real spherical harmonic: m > 0 goes with cos(m phi), m < 0 with sin(|m| phi).
export function realY(l, m, theta, phi) {
  const am = Math.abs(m);
  const N = Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * (factorial(l - am) / factorial(l + am)));
  const P = legendre(l, am, Math.cos(theta));
  if (m === 0) return N * P;
  return Math.SQRT2 * N * P * (m > 0 ? Math.cos(am * phi) : Math.sin(am * phi));
}

// psi_nlm at a Cartesian point.
export function orbital(n, l, m, x, y, z) {
  const r = Math.hypot(x, y, z);
  const theta = r === 0 ? 0 : Math.acos(z / r);
  const phi = Math.atan2(y, x);
  return radial(n, l, r) * realY(l, m, theta, phi);
}

const SUB = {
  0: [''],
  1: { '-1': 'y', 0: 'z', 1: 'x' },
  2: { '-2': 'xy', '-1': 'yz', 0: 'z²', 1: 'xz', 2: 'x²−y²' },
  3: { '-3': 'y(3x²−y²)', '-2': 'xyz', '-1': 'yz²', 0: 'z³', 1: 'xz²', 2: 'z(x²−y²)', 3: 'x(x²−3y²)' },
};
// Chemists' names: 1s, 2p_z, 3d_xy, ...
export function orbitalName(n, l, m) {
  const letter = 'spdfg'[l];
  return l === 0 ? `${n}s` : `${n}${letter}${SUB[l]?.[m] ? `_${SUB[l][m]}` : ''}`;
}

export const energyHartree = (n) => -1 / (2 * n * n);
export const energyEV = (n) => -RYDBERG_EV / (n * n);

// Vacuum wavelength in nm of the photon emitted in the jump upper -> lower.
export function wavelengthNm(upper, lower) {
  return 1e9 / (R_H * (1 / (lower * lower) - 1 / (upper * upper)));
}

export const SERIES = { 1: 'Lyman', 2: 'Balmer', 3: 'Paschen', 4: 'Brackett', 5: 'Pfund' };

// Approximate sRGB colour of visible light (380-780 nm); null outside.
export function wavelengthColor(nm) {
  if (nm < 380 || nm > 780) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) [r, b] = [-(nm - 440) / 60, 1];
  else if (nm < 490) [g, b] = [(nm - 440) / 50, 1];
  else if (nm < 510) [g, b] = [1, -(nm - 510) / 20];
  else if (nm < 580) [r, g] = [(nm - 510) / 70, 1];
  else if (nm < 645) [r, g] = [1, -(nm - 645) / 65];
  else r = 1;
  // dimmer toward the ends of vision
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
  const c = (v) => Math.round(255 * (v * f) ** 0.8);
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

// Radius that holds all but a sliver of the orbital's probability.
export const extent = (n) => 2 * n * n + 6 * n + 4;

// Sample points distributed as |psi|^2: radius from the radial distribution r^2 R^2 (inverse
// transform on a table), direction by rejection against |Y|^2. Returns [x, y, z, sign].
export function sampleCloud(n, l, m, count, rng) {
  const rMax = extent(n);
  const steps = 2000;
  const cdf = new Float64Array(steps + 1);
  for (let i = 1; i <= steps; i++) {
    const r = ((i - 0.5) / steps) * rMax;
    cdf[i] = cdf[i - 1] + r * r * radial(n, l, r) ** 2;
  }
  const total = cdf[steps];
  let yMax = 0;
  for (let i = 0; i <= 90; i++) for (let j = 0; j < 72; j++) yMax = Math.max(yMax, realY(l, m, (i / 90) * Math.PI, (j / 72) * 2 * Math.PI) ** 2);
  yMax *= 1.05;
  const pts = [];
  while (pts.length < count) {
    const u = rng() * total;
    let lo = 0;
    let hi = steps;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < u) lo = mid;
      else hi = mid;
    }
    const r = ((lo + (u - cdf[lo]) / (cdf[hi] - cdf[lo] || 1)) / steps) * rMax;
    let theta;
    let phi;
    let y;
    do {
      theta = Math.acos(2 * rng() - 1);
      phi = 2 * Math.PI * rng();
      y = realY(l, m, theta, phi);
    } while (rng() * yMax > y * y);
    const st = Math.sin(theta);
    const sign = Math.sign(radial(n, l, r) * y) || 1;
    pts.push([r * st * Math.cos(phi), r * st * Math.sin(phi), r * Math.cos(theta), sign]);
  }
  return pts;
}
