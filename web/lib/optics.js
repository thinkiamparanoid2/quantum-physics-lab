// The experiments that started quantum mechanics: the photoelectric effect, the double slit,
// the Mach-Zehnder interferometer and the Elitzur-Vaidman bomb tester.

export const HC_EV_NM = 1239.84198; // h c in eV nm
export const H_OVER_E = 4.135667696e-15; // Planck's constant over the electron charge, V s
export const C = 299792458;

// Typical work functions in eV (real surfaces vary by a few tenths).
export const METALS = {
  cesium: { name: 'Cesium', phi: 2.14 },
  potassium: { name: 'Potassium', phi: 2.3 },
  sodium: { name: 'Sodium', phi: 2.36 },
  calcium: { name: 'Calcium', phi: 2.87 },
  zinc: { name: 'Zinc', phi: 4.33 },
  copper: { name: 'Copper', phi: 4.65 },
  platinum: { name: 'Platinum', phi: 5.65 },
};

// ----- photoelectric effect -----

export const photonEnergy = (nm) => HC_EV_NM / nm;
export const frequencyHz = (nm) => C / (nm * 1e-9);
export const thresholdNm = (phi) => HC_EV_NM / phi;

// Largest kinetic energy of an ejected electron (eV); negative means none escape.
export const maxKinetic = (nm, phi) => photonEnergy(nm) - phi;

// Current reaching the collector, in units of the photon arrival rate times a quantum
// efficiency of 1. Simple model: ejected electrons have kinetic energies spread evenly between
// 0 and K_max, so a retarding voltage V < 0 stops the fraction with K < -eV.
export function collectorCurrent({ nm, phi, intensity, volts }) {
  const K = maxKinetic(nm, phi);
  if (K <= 0) return 0;
  if (volts >= 0) return intensity;
  return intensity * Math.max(0, 1 - -volts / K);
}

// Least-squares straight line through points [x, y].
export function fitLine(points) {
  const n = points.length;
  const mx = points.reduce((s, [x]) => s + x, 0) / n;
  const my = points.reduce((s, [, y]) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (const [x, y] of points) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
  }
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

// ----- double slit -----

const sinc = (x) => (Math.abs(x) < 1e-12 ? 1 : Math.sin(x) / x);

// Far-field (Fraunhofer) intensity at screen position x, for slits of width a whose centres are
// d apart, screen at distance L (all lengths in the same unit as the wavelength). `open` is
// 'both', 'left' or 'right'; `marked` in [0, 1] is how completely a which-path detector tags the
// slit (1 = fully: no interference). Normalised so one open slit gives 1 at the centre.
export function slitIntensity(x, { lambda, d, a, L, open = 'both', marked = 0 }) {
  const s = x / Math.hypot(x, L);
  const env = sinc((Math.PI * a * s) / lambda) ** 2;
  if (open !== 'both') return env;
  const delta = (2 * Math.PI * d * s) / lambda;
  // |A_l|^2 + |A_r|^2 + 2 Re(A_l A_r*) * visibility, with visibility = 1 - marked
  return env * (2 + 2 * (1 - marked) * Math.cos(delta));
}

// A sampler for screen hits: draw x in [-half, half] with probability proportional to the
// intensity (inverse transform on a table).
export function slitSampler(params, half, bins = 2000) {
  const xs = new Float64Array(bins + 1);
  const cdf = new Float64Array(bins + 1);
  for (let i = 0; i <= bins; i++) xs[i] = -half + (2 * half * i) / bins;
  for (let i = 1; i <= bins; i++) cdf[i] = cdf[i - 1] + slitIntensity((xs[i - 1] + xs[i]) / 2, params);
  const total = cdf[bins];
  return (rng) => {
    const u = rng() * total;
    let lo = 0;
    let hi = bins;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < u) lo = mid;
      else hi = mid;
    }
    const f = (u - cdf[lo]) / (cdf[hi] - cdf[lo] || 1);
    return xs[lo] + f * (xs[hi] - xs[lo]);
  };
}

// de Broglie wavelength of an electron accelerated through `volts`, relativistic, in nm.
export function electronWavelengthNm(volts) {
  const mc2 = 510998.95; // eV
  const pc = Math.sqrt(volts * (volts + 2 * mc2)); // eV
  return HC_EV_NM / pc;
}

// ----- Mach-Zehnder interferometer -----

// Two paths: a (the photon goes straight through the first splitter) and b (it is reflected).
// A 50/50 splitter keeps the transmitted amplitude and multiplies the reflected one by i:
//   out_a = (in_a + i in_b)/sqrt2,  out_b = (i in_a + in_b)/sqrt2.
// The phase shifter adds e^{i phi} to path b. `block` ('a' or 'b') absorbs that arm;
// `marked` in [0, 1] tags the path (e.g. by polarisation) so the arms can't interfere;
// `secondSplitter` false removes the second beam splitter.
// Detector D1 sits in the output that is bright when phi = 0.
export function machZehnder({ phi = 0, block = null, marked = 0, secondSplitter = true } = {}) {
  const r = Math.SQRT1_2;
  // after the first splitter: a = 1/sqrt2, b = i/sqrt2, as [re, im]
  let a = [r, 0];
  let b = [0, r];
  b = [b[0] * Math.cos(phi) - b[1] * Math.sin(phi), b[0] * Math.sin(phi) + b[1] * Math.cos(phi)];
  let pBlocked = 0;
  if (block === 'a') {
    pBlocked = a[0] ** 2 + a[1] ** 2;
    a = [0, 0];
  }
  if (block === 'b') {
    pBlocked = b[0] ** 2 + b[1] ** 2;
    b = [0, 0];
  }
  const arms = { a, b };
  if (!secondSplitter) {
    // a runs on to D2, b to D1
    return { pD1: b[0] ** 2 + b[1] ** 2, pD2: a[0] ** 2 + a[1] ** 2, pBlocked, arms };
  }
  // Through the second splitter. The two contributions to each detector interfere with
  // visibility (1 - marked).
  const toA = [
    [a[0] * r, a[1] * r],
    [-b[1] * r, b[0] * r],
  ]; // a straight, i*b
  const toB = [
    [-a[1] * r, a[0] * r],
    [b[0] * r, b[1] * r],
  ]; // i*a, b straight
  const combine = ([u, v]) => {
    const incoherent = u[0] ** 2 + u[1] ** 2 + v[0] ** 2 + v[1] ** 2;
    const cross = 2 * (u[0] * v[0] + u[1] * v[1]);
    return incoherent + (1 - marked) * cross;
  };
  // Output b of the second splitter is bright at phi = 0, so it is D1.
  return { pD1: combine(toB), pD2: combine(toA), pBlocked, arms };
}

// ----- the Elitzur-Vaidman bomb tester -----

// A bomb sits in arm b. A live bomb absorbs (and explodes on) any photon in that arm, which is a
// which-path measurement; a dud lets the photon through untouched.
export function bombTest(live) {
  const { pD1, pD2, pBlocked } = machZehnder({ block: live ? 'b' : null });
  return { boom: pBlocked, bright: pD1, dark: pD2 };
}

// Quantum Zeno version (Kwiat et al. 1995): the photon's polarisation is turned by pi/(2N) each
// cycle and split by polarisation, with the bomb in the vertical path. A live bomb keeps
// resetting it to horizontal; a dud lets it turn all the way to vertical.
// Returns the chance that a live bomb is found without exploding.
export const zenoSuccess = (N) => Math.cos(Math.PI / (2 * N)) ** (2 * N);
