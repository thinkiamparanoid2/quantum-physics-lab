import assert from 'node:assert/strict';
import test from 'node:test';

import { hermitianEigen } from '../lib/linalg.js';
import { energy, evolve, revivalTime, ringPacket, toModes } from '../lib/ring.js';

const close = (a, b, what, tol) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);

function overlap(a, b, N) {
  let r = 0;
  let i = 0;
  const d = (2 * Math.PI) / N;
  for (let j = 0; j < N; j++) {
    r += (a.re[j] * b.re[j] + a.im[j] * b.im[j]) * d;
    i += (a.re[j] * b.im[j] - a.im[j] * b.re[j]) * d;
  }
  return Math.hypot(r, i);
}

test('a packet on a ring revives exactly at t = 4πR², and at half that time it sits on the far side', () => {
  const N = 256;
  for (const R of [1, 1.5]) {
    const psi0 = ringPacket(N, 1, 0.25, 3);
    const modes = toModes(psi0.re, psi0.im);
    close(overlap(psi0, evolve(modes, revivalTime(R), R), N), 1, `full revival R=${R}`, 1e-10);
    const half = evolve(modes, revivalTime(R) / 2, R);
    const shifted = { re: new Float64Array(N), im: new Float64Array(N) };
    for (let j = 0; j < N; j++) {
      shifted.re[j] = psi0.re[(j + N / 2) % N];
      shifted.im[j] = psi0.im[(j + N / 2) % N];
    }
    close(overlap(shifted, half, N), 1, `half revival is the packet moved by π, R=${R}`, 1e-10);
  }
});

test('the ring levels (n − Φ)²/2R² match a finite-difference ring with the flux as a hopping phase', () => {
  const N = 160;
  const R = 1.2;
  const flux = 0.3;
  const h = (2 * Math.PI * R) / N;
  const re = new Float64Array(N * N);
  const im = new Float64Array(N * N);
  // -1/2 d²/ds² with a Peierls phase e^{-i 2 pi flux / N} on each hop
  const t = 1 / (2 * h * h);
  const th = (2 * Math.PI * flux) / N;
  for (let j = 0; j < N; j++) {
    re[j * N + j] = 2 * t;
    const k = (j + 1) % N;
    re[j * N + k] = -t * Math.cos(th);
    im[j * N + k] = t * Math.sin(th);
    re[k * N + j] = -t * Math.cos(th);
    im[k * N + j] = -t * Math.sin(th);
  }
  const { values } = hermitianEigen(re, im, N);
  const exact = [-3, -2, -1, 0, 1, 2, 3].map((n) => energy(n, R, flux)).sort((a, b) => a - b);
  // second-order finite differences: relative error about (n h / R)² / 12
  exact.slice(0, 5).forEach((e, i) => close(values[i], e, `level ${i}`, 4e-3 * (1 + e)));
});
