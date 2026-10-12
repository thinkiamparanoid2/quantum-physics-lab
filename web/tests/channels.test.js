import assert from 'node:assert/strict';
import test from 'node:test';

import { CHANNELS, applyChannel, blochMap, blochOf, completeness, dilationOps, inputOps, kraus, mapVector, rhoOf } from '../lib/channels.js';
import { runOps, seededRandom } from '../lib/circuit.js';
import { reducedDensity } from '../lib/entanglement.js';

const close = (a, b, what, tol = 1e-12) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);
const names = Object.keys(CHANNELS);

test('every channel is trace preserving: sum of K†K is the identity', () => {
  for (const name of names) {
    for (const p of [0, 0.13, 0.5, 1]) {
      const c = completeness(kraus(name, p));
      [1, 0, 0, 1].forEach((v, i) => close(c.re[i], v, `${name} p=${p} re[${i}]`));
      c.im.forEach((v, i) => close(v, 0, `${name} p=${p} im[${i}]`));
    }
  }
});

test('the Bloch-ball maps have their textbook form', () => {
  const p = 0.3;
  const check = (name, diag, c) => {
    const map = blochMap(kraus(name, p));
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) close(map.M[i * 3 + j], i === j ? diag[i] : 0, `${name} M${i}${j}`);
      close(map.c[i], c[i], `${name} c${i}`);
    }
  };
  check('depolarizing', [1 - p, 1 - p, 1 - p], [0, 0, 0]);
  check('bitflip', [1, 1 - 2 * p, 1 - 2 * p], [0, 0, 0]);
  check('phaseflip', [1 - 2 * p, 1 - 2 * p, 1], [0, 0, 0]);
  check('amplitude', [Math.sqrt(1 - p), Math.sqrt(1 - p), 1 - p], [0, 0, p]);
  check('dephasing', [Math.sqrt(1 - p), Math.sqrt(1 - p), 1], [0, 0, 0]);
});

test('each Stinespring circuit, with the environment traced out, reproduces its channel', () => {
  const rng = seededRandom(5);
  for (const name of names) {
    for (const p of [0.2, 0.7]) {
      for (let k = 0; k < 5; k++) {
        const theta = rng() * Math.PI;
        const phi = rng() * 2 * Math.PI;
        const { env, ops } = dilationOps(name, p);
        const { state } = runOps(1 + env, [...inputOps(theta, phi), ...ops]);
        const fromCircuit = blochOf(reducedDensity(state, [0]));
        const r = [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
        const fromKraus = blochOf(applyChannel(kraus(name, p), rhoOf(r)));
        for (let i = 0; i < 3; i++) close(fromCircuit[i], fromKraus[i], `${name} p=${p} r${i}`, 1e-12);
      }
    }
  }
});

test('repeated noise flows to the fixed point: the centre, or |0> for amplitude damping', () => {
  let r = [0.3, -0.5, 0.6];
  const dep = blochMap(kraus('depolarizing', 0.2));
  for (let k = 0; k < 200; k++) r = mapVector(dep, r);
  r.forEach((v, i) => close(v, 0, `depolarized r${i}`, 1e-12));
  r = [0.3, -0.5, -0.6];
  const amp = blochMap(kraus('amplitude', 0.2));
  for (let k = 0; k < 300; k++) r = mapVector(amp, r);
  close(r[2], 1, 'damped to |0>', 1e-12);
});
