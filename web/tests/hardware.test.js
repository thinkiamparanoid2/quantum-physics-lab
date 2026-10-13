import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { evolveExact } from '../lib/dynamics.js';
import { HARDWARE } from '../lib/hardware-data.js';
import { zExpectations } from '../lib/manybody.js';
import { observables, schwingerModel } from '../lib/schwinger.js';

const raw = (name) => JSON.parse(readFileSync(new URL(`../../hardware_runs/results/${name}`, import.meta.url)));

test('hardware: the Bell-test S on the site is recomputed exactly from the raw IBM counts', () => {
  const data = raw('chsh-ibm_kingston.json');
  const E = {};
  for (const r of data.runs) {
    if (r.kind !== 'chsh') continue;
    const shots = Object.values(r.counts).reduce((a, b) => a + b, 0);
    E[`${r.a}${r.b}`] = Object.entries(r.counts).reduce((s, [k, v]) => s + ((k.split('1').length - 1) % 2 ? -v : v), 0) / shots;
  }
  const S = E.a0b0 + E.a0b1 + E.a1b0 - E.a1b1;
  assert.ok(Math.abs(S - HARDWARE.chsh.S) < 6e-4);
  assert.equal(data.job_id, HARDWARE.chsh.job);
  assert.ok(HARDWARE.chsh.S - 2 > 10 * HARDWARE.chsh.S_err, 'a clear violation of the classical bound');
});

test('hardware: the Schwinger reference values (Python/Qiskit) equal the site’s own engine', () => {
  const m = schwingerModel(4, { x: 1, mass: 0.5, g: 0.6 });
  for (const r of HARDWARE.schwinger.rows) {
    const re = new Float64Array(16);
    const im = new Float64Array(16);
    re[m.vacuum] = 1;
    evolveExact(m.op, re, im, r.t);
    assert.ok(Math.abs(observables(m, zExpectations(4, re, im)).total - r.exact) < 1e-4, `t = ${r.t}`);
  }
  // the raw counts behind the readout-unmitigated values are in the repository
  assert.equal(raw('schwinger-run2-ibm_kingston.json').job_id, HARDWARE.schwinger.job);
});
