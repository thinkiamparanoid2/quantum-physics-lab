import { surfaceCode } from '../lib/qec.js';
import { runLesson } from '../ui/lesson-kit.js';
import { decodeErrors, drawSurface, encodeErrors } from '../ui/surface-view.js';

// The rotated surface code: click data qubits to place X, Z or Y errors and see which checks light
// up. The code, its checks and its logical operators come from lib/qec.js (tests check that the
// checks commute and the logical operators anticommute with each other).

let hit = () => -1;
const CYCLE = { '': 'X', X: 'Z', Z: 'Y', Y: '' };

function compute(s) {
  const code = surfaceCode(s.d);
  const { errX, errZ } = decodeErrors(s.errs, code.n);
  const lit = new Set();
  code.checks.forEach((c, k) => {
    const e = c.type === 'X' ? errZ : errX; // X checks see Z errors, Z checks see X errors
    if (c.qubits.reduce((acc, q) => acc ^ e[q], 0)) lit.add(k);
  });
  const parity = (qs, e) => qs.reduce((acc, q) => acc ^ e[q], 0);
  return {
    code,
    errX,
    errZ,
    lit,
    weight: errX.reduce((a, v, q) => a + (v || errZ[q] ? 1 : 0), 0),
    flipX: parity(code.logicalZ, errX) === 1, // an X error chain crossing logical Z flips logical X
    flipZ: parity(code.logicalX, errZ) === 1,
  };
}

function draw(api) {
  const m = api.model;
  hit = drawSurface(api.canvas('lattice'), {
    theme: api.theme,
    code: m.code,
    errX: m.errX,
    errZ: m.errZ,
    lit: m.lit,
    logical: api.settings.logical === 'none' ? null : api.settings.logical,
    label: `distance ${m.code.d}: ${m.code.n} data qubits, ${m.code.checks.length} checks`,
  });
  const verdict =
    m.lit.size > 0
      ? `${m.lit.size} check${m.lit.size > 1 ? 's' : ''} lit. A decoder must now guess which error caused this pattern.`
      : m.weight === 0
        ? 'No errors.'
        : m.flipX || m.flipZ
          ? `<b>No checks lit, yet the logical qubit has been flipped</b> (${[m.flipX && 'logical X̄', m.flipZ && 'logical Z̄'].filter(Boolean).join(' and ')}): an undetectable logical error.`
          : 'No checks lit and the logical qubit is untouched: this error is itself a stabilizer, harmless.';
  api.el('status').innerHTML = `<div class="readout-grid">
      <div class="stat"><span>Qubits with an error</span><b>${m.weight}</b></div>
      <div class="stat"><span>Checks lit (the syndrome)</span><b>${m.lit.size}</b></div>
      <div class="stat"><span>Distance</span><b>${m.code.d}</b></div></div>
    <p class="hint">${verdict}</p>`;
}

const at = (i, j, d = 5) => i * d + j;
const errs = (list) => list.map(([q, t]) => `${q}${t}`).join(',');

const STEPS = [
  {
    title: 'A grid of qubits',
    preset: { d: 5, errs: '', logical: 'none' },
    html: `<p>The <b>surface code</b> lays data qubits out on a grid. Between them sit checks: pink faces measure the product of X on their corners, blue faces the product of Z. On the edges, checks with only two qubits close the pattern.</p>
      <p>A distance-5 patch has 25 data qubits and 24 checks: 25 − 24 = 1 logical qubit.</p>`,
  },
  {
    title: 'Every check is a local parity',
    preset: { d: 5, errs: '', logical: 'none' },
    html: `<p>Each check involves only its two or four neighbours, so on a chip it needs just one extra (measure) qubit wired to four data qubits. That locality is why Google, IBM and others build their processors around this code.</p>
      <p>Measuring the checks never reveals the logical state, only whether something nearby went wrong.</p>`,
    math: `For face f: X-type check ∏_{q∈f} X_q, Z-type check ∏_{q∈f} Z_q. Neighbouring X and Z faces share exactly two qubits (or none), so all checks commute and can be measured together.`,
  },
  {
    title: 'An X error lights its Z neighbours',
    preset: { d: 5, errs: errs([[at(2, 2), 'X']]), logical: 'none' },
    html: `<p>An X error on the centre qubit anticommutes with the two blue (Z) checks it touches, and they light up. The pink X checks commute with it and stay dark.</p>
      <p><b>Click any data qubit</b> to add an error; click again to change it to Z, Y or nothing.</p>`,
    predict: {
      q: 'A second X error is placed on the qubit just below the first. How many checks are lit now?',
      options: ['4', '2', '0', '3'],
      answer: 1,
      why: 'The two errors share a blue check, which sees two flips and goes dark again; only the two far ends of the chain stay lit.',
    },
  },
  {
    title: 'Chains: only the ends light up',
    preset: { d: 5, errs: errs([[at(1, 2), 'X'], [at(2, 2), 'X'], [at(3, 2), 'X']]), logical: 'none' },
    html: `<p>Three X errors in a row light only two checks: one at each <b>end</b> of the chain. Checks along the chain see two flips and cancel. The syndrome shows where chains end, not where they run, so the decoder has to infer the path.</p>`,
  },
  {
    title: 'Z and Y errors',
    preset: { d: 5, errs: errs([[at(2, 1), 'Z'], [at(2, 3), 'Y']]), logical: 'none' },
    html: `<p>A Z error lights the pink X checks around it instead. A Y error (X and Z together) lights both kinds. The two kinds of check work independently: one handles bit flips, the other phase flips.</p>`,
  },
  {
    title: 'A harmless loop',
    preset: { d: 5, errs: errs([[at(1, 1), 'X'], [at(1, 2), 'X'], [at(2, 1), 'X'], [at(2, 2), 'X']]), logical: 'none' },
    html: `<p>X on all four corners of a pink face is that face's own check operator, a stabilizer. It commutes with every check (nothing lights) and does nothing to the logical qubit. Errors that differ by a stabilizer are equivalent, so a decoder only needs to get the chain right up to such loops.</p>`,
  },
  {
    title: 'Logical operators: chains across the patch',
    preset: { d: 5, errs: errs([0, 5, 10, 15, 20].map((q) => [q, 'X'])), logical: 'X' },
    html: `<p>Now X on a whole column, from the top edge to the bottom edge. Every check sees an even number of flips, so <b>nothing lights</b>, yet this is the logical X̄: the encoded bit has flipped, undetectably.</p>
      <p>The shortest such chain has d = 5 errors. That's the <b>distance</b>: the code survives any ⌊(d−1)/2⌋ = 2 errors, because a decoder can always find the right chain for them.</p>`,
  },
  {
    title: 'Bigger patches, longer chains',
    preset: { d: 7, errs: errs([[at(2, 3, 7), 'X'], [at(3, 3, 7), 'X'], [at(4, 4, 7), 'Z']]), logical: 'none' },
    html: `<p>A distance-7 patch (49 data qubits) needs a chain of 7 errors to fail. If each qubit fails rarely, long chains are exponentially rarer, so growing the patch suppresses logical errors exponentially, as long as the physical error rate is below a threshold (two lessons on).</p>`,
  },
  {
    title: 'Your turn',
    preset: { d: 5, errs: '', logical: 'none' },
    html: `<p>Click qubits to build error patterns. Can you find an error that lights no checks but flips the logical qubit, using fewer than d errors? (You can't: that's what distance means.)</p>`,
  },
];

const api = runLesson({
  slug: 'surface-code',
  settings: { d: 5, errs: '', logical: 'none' },
  controls: [
    { id: 'd', label: 'Distance', type: 'choice', options: [[3, '3'], [5, '5'], [7, '7']] },
    { id: 'logical', label: 'Show a logical operator', type: 'choice', options: [['none', 'None'], ['X', 'X̄ (a column)'], ['Z', 'Z̄ (a row)']] },
    { type: 'button', label: 'Clear errors', onClick: (a) => a.set({ errs: '' }) },
    { type: 'note', html: 'Click a data qubit to cycle its error: X → Z → Y → none.' },
  ],
  cards: [
    { id: 'lattice', title: 'The surface code', legend: 'pink = X checks · blue = Z checks · amber = lit', height: 440 },
    { id: 'status', title: 'What the checks say', kind: 'html' },
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
  const next = CYCLE[cur];
  const errX = Uint8Array.from(m.errX);
  const errZ = Uint8Array.from(m.errZ);
  errX[q] = next === 'X' || next === 'Y' ? 1 : 0;
  errZ[q] = next === 'Z' || next === 'Y' ? 1 : 0;
  api.set({ errs: encodeErrors(errX, errZ) });
});
