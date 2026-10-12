import assert from 'node:assert/strict';
import test from 'node:test';

import { classicalWalk, noisyWalk, quantumWalk, spread } from '../lib/walk.js';

const close = (a, b, what, tol = 1e-12) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);
const sum = (p) => p.reduce((a, b) => a + b, 0);

test('the quantum walk conserves probability and the symmetric coin gives a symmetric walk', () => {
  const frames = quantumWalk(60, 'sym');
  frames.forEach((p, t) => close(sum(p), 1, `norm at t=${t}`));
  const p = frames[60];
  for (let x = 1; x <= 60; x++) close(p[60 + x], p[60 - x], `p(${x}) = p(-${x})`);
});

test('a quantum walk spreads ballistically: <x²>/t² → 1 − 1/√2, against t for a classical walk', () => {
  const T = 400;
  for (const coin of ['0', 'sym']) {
    const { second } = spread(quantumWalk(T, coin)[T], T);
    close(second / (T * T), 1 - Math.SQRT1_2, `coin ${coin}`, 3e-3);
  }
  const c = spread(classicalWalk(T)[T], T);
  close(c.second, T, 'classical <x²> = t', 1e-9);
});

test('full coin dephasing turns the quantum walk into the classical random walk exactly', () => {
  const T = 30;
  const noisy = noisyWalk(T, '0', 1);
  const classical = classicalWalk(T);
  for (const t of [1, 5, 30]) noisy[t].forEach((v, i) => close(v, classical[t][i], `t=${t} i=${i}`, 1e-12));
});

test('the density-matrix walk with no noise matches the pure walk, and stays normalised with noise', () => {
  const T = 20;
  const pure = quantumWalk(T, 'sym');
  const tiny = noisyWalk(T, 'sym', 1e-15);
  tiny[T].forEach((v, i) => close(v, pure[T][i], `i=${i}`, 1e-10));
  const half = noisyWalk(T, 'sym', 0.3);
  half.forEach((p, t) => close(sum(p), 1, `norm at t=${t}`, 1e-10));
});
