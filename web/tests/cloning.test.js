import assert from 'node:assert/strict';
import test from 'node:test';

import { blochAt, cnotCopy, copies, fidelity, ghzWMix, monogamy, optimalClone } from '../lib/cloning.js';
import { seededRandom, zeroState } from '../lib/circuit.js';

const close = (a, b, what, tol = 1e-12) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`);

test('the CNOT copier copies |0> and |1> but gives fidelity (1 + z²)/2 in general', () => {
  for (const [theta, phi] of [[0, 0], [Math.PI, 0], [Math.PI / 2, 0], [1.1, 2.3], [2.5, -0.7]]) {
    const r = blochAt(theta, phi);
    for (const c of copies(cnotCopy(theta, phi))) close(fidelity(r, c), (1 + r[2] ** 2) / 2, `theta=${theta}`);
  }
});

test('the optimal universal cloner gives both copies Bloch vector (2/3) r, fidelity 5/6, for every input', () => {
  const rng = seededRandom(9);
  for (let k = 0; k < 25; k++) {
    const theta = Math.acos(2 * rng() - 1);
    const phi = 2 * Math.PI * rng();
    const s = optimalClone(theta, phi);
    let norm = 0;
    for (let b = 0; b < 8; b++) norm += s.re[b] ** 2 + s.im[b] ** 2;
    close(norm, 1, 'normalised');
    const r = blochAt(theta, phi);
    for (const c of copies(s)) {
      c.forEach((v, i) => close(v, (2 / 3) * r[i], `component ${i}`));
      close(fidelity(r, c), 5 / 6, 'fidelity');
    }
  }
});

test('CKW monogamy: C²(A,B) + C²(A,C) <= C²(A,BC), with the same three-tangle from every qubit', () => {
  const rng = seededRandom(4);
  for (let k = 0; k < 20; k++) {
    const s = zeroState(3);
    let norm = 0;
    for (let b = 0; b < 8; b++) {
      s.re[b] = rng() - 0.5;
      s.im[b] = rng() - 0.5;
      norm += s.re[b] ** 2 + s.im[b] ** 2;
    }
    for (let b = 0; b < 8; b++) {
      s.re[b] /= Math.sqrt(norm);
      s.im[b] /= Math.sqrt(norm);
    }
    const { views } = monogamy(s);
    for (const v of views) assert.ok(v.tangle > -1e-9, `CKW violated: ${v.tangle}`);
    close(views[0].tangle, views[1].tangle, 'tangle from A vs B', 1e-8);
    close(views[0].tangle, views[2].tangle, 'tangle from A vs C', 1e-8);
  }
});

test('GHZ has three-tangle 1 and no pairwise entanglement; W has tangle 0 and C² = 4/9 per pair', () => {
  const ghz = monogamy(ghzWMix(0));
  close(ghz.views[0].tangle, 1, 'GHZ tangle', 1e-9);
  close(ghz.pair['01'], 0, 'GHZ pair', 1e-9);
  const w = monogamy(ghzWMix(Math.PI / 2));
  close(w.views[0].tangle, 0, 'W tangle', 1e-9);
  close(w.pair['01'], 4 / 9, 'W pair', 1e-9);
  close(w.views[0].withRest, 8 / 9, 'W one vs rest', 1e-9);
});
