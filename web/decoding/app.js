import { seededRandom } from '../lib/circuit.js';
import { correctionOf, logicalFlip, matchingGraph, mwpm, surfaceCode, syndrome, unionFind } from '../lib/qec.js';
import { runLesson } from '../ui/lesson-kit.js';
import { decodeErrors, drawSurface, encodeErrors } from '../ui/surface-view.js';

// Decoding the surface code: from the lit checks back to a correction. Two decoders from
// lib/qec.js: exact minimum-weight matching (its matching weights equal PyMatching's in the tests)
// and union-find. X errors (seen by Z checks) and Z errors (seen by X checks) are decoded separately.

let hit = () => -1;

function decodeType(code, graph, err, decoder) {
  const defects = [];
  syndrome(graph, err).forEach((v, k) => v && defects.push(k));
  if (decoder === 'mwpm') {
    const m = mwpm(graph, defects);
    if (m) return { defects, edges: m.edges, pairs: m.pairs, weight: m.weight, rounds: [] };
  }
  const u = unionFind(graph, defects, { trace: true });
  return { defects, edges: u.edges, pairs: [], rounds: u.rounds };
}

function compute(s) {
  const code = surfaceCode(s.d);
  const { errX, errZ } = decodeErrors(s.errs, code.n);
  const gX = matchingGraph(code, 'X');
  const gZ = matchingGraph(code, 'Z');
  const rx = decodeType(code, gX, errX, s.decoder);
  const rz = decodeType(code, gZ, errZ, s.decoder);
  const cX = correctionOf(gX, rx.edges, code.n);
  const cZ = correctionOf(gZ, rz.edges, code.n);
  const resX = errX.map((v, q) => v ^ cX[q]);
  const resZ = errZ.map((v, q) => v ^ cZ[q]);
  const lit = new Set();
  for (const [g, r] of [
    [gX, rx],
    [gZ, rz],
  ]) {
    for (const k of r.defects) lit.add(code.checks.indexOf(g.checks[k]));
  }
  const corr = Uint8Array.from(cX, (v, q) => v | cZ[q]);
  return {
    code,
    errX,
    errZ,
    gX,
    gZ,
    rx,
    rz,
    lit,
    corr,
    failX: logicalFlip(code, resX, 'X'),
    failZ: logicalFlip(code, resZ, 'Z'),
    weight: errX.reduce((a, v, q) => a + (v || errZ[q] ? 1 : 0), 0),
    fixes: corr.reduce((a, v) => a + v, 0),
  };
}

function draw(api) {
  const m = api.model;
  const s = api.settings;
  const rounds = Math.max(m.rx.rounds.length, m.rz.rounds.length);
  const r = s.round < 0 || s.round >= rounds ? rounds - 1 : s.round;
  const grownSets =
    s.decoder === 'uf' && rounds
      ? [
          [m.gX, m.rx],
          [m.gZ, m.rz],
        ]
          .filter(([, res]) => res.rounds.length)
          .map(([graph, res]) => ({ graph, support: res.rounds[Math.min(r, res.rounds.length - 1)] }))
      : [];
  const showFix = s.show === 'fix';
  hit = drawSurface(api.canvas('lattice'), {
    theme: api.theme,
    code: m.code,
    errX: s.show === 'syndrome' ? null : m.errX,
    errZ: s.show === 'syndrome' ? null : m.errZ,
    lit: m.lit,
    correction: showFix ? m.corr : null,
    pairSets:
      s.decoder === 'mwpm' && showFix
        ? [
            { graph: m.gX, pairs: m.rx.pairs },
            { graph: m.gZ, pairs: m.rz.pairs },
          ]
        : [],
    grownSets: showFix ? grownSets : [],
    label: s.show === 'syndrome' ? 'what the decoder sees: only the lit checks' : showFix ? 'amber rings: the decoder’s correction' : 'the actual errors',
  });
  const fail = m.failX || m.failZ;
  const verdict =
    m.lit.size === 0 && m.weight === 0
      ? 'No errors, nothing to do.'
      : fail
        ? `<b>Logical error.</b> The correction removes the syndrome, but together with the real error it forms a chain across the patch (${[m.failX && 'X̄', m.failZ && 'Z̄'].filter(Boolean).join(' and ')}).`
        : '<b>Success.</b> Correction and error together form only harmless loops (stabilizers): the logical qubit is untouched.';
  const w = m.rx.weight !== undefined && m.rz.weight !== undefined ? `${m.rx.weight + m.rz.weight}` : '–';
  api.el('result').innerHTML = `<div class="readout-grid">
      <div class="stat"><span>Actual errors</span><b>${m.weight}</b></div>
      <div class="stat"><span>Checks lit</span><b>${m.lit.size}</b></div>
      <div class="stat"><span>Qubits the decoder flips</span><b>${m.fixes}</b></div>
      ${s.decoder === 'mwpm' ? `<div class="stat"><span>Total matching length</span><b>${w}</b></div>` : `<div class="stat"><span>Growth rounds</span><b>${rounds}</b></div>`}</div>
    <p class="hint">${verdict}</p>`;
}

const at = (i, j, d = 5) => i * d + j;
const errs = (list) => list.map(([q, t]) => `${q}${t}`).join(',');

const STEPS = [
  {
    title: 'What the decoder sees',
    preset: { d: 5, errs: errs([[at(1, 1), 'X'], [at(3, 3), 'X']]), decoder: 'mwpm', show: 'syndrome' },
    html: `<p>The decoder never sees the errors, only the lit checks. Here four Z checks are lit. Many different error patterns would light exactly these four; the decoder's job is to pick a correction that, together with whatever really happened, does nothing to the logical qubit.</p>`,
  },
  {
    title: 'The errors behind it',
    preset: { d: 5, errs: errs([[at(1, 1), 'X'], [at(3, 3), 'X']]), decoder: 'mwpm', show: 'errors' },
    html: `<p>In truth, two X errors happened, each lighting a pair of checks. Fewer errors are more likely (if each qubit fails with small probability p, a pattern of w errors has probability about pʷ), so the best guess is the explanation with the <b>fewest errors</b>.</p>`,
  },
  {
    title: 'Minimum-weight matching',
    preset: { d: 5, errs: errs([[at(1, 1), 'X'], [at(3, 3), 'X']]), decoder: 'mwpm', show: 'fix' },
    html: `<p>Pair up the lit checks (or pair one with the patch's edge) so that the total length of the connecting chains is as small as possible: <b>minimum-weight perfect matching</b> (Edmonds' blossom algorithm in practice; exact search here). The dashed lines show the pairs, the amber rings the qubits to flip.</p>
      <p>Correction and error together form closed loops, so the logical qubit is safe.</p>`,
    math: `With independent errors of probability p, P(error pattern E) ∝ (p/(1 − p))^|E|, so the most likely E consistent with the syndrome is the one of least weight. Matching finds it exactly for each error type (it ignores the correlation between X and Z in a Y error). The test suite checks every matching weight against PyMatching.`,
  },
  {
    title: 'Different guess, same result',
    preset: { d: 5, errs: errs([[at(1, 2), 'X'], [at(2, 2), 'X']]), decoder: 'mwpm', show: 'fix' },
    html: `<p>The correction doesn't have to undo exactly the errors that happened. It only has to land in the same class: error + correction must be a stabilizer (a loop) rather than a logical operator (a chain across the patch).</p>`,
    predict: {
      q: 'If the decoder’s chain plus the real chain together cross the whole patch from top to bottom, what happens?',
      options: ['Nothing: the syndrome is cleared', 'A logical error: X̄ has been applied', 'The checks light up again', 'The decoder notices and retries'],
      answer: 1,
      why: 'A top-to-bottom chain of X is the logical X̄. It lights no checks, so nobody notices: that is a logical failure.',
    },
  },
  {
    title: 'When decoding fails',
    preset: { d: 5, errs: errs([[at(0, 2), 'X'], [at(1, 2), 'X'], [at(2, 2), 'X']]), decoder: 'mwpm', show: 'fix' },
    html: `<p>Three errors on a distance-5 patch, in a column from the top edge. The lit check is closer to the bottom edge than the top (two steps against three), so the most likely explanation is the shorter chain downward. Together with the real errors that completes a chain across the whole patch: a <b>logical error</b>.</p>
      <p>Distance 5 guarantees correction of any 2 errors; 3 can already fail if they line up.</p>`,
  },
  {
    title: 'Union-find: grow clusters',
    preset: { d: 5, errs: errs([[at(1, 1), 'X'], [at(1, 2), 'X'], [at(3, 3), 'Z']]), decoder: 'uf', show: 'fix', round: 0 },
    html: `<p>A faster decoder grows a cluster around each lit check, half an edge per round, merging clusters that touch, until every cluster contains an even number of lit checks or reaches the edge. Inside each cluster it then peels off a correction.</p>
      <p>Step through the growth rounds in <b>Try it</b>. Union-find runs in almost linear time, which matters when a quantum computer produces a new syndrome every microsecond.</p>`,
  },
  {
    title: 'Real time',
    preset: { d: 7, errs: errs([[at(1, 1, 7), 'X'], [at(1, 2, 7), 'X'], [at(4, 5, 7), 'X'], [at(5, 2, 7), 'Z']]), decoder: 'uf', show: 'fix', round: -1 },
    html: `<p>Real devices must decode as fast as syndromes arrive, round after round, for hours, or a backlog builds up. Google's 2024 below-threshold experiment decoded its distance-5 patch in real time with an average latency of 63 microseconds. Matching and union-find, implemented in fast hardware, are the leading approaches; neural-network decoders are catching up.</p>`,
  },
  {
    title: 'Your turn',
    preset: { d: 5, errs: '', decoder: 'mwpm', show: 'fix' },
    html: `<p>Click qubits to place errors (X → Z → Y → none) or draw random ones, then compare the two decoders. Try to find the smallest pattern that fools each one.</p>`,
  },
];

const api = runLesson({
  slug: 'decoding',
  settings: { d: 5, errs: '', decoder: 'mwpm', show: 'fix', round: -1, p: 0.08, seed: 1 },
  controls: [
    { id: 'decoder', label: 'Decoder', type: 'choice', options: [['mwpm', 'Matching'], ['uf', 'Union-find']] },
    { id: 'show', label: 'Show', type: 'choice', options: [['syndrome', 'Syndrome only'], ['errors', 'The errors'], ['fix', 'The correction']] },
    { id: 'round', label: 'Union-find growth round', type: 'range', min: -1, max: 8, step: 1, format: (v) => (v < 0 ? 'final' : String(v + 1)), show: (s) => s.decoder === 'uf' && s.show === 'fix' },
    { id: 'd', label: 'Distance', type: 'choice', options: [[3, '3'], [5, '5'], [7, '7']] },
    { id: 'p', label: 'Error rate for random errors', type: 'range', min: 0.01, max: 0.2, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
    {
      type: 'button',
      label: 'Random errors',
      primary: true,
      onClick: (a) => {
        const seed = a.settings.seed + 1;
        const rng = seededRandom(seed * 7919);
        const n = a.settings.d * a.settings.d;
        const ex = new Uint8Array(n);
        const ez = new Uint8Array(n);
        for (let q = 0; q < n; q++) {
          if (rng() < a.settings.p) ex[q] = 1;
          if (rng() < a.settings.p) ez[q] = 1;
        }
        a.set({ seed, errs: encodeErrors(ex, ez), show: 'fix' });
      },
    },
    { type: 'button', label: 'Clear', onClick: (a) => a.set({ errs: '' }) },
  ],
  cards: [
    { id: 'lattice', title: 'Errors, syndrome and correction', legend: 'amber faces = lit checks · amber rings = correction · dashed = matched pairs', height: 440 },
    { id: 'result', title: 'Did it work?', kind: 'html' },
  ],
  steps: STEPS,
  compute,
  draw,
});

api.canvas('lattice').style.cursor = 'pointer';
api.canvas('lattice').addEventListener('click', (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const q = hit(e.clientX - rect.left, e.clientY - rect.top);
  if (q < 0) return;
  const m = api.model;
  const cur = m.errX[q] && m.errZ[q] ? 'Y' : m.errX[q] ? 'X' : m.errZ[q] ? 'Z' : '';
  const next = { '': 'X', X: 'Z', Z: 'Y', Y: '' }[cur];
  const errX = Uint8Array.from(m.errX);
  const errZ = Uint8Array.from(m.errZ);
  errX[q] = next === 'X' || next === 'Y' ? 1 : 0;
  errZ[q] = next === 'Z' || next === 'Y' ? 1 : 0;
  api.set({ errs: encodeErrors(errX, errZ), show: api.settings.show === 'syndrome' ? 'errors' : api.settings.show });
});
