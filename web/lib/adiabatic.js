// Two-level systems with a time-dependent field (hbar = 1): Landau-Zener sweeps and Berry's phase.
// H(t) = (b(t) . sigma) / 2 for a field vector b. A step uses the exact propagator of the field at
// the step's midpoint, exp(-i dt (b . sigma)/2) = cos(|b|dt/2) - i sin(|b|dt/2) (b^ . sigma).

// spinor [ar, ai, br, bi]
export function stepSpinor(psi, b, dt) {
  const B = Math.hypot(b[0], b[1], b[2]);
  if (B === 0) return psi;
  const c = Math.cos((B * dt) / 2);
  const s = Math.sin((B * dt) / 2) / B;
  const [ar, ai, br, bi] = psi;
  const [x, y, z] = b;
  // (b . sigma) psi = [z a + (x - i y) b, (x + i y) a - z b]
  const hr0 = z * ar + x * br + y * bi;
  const hi0 = z * ai + x * bi - y * br;
  const hr1 = x * ar - y * ai - z * br;
  const hi1 = x * ai + y * ar - z * bi;
  // psi' = c psi - i s h
  return [c * ar + s * hi0, c * ai - s * hr0, c * br + s * hi1, c * bi - s * hr1];
}

// Landau-Zener: b(t) = (Delta, 0, alpha t), swept from t = -T to T. Starts in the ground state of
// H(-T), close to |0> for alpha > 0 (the field then points down and the ground state points
// against it). Returns samples { t, p0, p1, bloch, pGround }, the chance of the diabatic jump
// (ending in the same basis state it started in, which is now the excited one), and the final
// excitation 1 - P(ground).
export function landauZener({ Delta, alpha, T, steps = 4000, samples = 300 }) {
  const ground = (b) => {
    // eigenvector of (b . sigma)/2 with eigenvalue -|b|/2, real for b in the x-z plane
    const th = Math.atan2(b[0], b[2]); // polar angle of b
    // the ground state points along -b: polar angle th + pi
    const a = th + Math.PI;
    return [Math.cos(a / 2), 0, Math.sin(a / 2), 0];
  };
  const field = (t) => [Delta, 0, alpha * t];
  let psi = ground(field(-T));
  const start = psi.slice();
  const dt = (2 * T) / steps;
  const out = [];
  const every = Math.max(1, Math.floor(steps / samples));
  const record = (t) => {
    const [ar, ai, br, bi] = psi;
    out.push({
      t,
      p0: ar * ar + ai * ai,
      p1: br * br + bi * bi,
      bloch: [2 * (ar * br + ai * bi), 2 * (ar * bi - ai * br), ar * ar + ai * ai - br * br - bi * bi],
      pGround: groundOverlap(psi, field(t)),
    });
  };
  record(-T);
  for (let k = 0; k < steps; k++) {
    const t = -T + (k + 0.5) * dt;
    psi = stepSpinor(psi, field(t), dt);
    if ((k + 1) % every === 0 || k === steps - 1) record(-T + (k + 1) * dt);
  }
  // diabatic transition: ending in the same basis state as at the start (the excited state now)
  const sameBasis = start[0] ** 2 > 0.5 ? out[out.length - 1].p0 : out[out.length - 1].p1;
  return { samples: out, diabatic: sameBasis, excited: 1 - out[out.length - 1].pGround };
}

function groundOverlap(psi, b) {
  const th = Math.atan2(b[0], b[2]) + Math.PI;
  const g = [Math.cos(th / 2), Math.sin(th / 2)];
  const re = g[0] * psi[0] + g[1] * psi[2];
  const im = g[0] * psi[1] + g[1] * psi[3];
  return re * re + im * im;
}

// The Landau-Zener formula for the chance of the diabatic jump (infinite sweep).
export const lzProbability = (Delta, alpha) => Math.exp((-Math.PI * Delta * Delta) / (2 * Math.abs(alpha)));

// Berry phase: a field of size B tilted by theta from z is carried once around the z axis in time
// Tloop. Starting aligned with the field (the ground state of -b . sigma/2 = state along +b), the
// returned state picks up the dynamic phase plus the geometric phase -Omega/2 with
// Omega = 2 pi (1 - cos theta), the solid angle of the cone.
export function berryLoop({ B, theta, Tloop, steps = 20000 }) {
  // H = -(b . sigma)/2: the state along +b is the ground state, energy -B/2.
  const b = (t) => {
    const ph = (2 * Math.PI * t) / Tloop;
    return [-B * Math.sin(theta) * Math.cos(ph), -B * Math.sin(theta) * Math.sin(ph), -B * Math.cos(theta)];
  };
  let psi = [Math.cos(theta / 2), 0, Math.sin(theta / 2), 0];
  const start = psi.slice();
  const dt = Tloop / steps;
  for (let k = 0; k < steps; k++) psi = stepSpinor(psi, b((k + 0.5) * dt), dt);
  // overall phase of <start|psi>
  const re = start[0] * psi[0] + start[2] * psi[2];
  const im = start[0] * psi[1] + start[2] * psi[3];
  const total = Math.atan2(im, re);
  const dynamic = (B / 2) * Tloop; // -E t with E = -B/2
  const geometric = -Math.PI * (1 - Math.cos(theta));
  return { total, dynamic, geometric, fidelity: re * re + im * im };
}

// Wrap an angle to (-pi, pi].
export const wrap = (a) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
