// The delta potential V(x) = -alpha delta(x) (attractive for alpha > 0), in units hbar = m = 1, and
// the double delta V = -alpha [delta(x - a) + delta(x + a)], a one-dimensional toy molecule.
// Matching conditions at a spike: psi is continuous and psi'(0+) - psi'(0-) = -2 alpha psi(0).

export const boundEnergy = (alpha) => -(alpha * alpha) / 2;
export const boundState = (x, alpha) => Math.sqrt(alpha) * Math.exp(-alpha * Math.abs(x));

// Scattering at energy E = k²/2: transmitted amplitude t = ik/(ik + alpha), reflected r = t - 1.
export function scattering(k, alpha) {
  const d = k * k + alpha * alpha;
  // t = ik (alpha - ik) / (alpha² + k²) = (k² + i k alpha) / d
  const t = [(k * k) / d, (k * alpha) / d];
  const r = [t[0] - 1, t[1]];
  return { t, r, T: (k * k) / d, R: (alpha * alpha) / d };
}

// Stationary scattering state e^{ikx} + r e^{-ikx} (x < 0), t e^{ikx} (x > 0), times e^{-iEt}.
export function scatteringState(xs, k, alpha, time = 0) {
  const { t, r } = scattering(k, alpha);
  const ph = (k * k * time) / 2;
  const re = new Float64Array(xs.length);
  const im = new Float64Array(xs.length);
  xs.forEach((x, i) => {
    let a;
    let b;
    if (x < 0) {
      a = Math.cos(k * x) + r[0] * Math.cos(k * x) + r[1] * Math.sin(k * x);
      b = Math.sin(k * x) - r[0] * Math.sin(k * x) + r[1] * Math.cos(k * x);
    } else {
      a = t[0] * Math.cos(k * x) - t[1] * Math.sin(k * x);
      b = t[0] * Math.sin(k * x) + t[1] * Math.cos(k * x);
    }
    re[i] = a * Math.cos(ph) + b * Math.sin(ph);
    im[i] = b * Math.cos(ph) - a * Math.sin(ph);
  });
  return { re, im };
}

function bisect(f, lo, hi) {
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (f(m) < 0) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

// Bound states of the double delta at +-a. Even: kappa (1 + tanh(kappa a)) = 2 alpha.
// Odd: kappa (1 + coth(kappa a)) = 2 alpha, which has a solution only when alpha a > 1/2.
export function doubleDeltaLevels(alpha, a) {
  const even = bisect((k) => k * (1 + Math.tanh(k * a)) - 2 * alpha, 1e-12, 2 * alpha);
  let odd = null;
  if (alpha * a > 0.5) odd = bisect((k) => k * (1 + 1 / Math.tanh(k * a)) - 2 * alpha, 1e-12, 2 * alpha);
  return {
    even: { kappa: even, E: -(even * even) / 2 },
    odd: odd === null ? null : { kappa: odd, E: -(odd * odd) / 2 },
  };
}

// Normalised double-delta bound state (parity 'even' or 'odd') at points xs.
export function doubleDeltaState(xs, alpha, a, parity) {
  const lv = doubleDeltaLevels(alpha, a)[parity];
  if (!lv) return null;
  const k = lv.kappa;
  const inner = (x) => (parity === 'even' ? Math.cosh(k * x) : Math.sinh(k * x));
  const atA = inner(a);
  const f = (x) => (Math.abs(x) <= a ? inner(x) : Math.sign(x) ** (parity === 'odd' ? 1 : 0) * atA * Math.exp(-k * (Math.abs(x) - a)));
  // normalise analytically: inside ∫_{-a}^{a} inner² + outside 2 atA² / (2k)
  const inside = parity === 'even' ? a + Math.sinh(2 * k * a) / (2 * k) : Math.sinh(2 * k * a) / (2 * k) - a;
  const norm = Math.sqrt(inside + (atA * atA) / k);
  return { E: lv.E, psi: Float64Array.from(xs, (x) => f(x) / norm) };
}
