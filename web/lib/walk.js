// The discrete-time quantum walk on a line. The walker has a position x and a coin qubit c; one
// step applies a Hadamard to the coin, then moves x by -1 for c = 0 and +1 for c = 1. With noise p
// the coin is dephased (measured with probability p) after each coin toss; p = 1 is exactly the
// classical random walk. Noisy walks are evolved as a density matrix, so results are exact.

const R = Math.SQRT1_2;

// Initial coin: '0' = |0>, 'sym' = (|0> + i|1>)/sqrt 2 (gives a symmetric walk).
const COIN = { 0: [[1, 0], [0, 0]], sym: [[R, 0], [0, R]] };

// Pure walk: returns the position distribution after each of `steps` steps (Float64Array of
// length 2 steps + 1, index x + steps).
export function quantumWalk(steps, coin = '0') {
  const L = 2 * steps + 1;
  const re = [new Float64Array(L), new Float64Array(L)];
  const im = [new Float64Array(L), new Float64Array(L)];
  const [c0, c1] = COIN[coin];
  re[0][steps] = c0[0];
  im[0][steps] = c0[1];
  re[1][steps] = c1[0];
  im[1][steps] = c1[1];
  const frames = [distribution(re, im, L)];
  for (let t = 1; t <= steps; t++) {
    const nr = [new Float64Array(L), new Float64Array(L)];
    const ni = [new Float64Array(L), new Float64Array(L)];
    for (let i = 0; i < L; i++) {
      const a0r = re[0][i];
      const a0i = im[0][i];
      const a1r = re[1][i];
      const a1i = im[1][i];
      if (!a0r && !a0i && !a1r && !a1i) continue;
      // Hadamard coin, then shift: coin 0 left, coin 1 right
      if (i > 0) {
        nr[0][i - 1] += R * (a0r + a1r);
        ni[0][i - 1] += R * (a0i + a1i);
      }
      if (i < L - 1) {
        nr[1][i + 1] += R * (a0r - a1r);
        ni[1][i + 1] += R * (a0i - a1i);
      }
    }
    re[0] = nr[0];
    re[1] = nr[1];
    im[0] = ni[0];
    im[1] = ni[1];
    frames.push(distribution(re, im, L));
  }
  return frames;
}

function distribution(re, im, L) {
  const p = new Float64Array(L);
  for (let i = 0; i < L; i++) p[i] = re[0][i] ** 2 + im[0][i] ** 2 + re[1][i] ** 2 + im[1][i] ** 2;
  return p;
}

// Walk with coin dephasing probability p per step, as an exact density-matrix evolution.
// Basis index k = 2 i + c (i = x + steps).
export function noisyWalk(steps, coin = '0', p = 0) {
  if (p === 0) return quantumWalk(steps, coin);
  const L = 2 * steps + 1;
  const N = 2 * L;
  let rr = new Float64Array(N * N);
  let ri = new Float64Array(N * N);
  const [c0, c1] = COIN[coin];
  const amp = new Map([
    [2 * steps, c0],
    [2 * steps + 1, c1],
  ]);
  for (const [a, [ar, ai]] of amp) {
    for (const [b, [br, bi]] of amp) {
      rr[a * N + b] = ar * br + ai * bi;
      ri[a * N + b] = ai * br - ar * bi;
    }
  }
  const frames = [diag(rr, L, N)];
  // only positions within reach can be occupied; track the occupied window to save work
  for (let t = 1; t <= steps; t++) {
    const lo = Math.max(0, steps - t + 1);
    const hi = Math.min(L - 1, steps + t - 1);
    // 1. Hadamard on the coin: rho -> (I x H) rho (I x H)
    hadamardBoth(rr, ri, N, lo, hi);
    // 2. dephase the coin: off-diagonal coin blocks shrink by (1 - p)
    for (let a = 2 * lo; a <= 2 * hi + 1; a++) {
      for (let b = 2 * lo; b <= 2 * hi + 1; b++) {
        if ((a & 1) !== (b & 1)) {
          rr[a * N + b] *= 1 - p;
          ri[a * N + b] *= 1 - p;
        }
      }
    }
    // 3. shift: basis state (i, c) -> (i - 1 + 2c, c)
    const nr = new Float64Array(N * N);
    const ni = new Float64Array(N * N);
    const move = (k) => {
      const i = k >> 1;
      const c = k & 1;
      const j = i - 1 + 2 * c;
      return j < 0 || j >= L ? -1 : 2 * j + c;
    };
    for (let a = 2 * lo; a <= 2 * hi + 1; a++) {
      const a2 = move(a);
      if (a2 < 0) continue;
      for (let b = 2 * lo; b <= 2 * hi + 1; b++) {
        const b2 = move(b);
        if (b2 < 0) continue;
        nr[a2 * N + b2] = rr[a * N + b];
        ni[a2 * N + b2] = ri[a * N + b];
      }
    }
    rr = nr;
    ri = ni;
    frames.push(diag(rr, L, N));
  }
  return frames;
}

function hadamardBoth(rr, ri, N, lo, hi) {
  // rows: rho <- (I x H) rho
  for (let i = lo; i <= hi; i++) {
    const a = 2 * i;
    for (let b = 0; b < N; b++) {
      const x0r = rr[a * N + b];
      const x0i = ri[a * N + b];
      const x1r = rr[(a + 1) * N + b];
      const x1i = ri[(a + 1) * N + b];
      rr[a * N + b] = R * (x0r + x1r);
      ri[a * N + b] = R * (x0i + x1i);
      rr[(a + 1) * N + b] = R * (x0r - x1r);
      ri[(a + 1) * N + b] = R * (x0i - x1i);
    }
  }
  // columns: rho <- rho (I x H)  (H is real and symmetric)
  for (let a = 0; a < N; a++) {
    for (let j = lo; j <= hi; j++) {
      const b = 2 * j;
      const x0r = rr[a * N + b];
      const x0i = ri[a * N + b];
      const x1r = rr[a * N + b + 1];
      const x1i = ri[a * N + b + 1];
      rr[a * N + b] = R * (x0r + x1r);
      ri[a * N + b] = R * (x0i + x1i);
      rr[a * N + b + 1] = R * (x0r - x1r);
      ri[a * N + b + 1] = R * (x0i - x1i);
    }
  }
}

function diag(rr, L, N) {
  const p = new Float64Array(L);
  for (let i = 0; i < L; i++) p[i] = rr[2 * i * N + 2 * i] + rr[(2 * i + 1) * N + 2 * i + 1];
  return p;
}

// Classical unbiased random walk: binomial distribution over x = -t..t (same indexing).
export function classicalWalk(steps) {
  const L = 2 * steps + 1;
  let p = new Float64Array(L);
  p[steps] = 1;
  const frames = [p];
  for (let t = 1; t <= steps; t++) {
    const q = new Float64Array(L);
    for (let i = 0; i < L; i++) {
      if (!p[i]) continue;
      if (i > 0) q[i - 1] += p[i] / 2;
      if (i < L - 1) q[i + 1] += p[i] / 2;
    }
    p = q;
    frames.push(p);
  }
  return frames;
}

// Mean and standard deviation of x for a distribution indexed by x + steps.
export function spread(p, steps) {
  let m1 = 0;
  let m2 = 0;
  for (let i = 0; i < p.length; i++) {
    const x = i - steps;
    m1 += p[i] * x;
    m2 += p[i] * x * x;
  }
  return { mean: m1, sd: Math.sqrt(Math.max(0, m2 - m1 * m1)), second: m2 };
}
