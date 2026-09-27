// Bloch-sphere geometry: the arrow for any qubit of a multi-qubit state, and every
// single-qubit gate as a rotation (axis, angle) of that arrow.

// Bloch vector (<X>, <Y>, <Z>) of qubit q. For a qubit entangled with others it is shorter
// than 1; for a maximally entangled qubit it is zero.
export function blochVector(s, q) {
  const bit = 1 << q;
  let x = 0;
  let y = 0;
  let z = 0;
  for (let b = 0; b < s.dim; b++) {
    if (b & bit) continue;
    const b1 = b | bit;
    const ar = s.re[b];
    const ai = s.im[b];
    const br = s.re[b1];
    const bi = s.im[b1];
    x += 2 * (ar * br + ai * bi);
    y += 2 * (ar * bi - ai * br);
    z += ar * ar + ai * ai - br * br - bi * bi;
  }
  return [x, y, z];
}

// Any 2x2 unitary equals, up to a global phase, cos(t/2) I - i sin(t/2) (n . sigma):
// a rotation of the Bloch arrow by angle t about axis n. Returns { axis, angle } with
// 0 <= angle <= pi (angle 0 means the gate only changes the global phase).
export function rotationOf(g) {
  const [ar, br, cr, dr] = g.re;
  const [ai, bi, ci, di] = g.im;
  const detR = ar * dr - ai * di - (br * cr - bi * ci);
  const detI = ar * di + ai * dr - (br * ci + bi * cr);
  const mod = Math.sqrt(Math.hypot(detR, detI));
  const arg = Math.atan2(detI, detR) / 2;
  const sr = mod * Math.cos(arg);
  const si = mod * Math.sin(arg);
  const n2 = sr * sr + si * si;
  // V = U / sqrt(det(U)), special unitary
  const div = (xr, xi) => [(xr * sr + xi * si) / n2, (xi * sr - xr * si) / n2];
  const [v00r, v00i] = div(ar, ai);
  const [v01r, v01i] = div(br, bi);
  const c = v00r;
  let nx = -v01i;
  let ny = -v01r;
  let nz = -v00i;
  const s = Math.hypot(nx, ny, nz);
  if (s < 1e-12) return { axis: [0, 0, 1], angle: 0 };
  let angle = 2 * Math.atan2(s, c);
  nx /= s;
  ny /= s;
  nz /= s;
  if (angle > Math.PI) {
    angle = 2 * Math.PI - angle;
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  return { axis: [nx, ny, nz], angle };
}

// Rodrigues' formula: rotate v by `angle` (right-handed) about the unit vector `axis`.
export function rotateVector(v, axis, angle) {
  const [x, y, z] = v;
  const [kx, ky, kz] = axis;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dot = kx * x + ky * y + kz * z;
  return [
    x * c + (ky * z - kz * y) * s + kx * dot * (1 - c),
    y * c + (kz * x - kx * z) * s + ky * dot * (1 - c),
    z * c + (kx * y - ky * x) * s + kz * dot * (1 - c),
  ];
}

export function length(v) {
  return Math.hypot(v[0], v[1], v[2]);
}
