// Small dense linear algebra for the simulations: complex Hermitian (and real symmetric)
// eigendecomposition by cyclic Jacobi rotations, plus a few matrix helpers.
// Matrices are row-major: element (i, j) of an n x n matrix is at i * n + j, with separate
// Float64Arrays for the real and imaginary parts.

// Eigenvalues (ascending) and orthonormal eigenvectors of the Hermitian matrix re + i im.
// vectors[k] = { re, im } is the eigenvector for values[k].
export function hermitianEigen(reIn, imIn, n) {
  const re = Float64Array.from(reIn);
  const im = Float64Array.from(imIn ?? new Float64Array(n * n));
  const vr = new Float64Array(n * n);
  const vi = new Float64Array(n * n);
  for (let i = 0; i < n; i++) vr[i * n + i] = 1;
  let scale = 0;
  for (let i = 0; i < n * n; i++) scale = Math.max(scale, Math.hypot(re[i], im[i]));
  const tol = 1e-15 * Math.max(scale, 1e-300);

  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off = Math.max(off, Math.hypot(re[p * n + q], im[p * n + q]));
    if (off <= tol) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const hr = re[p * n + q];
        const hi = im[p * n + q];
        const h = Math.hypot(hr, hi);
        if (h <= tol) continue;
        // U = D P with D = diag(1, e^{-i phi}) on (p, q) making the element real, then a real
        // Jacobi rotation P that zeroes it.
        const er = hr / h;
        const ei = -hi / h; // e^{-i phi}
        const tau = (re[q * n + q] - re[p * n + p]) / (2 * h);
        const t = (tau >= 0 ? 1 : -1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;
        // U entries (p,p) = c, (p,q) = s, (q,p) = -s e^{-i phi}, (q,q) = c e^{-i phi}
        const upp = [c, 0];
        const upq = [s, 0];
        const uqp = [-s * er, -s * ei];
        const uqq = [c * er, c * ei];
        // A <- A U (columns p and q), V <- V U
        for (const [Mr, Mi] of [
          [re, im],
          [vr, vi],
        ]) {
          for (let k = 0; k < n; k++) {
            const ar = Mr[k * n + p];
            const ai = Mi[k * n + p];
            const br = Mr[k * n + q];
            const bi = Mi[k * n + q];
            Mr[k * n + p] = ar * upp[0] - ai * upp[1] + br * uqp[0] - bi * uqp[1];
            Mi[k * n + p] = ar * upp[1] + ai * upp[0] + br * uqp[1] + bi * uqp[0];
            Mr[k * n + q] = ar * upq[0] - ai * upq[1] + br * uqq[0] - bi * uqq[1];
            Mi[k * n + q] = ar * upq[1] + ai * upq[0] + br * uqq[1] + bi * uqq[0];
          }
        }
        // A <- U^dagger A (rows p and q)
        for (let k = 0; k < n; k++) {
          const ar = re[p * n + k];
          const ai = im[p * n + k];
          const br = re[q * n + k];
          const bi = im[q * n + k];
          // conj(u) * a
          re[p * n + k] = upp[0] * ar + upp[1] * ai + uqp[0] * br + uqp[1] * bi;
          im[p * n + k] = upp[0] * ai - upp[1] * ar + uqp[0] * bi - uqp[1] * br;
          re[q * n + k] = upq[0] * ar + upq[1] * ai + uqq[0] * br + uqq[1] * bi;
          im[q * n + k] = upq[0] * ai - upq[1] * ar + uqq[0] * bi - uqq[1] * br;
        }
        re[p * n + q] = 0;
        im[p * n + q] = 0;
        re[q * n + p] = 0;
        im[q * n + p] = 0;
        im[p * n + p] = 0;
        im[q * n + q] = 0;
      }
    }
  }
  const order = Array.from({ length: n }, (_, k) => k).sort((a, b) => re[a * n + a] - re[b * n + b]);
  return {
    values: order.map((k) => re[k * n + k]),
    vectors: order.map((k) => ({
      re: Float64Array.from({ length: n }, (_, i) => vr[i * n + k]),
      im: Float64Array.from({ length: n }, (_, i) => vi[i * n + k]),
    })),
  };
}

// Real symmetric matrix: eigenvalues ascending and real eigenvectors (Float64Array each).
export function symmetricEigen(a, n) {
  const { values, vectors } = hermitianEigen(a, null, n);
  return { values, vectors: vectors.map((v) => v.re) };
}

// f(M) for a Hermitian matrix: V f(D) V^dagger. Returns { re, im }.
export function hermitianFunction(re, im, n, f) {
  const { values, vectors } = hermitianEigen(re, im, n);
  const outR = new Float64Array(n * n);
  const outI = new Float64Array(n * n);
  values.forEach((lam, k) => {
    const w = f(lam);
    if (w === 0) return;
    const { re: ur, im: ui } = vectors[k];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        // u_i conj(u_j)
        outR[i * n + j] += w * (ur[i] * ur[j] + ui[i] * ui[j]);
        outI[i * n + j] += w * (ui[i] * ur[j] - ur[i] * ui[j]);
      }
    }
  });
  return { re: outR, im: outI };
}

// Complex matrix product C = A B (n x n).
export function cmul(a, b, n) {
  const re = new Float64Array(n * n);
  const im = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const ar = a.re[i * n + k];
      const ai = a.im[i * n + k];
      if (ar === 0 && ai === 0) continue;
      for (let j = 0; j < n; j++) {
        re[i * n + j] += ar * b.re[k * n + j] - ai * b.im[k * n + j];
        im[i * n + j] += ar * b.im[k * n + j] + ai * b.re[k * n + j];
      }
    }
  }
  return { re, im };
}

export function dagger(a, n) {
  const re = new Float64Array(n * n);
  const im = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      re[j * n + i] = a.re[i * n + j];
      im[j * n + i] = -a.im[i * n + j];
    }
  }
  return { re, im };
}

export function trace(a, n) {
  let r = 0;
  let i = 0;
  for (let k = 0; k < n; k++) {
    r += a.re[k * n + k];
    i += a.im[k * n + k];
  }
  return [r, i];
}

// Real matrix helpers (row-major, rows x cols).
export function matmul(a, b, rows, inner, cols) {
  const out = new Float64Array(rows * cols);
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < inner; k++) {
      const v = a[i * inner + k];
      if (v === 0) continue;
      for (let j = 0; j < cols; j++) out[i * cols + j] += v * b[k * cols + j];
    }
  }
  return out;
}

// Thin singular value decomposition of a real m x n matrix by one-sided Jacobi (Hestenes).
// Returns { U (m x r), S (r), V (n x r) } with r = min(m, n), singular values descending,
// so that A = U diag(S) V^T.
export function svd(a, m, n) {
  const transpose = m < n;
  let rows = m;
  let cols = n;
  let A = Float64Array.from(a);
  if (transpose) {
    A = new Float64Array(m * n);
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) A[j * m + i] = a[i * n + j];
    rows = n;
    cols = m;
  }
  // Work on the columns of A (rows x cols, rows >= cols); V accumulates the rotations.
  const V = new Float64Array(cols * cols);
  for (let i = 0; i < cols; i++) V[i * cols + i] = 1;
  for (let sweep = 0; sweep < 80; sweep++) {
    let rotated = false;
    for (let p = 0; p < cols - 1; p++) {
      for (let q = p + 1; q < cols; q++) {
        let alpha = 0;
        let beta = 0;
        let gamma = 0;
        for (let i = 0; i < rows; i++) {
          const x = A[i * cols + p];
          const y = A[i * cols + q];
          alpha += x * x;
          beta += y * y;
          gamma += x * y;
        }
        if (Math.abs(gamma) <= 1e-15 * Math.sqrt(alpha * beta) || gamma === 0) continue;
        rotated = true;
        const zeta = (beta - alpha) / (2 * gamma);
        const t = (zeta >= 0 ? 1 : -1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = c * t;
        for (let i = 0; i < rows; i++) {
          const x = A[i * cols + p];
          const y = A[i * cols + q];
          A[i * cols + p] = c * x - s * y;
          A[i * cols + q] = s * x + c * y;
        }
        for (let i = 0; i < cols; i++) {
          const x = V[i * cols + p];
          const y = V[i * cols + q];
          V[i * cols + p] = c * x - s * y;
          V[i * cols + q] = s * x + c * y;
        }
      }
    }
    if (!rotated) break;
  }
  const S = new Float64Array(cols);
  for (let j = 0; j < cols; j++) {
    let s = 0;
    for (let i = 0; i < rows; i++) s += A[i * cols + j] ** 2;
    S[j] = Math.sqrt(s);
  }
  const order = Array.from({ length: cols }, (_, j) => j).sort((x, y) => S[y] - S[x]);
  const r = cols;
  const U = new Float64Array(rows * r);
  const Vs = new Float64Array(cols * r);
  const Ss = new Float64Array(r);
  order.forEach((j, k) => {
    Ss[k] = S[j];
    for (let i = 0; i < rows; i++) U[i * r + k] = S[j] > 1e-300 ? A[i * cols + j] / S[j] : 0;
    for (let i = 0; i < cols; i++) Vs[i * r + k] = V[i * cols + j];
  });
  // Columns of U for zero singular values are left at zero; callers truncate them anyway.
  if (!transpose) return { U, S: Ss, V: Vs, rank: r };
  // A^T = U S V^T  =>  A = V S U^T
  return { U: Vs, S: Ss, V: U, rank: r };
}
