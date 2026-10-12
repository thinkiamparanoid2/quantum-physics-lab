import assert from 'node:assert/strict';
import test from 'node:test';

import { probabilities, runOps } from '../lib/circuit.js';
import { applyReadout, exponentialFit, fold, isingCircuit, mitigateReadout, probsOf, richardson, runNoisy, zz } from '../lib/mitigation.js';

const ops = isingCircuit({});
const ideal = zz(probsOf(runNoisy(3, ops)), 0, 1);

test('mitigation: the density-matrix simulator equals the statevector engine, and folding is exact without noise', () => {
  const sv = probabilities(runOps(3, ops.map((o) => (o.gate === 'CNOT' ? { gate: 'X', target: o.target, controls: [o.control] } : o))).state);
  const dm = probsOf(runNoisy(3, ops));
  sv.forEach((p, i) => assert.ok(Math.abs(p - dm[i]) < 1e-12));
  const folded = probsOf(runNoisy(3, fold(ops, 2)));
  folded.forEach((p, i) => assert.ok(Math.abs(p - dm[i]) < 1e-12));
});

test('readout mitigation inverts independent readout errors exactly', () => {
  const p = probsOf(runNoisy(3, ops, { p2: 0.02 }));
  const back = mitigateReadout(applyReadout(p, 3, 0.03, 0.06), 3, 0.03, 0.06);
  p.forEach((v, i) => assert.ok(Math.abs(back[i] - v) < 1e-12));
});

test('zero-noise extrapolation: exact for global depolarizing noise, a large improvement for local noise', () => {
  const lams = [1, 3, 5];
  const glob = lams.map((l, k) => zz(probsOf(runNoisy(3, fold(ops, k), { pg: 0.01 })), 0, 1));
  assert.ok(Math.abs(exponentialFit(lams, glob) - ideal) < 1e-10);
  const local = lams.map((l, k) => zz(probsOf(runNoisy(3, fold(ops, k), { p1: 0.002, p2: 0.02 })), 0, 1));
  const raw = Math.abs(local[0] - ideal);
  assert.ok(Math.abs(exponentialFit(lams, local) - ideal) < raw / 10);
  assert.ok(Math.abs(richardson(lams, local) - ideal) < raw / 3);
});
