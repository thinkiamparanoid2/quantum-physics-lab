// Spin-1/2: spinors, measurement along any axis, Stern-Gerlach chains, and magnetic resonance.
// A spinor is [ar, ai, br, bi]: amplitude a for spin up along z, b for spin down. Units hbar = 1.

import { rotateVector } from './bloch.js';

// Spin up along the direction with polar angle theta (from +z) and azimuth phi.
export function upAlong(theta, phi = 0) {
  return [Math.cos(theta / 2), 0, Math.sin(theta / 2) * Math.cos(phi), Math.sin(theta / 2) * Math.sin(phi)];
}

export function downAlong(theta, phi = 0) {
  return upAlong(Math.PI - theta, phi + Math.PI);
}

// |<u|v>|^2 for spinors u, v.
export function overlap2([ar, ai, br, bi], [cr, ci, dr, di]) {
  const re = ar * cr + ai * ci + br * dr + bi * di;
  const im = ar * ci - ai * cr + br * di - bi * dr;
  return re * re + im * im;
}

export function blochOf([ar, ai, br, bi]) {
  // <sigma> for a normalised spinor.
  return [2 * (ar * br + ai * bi), 2 * (ar * bi - ai * br), ar * ar + ai * ai - br * br - bi * bi];
}

// Direction of a magnet: 'z', 'x', 'y' or an angle in degrees tilted from z toward x.
export function magnetAxis(dir) {
  if (dir === 'z') return [0, 0];
  if (dir === 'x') return [Math.PI / 2, 0];
  if (dir === 'y') return [Math.PI / 2, Math.PI / 2];
  return [(Number(dir) * Math.PI) / 180, 0];
}

// Measure along (theta, phi). `state` null means an unpolarised beam straight from the oven.
export function measure(state, theta, phi) {
  const up = upAlong(theta, phi);
  const down = downAlong(theta, phi);
  const pUp = state ? overlap2(up, state) : 0.5;
  return { pUp, pDown: 1 - pUp, up, down };
}

// Fractions of the atoms leaving the oven that reach each place in a chain of magnets. Every magnet
// but the last passes one output (`pass`: 'up' or 'down') and blocks the other; the last magnet
// sends both beams to the screen.
export function chainIntensities(magnets) {
  let state = null;
  let intensity = 1;
  const stages = [];
  magnets.forEach((m, k) => {
    const [theta, phi] = magnetAxis(m.dir);
    const { pUp, pDown, up, down } = measure(state, theta, phi);
    const last = k === magnets.length - 1;
    stages.push({ in: intensity, up: intensity * pUp, down: intensity * pDown, pUp, pass: last ? null : m.pass });
    if (!last) {
      state = m.pass === 'up' ? up : down;
      intensity *= m.pass === 'up' ? pUp : pDown;
    }
  });
  return stages;
}

// Follow one atom through the chain with random numbers from rng. Returns where it ends:
// { stage, out: 'up' | 'down', blocked } (blocked means it hit the stop after magnet `stage`).
export function sendAtom(magnets, rng) {
  let state = null;
  for (let k = 0; k < magnets.length; k++) {
    const [theta, phi] = magnetAxis(magnets[k].dir);
    const { pUp, up, down } = measure(state, theta, phi);
    const out = rng() < pUp ? 'up' : 'down';
    if (k === magnets.length - 1) return { stage: k, out, blocked: false };
    if (out !== magnets[k].pass) return { stage: k, out, blocked: true };
    state = out === 'up' ? up : down;
  }
  return null;
}

// ----- magnetic resonance -----

// Exact solution for H = w0/2 sz + W/2 (cos wt sx + sin wt sy): a static field along z (Larmor
// frequency w0) plus a field of strength W rotating at w in the x-y plane. In the frame rotating at w
// the Hamiltonian is constant, (D sz + W sx)/2 with detuning D = w0 - w. Returns the lab-frame spinor.
export function resonance(psi0, { w0, w, W }, t) {
  const D = w0 - w;
  const g = Math.hypot(D, W);
  // exp(-i (D sz + W sx) t / 2) = cos(gt/2) - i sin(gt/2) (D sz + W sx)/g
  const c = Math.cos((g * t) / 2);
  const s = g > 0 ? Math.sin((g * t) / 2) / g : t / 2;
  const [ar, ai, br, bi] = psi0;
  // (D sz + W sx) psi = [D a + W b, W a - D b]
  const hr = [D * ar + W * br, D * ai + W * bi, W * ar - D * br, W * ai - D * bi];
  // psi_rot = c psi - i s h
  const r = [c * ar + s * hr[1], c * ai - s * hr[0], c * br + s * hr[3], c * bi - s * hr[2]];
  // back to the lab frame: exp(-i w t sz / 2)
  const p = (w * t) / 2;
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  return [r[0] * cp + r[1] * sp, r[1] * cp - r[0] * sp, r[2] * cp - r[3] * sp, r[3] * cp + r[2] * sp];
}

// Rabi's formula: chance of having flipped from up to down.
export function rabiProbability({ w0, w, W }, t) {
  const D = w0 - w;
  const g2 = D * D + W * W;
  if (g2 === 0) return 0;
  return ((W * W) / g2) * Math.sin((Math.sqrt(g2) * t) / 2) ** 2;
}

// Spin echo with an ensemble of spins, in the frame rotating at the average Larmor frequency.
// Each spin has its own frequency offset; pulses are instantaneous rotations about x.
// `pulses` is a list of { t, angle } sorted by time. Returns the Bloch vectors at time t.
export function ensembleAt(offsets, pulses, t) {
  return offsets.map((d) => {
    let v = [0, 0, 1];
    let now = 0;
    for (const p of pulses) {
      if (p.t > t) break;
      v = rotateVector(v, [0, 0, 1], d * (p.t - now));
      v = rotateVector(v, [1, 0, 0], p.angle);
      now = p.t;
    }
    return rotateVector(v, [0, 0, 1], d * (t - now));
  });
}
