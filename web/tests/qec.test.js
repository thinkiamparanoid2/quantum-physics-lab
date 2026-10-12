import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { seededRandom } from '../lib/circuit.js';
import {
  correctionOf,
  logicalFlip,
  matchingGraph,
  mwpm,
  repetitionCode,
  sampleFaults,
  spaceTimeGraph,
  spaceTimeRun,
  surfaceCode,
  syndrome,
  thresholdScan,
  trialCodeCapacity,
  trialPhenomenological,
  unionFind,
} from '../lib/qec.js';

const ref = JSON.parse(readFileSync(new URL('./reference-qec.json', import.meta.url), 'utf8'));
const overlap = (a, b) => a.filter((q) => b.includes(q)).length;

test('the rotated surface code has d² − 1 commuting checks and anticommuting logical operators', () => {
  for (const d of [3, 5, 7]) {
    const code = surfaceCode(d);
    assert.equal(code.checks.length, d * d - 1, `d=${d} checks`);
    for (const a of code.checks) {
      for (const b of code.checks) if (a.type !== b.type) assert.equal(overlap(a.qubits, b.qubits) % 2, 0, 'X and Z checks commute');
      const logical = a.type === 'Z' ? code.logicalX : code.logicalZ;
      assert.equal(overlap(a.qubits, logical) % 2, 0, 'logicals commute with the checks');
    }
    assert.equal(overlap(code.logicalX, code.logicalZ) % 2, 1, 'logical X and Z anticommute');
  }
});

function decodeAll(code, graph, err, decoder) {
  const syn = syndrome(graph, err);
  const defects = [];
  syn.forEach((s, k) => s && defects.push(k));
  const edges = decoder === 'mwpm' ? mwpm(graph, defects).edges : unionFind(graph, defects).edges;
  const corr = correctionOf(graph, edges, code.n);
  const residual = err.map((v, q) => v ^ corr[q]);
  assert.ok(syndrome(graph, residual).every((s) => s === 0), 'the correction removes the syndrome');
  return logicalFlip(code, residual, 'X');
}

test('both decoders correct every error of weight ≤ (d − 1)/2 (exhaustive for d = 3 and 5)', () => {
  for (const d of [3, 5]) {
    const code = surfaceCode(d);
    const graph = matchingGraph(code, 'X');
    const t = (d - 1) / 2;
    const check = (qs) => {
      const err = new Uint8Array(code.n);
      for (const q of qs) err[q] = 1;
      for (const decoder of ['mwpm', 'uf']) assert.equal(decodeAll(code, graph, err, decoder), false, `d=${d} ${decoder} error ${qs}`);
    };
    for (let a = 0; a < code.n; a++) {
      check([a]);
      if (t >= 2) for (let b = a + 1; b < code.n; b++) check([a, b]);
    }
    // and some error of weight (d + 1)/2 defeats it: the top half of logical X's column
    const err = new Uint8Array(code.n);
    for (let i = 0; i < (d + 1) / 2; i++) err[code.logicalX[i]] = 1;
    assert.equal(decodeAll(code, graph, err, 'mwpm'), true, `d=${d}: weight ${(d + 1) / 2} fails`);
  }
});

test('minimum-weight matching agrees with PyMatching’s matching weight on random errors', () => {
  const codes = {};
  for (const s of ref.samples) {
    codes[s.d] ??= { code: surfaceCode(s.d) };
    const c = codes[s.d];
    c.graph ??= matchingGraph(c.code, 'X');
    const syn = syndrome(c.graph, Uint8Array.from(s.error));
    const defects = [];
    syn.forEach((v, k) => v && defects.push(k));
    assert.equal(mwpm(c.graph, defects).weight, s.weight, `d=${s.d}`);
  }
});

test('logical error rates match PyMatching within statistical error, and show a threshold', () => {
  const rng = seededRandom(99);
  const mine = {};
  for (const r of ref.rates) {
    const code = surfaceCode(r.d);
    const graph = matchingGraph(code, 'X');
    const shots = 6000;
    let fails = 0;
    for (let k = 0; k < shots; k++) if (trialCodeCapacity(code, graph, r.p, 'mwpm', rng)) fails++;
    const pj = fails / shots;
    const pp = r.fails / r.shots;
    const sigma = Math.sqrt((pj * (1 - pj)) / shots + (pp * (1 - pp)) / r.shots);
    assert.ok(Math.abs(pj - pp) < 4 * sigma, `d=${r.d} p=${r.p}: ${pj} vs ${pp} (σ ${sigma.toFixed(4)})`);
    mine[`${r.d}|${r.p}`] = pj;
  }
  assert.ok(mine['7|0.06'] < mine['3|0.06'], 'below threshold, bigger is better');
  assert.ok(mine['7|0.12'] > mine['3|0.12'], 'above threshold, bigger is worse');
});

test('with measurement errors (phenomenological noise) the threshold drops to a few per cent', () => {
  const rng = seededRandom(3);
  const rate = (d, p) => {
    const code = surfaceCode(d);
    const st = spaceTimeGraph(code, d);
    let fails = 0;
    const shots = 1500;
    for (let k = 0; k < shots; k++) if (trialPhenomenological(code, st, p, p, 'uf', rng)) fails++;
    return fails / shots;
  };
  assert.ok(rate(5, 0.01) < rate(3, 0.01), 'p = 1%: d = 5 beats d = 3');
  assert.ok(rate(5, 0.06) > rate(3, 0.06), 'p = 6%: d = 5 loses');
});

test('the threshold lesson’s scan is reproducible, reports progress, and shows Λ > 1 below threshold', () => {
  const seen = [];
  const args = { distances: [3, 5, 7], ps: [0.03, 0.15], trials: 1500, decoder: 'uf', noise: 'code-capacity', seed: 7 };
  const a = thresholdScan(args, (f) => seen.push(f));
  const b = thresholdScan(args);
  assert.deepEqual(a, b);
  assert.equal(seen.length, 6);
  assert.equal(seen.at(-1), 1);
  const [r3, r5, r7] = a.map((r) => r.row);
  assert.ok(r3[0].rate / r5[0].rate > 1.5 && r5[0].rate > r7[0].rate, `below threshold: ${r3[0].rate} ${r5[0].rate} ${r7[0].rate}`);
  assert.ok(r7[1].rate > r3[1].rate, 'above threshold, d = 7 loses to d = 3');
});

test('a space-time run lights detection events exactly at the ends of its fault edges', () => {
  const rng = seededRandom(5);
  for (const code of [repetitionCode(5), surfaceCode(3), surfaceCode(5)]) {
    const st = spaceTimeGraph(code, code.d);
    for (let k = 0; k < 50; k++) {
      const faults = sampleFaults(st, 0.08, 0.08, rng);
      const odd = new Uint8Array(st.nodes);
      for (const f of faults) {
        odd[st.edges[f].a] ^= 1;
        odd[st.edges[f].b] ^= 1;
      }
      const expected = [];
      odd.forEach((v, node) => v && node !== st.boundary && expected.push(node));
      assert.deepEqual(spaceTimeRun(st, faults).defects, expected);
    }
  }
});

test('in space-time, matching corrects every pattern of one or two faults (repetition code, d = 5, 5 rounds)', () => {
  const code = repetitionCode(5);
  const st = spaceTimeGraph(code, 5);
  const E = st.edges.length;
  for (let a = 0; a < E; a++) {
    for (let b = a; b < E; b++) {
      const faults = a === b ? [a] : [a, b];
      const run = spaceTimeRun(st, faults);
      const corr = correctionOf(st, mwpm(st, run.defects).edges, code.n);
      const residual = run.err.map((v, q) => v ^ corr[q]);
      assert.ok(!logicalFlip(code, residual, 'X'), `faults ${faults}`);
    }
  }
});

test('with measurement errors, logical error rates match PyMatching (repetition and surface codes)', () => {
  const rng = seededRandom(21);
  for (const r of ref.phenomenological) {
    const code = r.code === 'repetition' ? repetitionCode(r.d) : surfaceCode(r.d);
    const st = spaceTimeGraph(code, r.rounds);
    const shots = 4000;
    let fails = 0;
    let fallback = 0;
    for (let k = 0; k < shots; k++) {
      const run = spaceTimeRun(st, sampleFaults(st, r.p, r.p, rng));
      const m = mwpm(st, run.defects);
      if (!m) fallback++;
      const corr = correctionOf(st, m ? m.edges : unionFind(st, run.defects).edges, code.n);
      if (logicalFlip(code, run.err.map((v, q) => v ^ corr[q]), 'X')) fails++;
    }
    // the rare run with more than MWPM_LIMIT detection events falls back to union-find
    assert.ok(fallback < shots / 50, `${r.code} d=${r.d}: ${fallback} runs too big for exact matching`);
    const pj = fails / shots;
    const pp = r.fails / r.shots;
    const sigma = Math.sqrt((pj * (1 - pj)) / shots + (pp * (1 - pp)) / r.shots);
    assert.ok(Math.abs(pj - pp) < 4 * sigma, `${r.code} d=${r.d} p=${r.p}: ${pj} vs ${pp} (σ ${sigma.toFixed(4)})`);
  }
});
