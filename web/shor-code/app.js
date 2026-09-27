import { angleLabel, percent } from '../lib/format.js';
import { SHOR_BLOCKS, blochFromRho, errorOp, reducedQubit, repetitionFailure } from '../lib/noise.js';
import { BlochView, withAlpha } from '../ui/bloch.js';
import { MONO, prep, xAxis, yAxis } from '../ui/charts.js';
import { runCircuitLesson } from '../ui/circuit-lesson.js';

// Shor's nine-qubit code (1995). The message on qubit 0 is protected against phase flips by a
// three-block phase code, and each block against bit flips by a three-qubit repetition code.
// Decoding uses Toffoli gates as majority votes, so the correction happens without measuring.
// lib/noise.js tests that every single-qubit error, including arbitrary rotations, is corrected.

function shorOps({ theta, phi, kind, qubit }) {
  const ops = [
    { gate: 'RY', target: 0, angle: theta },
    { gate: 'RZ', target: 0, angle: phi },
  ];
  const m = { prepared: ops.length };
  ops.push({ gate: 'X', target: 3, controls: [0] }, { gate: 'X', target: 6, controls: [0] }, { gate: 'H', target: 0 }, { gate: 'H', target: 3 }, { gate: 'H', target: 6 });
  m.outer = ops.length;
  for (const [l, a, b] of SHOR_BLOCKS) ops.push({ gate: 'X', target: a, controls: [l] }, { gate: 'X', target: b, controls: [l] });
  m.encoded = ops.length;
  const err = errorOp(kind, qubit);
  if (err) ops.push({ ...err, label: `${kind}!` });
  m.error = ops.length;
  for (const [l, a, b] of SHOR_BLOCKS) {
    ops.push({ gate: 'X', target: a, controls: [l] }, { gate: 'X', target: b, controls: [l] }, { gate: 'X', target: l, controls: [a, b] });
  }
  m.inner = ops.length;
  ops.push({ gate: 'H', target: 0 }, { gate: 'H', target: 3 }, { gate: 'H', target: 6 });
  ops.push({ gate: 'X', target: 3, controls: [0] }, { gate: 'X', target: 6, controls: [0] }, { gate: 'X', target: 0, controls: [3, 6] });
  m.decoded = ops.length;
  return { ops, m };
}

const KINDS = { none: 'no error', X: 'a bit flip (X)', Z: 'a phase flip (Z)', Y: 'both at once (Y)', R: 'a random small rotation' };

function survival(box) {
  box.innerHTML = `<div class="bloch-row"><canvas role="img" aria-label="The message"></canvas><canvas role="img" aria-label="Qubit 0 now"></canvas></div><p class="hint" aria-live="polite"></p>`;
  const [a, b] = box.querySelectorAll('canvas');
  const message = new BlochView(a, { title: 'The message', labels: 'poles' });
  const now = new BlochView(b, { title: 'Qubit 0 now', labels: 'poles' });
  const note = box.querySelector('p');
  return {
    draw({ params, shownState, step, theme }) {
      const mv = [Math.sin(params.theta) * Math.cos(params.phi), Math.sin(params.theta) * Math.sin(params.phi), Math.cos(params.theta)];
      const v = blochFromRho(reducedQubit(shownState, 0));
      message.vector = mv;
      now.vector = v;
      message.draw(theme);
      now.draw(theme);
      const fidelity = (1 + mv[0] * v[0] + mv[1] * v[1] + mv[2] * v[2]) / 2;
      note.innerHTML = step.decodedStep
        ? `Fidelity <b>${fidelity > 0.99999 ? '100%' : percent(fidelity)}</b> after ${KINDS[params.kind]}${params.kind === 'none' ? '' : ` on qubit ${params.qubit}`}.`
        : 'While encoded, qubit 0 alone tells you little: the message lives in all nine qubits together.';
    },
  };
}

function threshold(canvas, { theme: th }) {
  const { ctx, w, h } = prep(canvas);
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 30 };
  // log scale for the failure probability
  const lo = -6;
  const Y = (p) => box.y1 - ((Math.log10(Math.max(p, 1e-6)) - lo) / -lo) * (box.y1 - box.y0);
  const X = xAxis(ctx, box, [0, 0.5], th);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let e = lo; e <= 0; e++) {
    ctx.strokeStyle = withAlpha(th.muted, 0.15);
    ctx.beginPath();
    ctx.moveTo(box.x0, Math.round(Y(10 ** e)) + 0.5);
    ctx.lineTo(box.x1, Math.round(Y(10 ** e)) + 0.5);
    ctx.stroke();
    ctx.fillText(e === 0 ? '1' : `10${String(e).replace('-', '⁻').replace(/\d/, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])}`, box.x0 - 6, Y(10 ** e));
  }
  const colors = [withAlpha(th.muted, 0.9), th.ampPos, th.accent2, th.marked, th.ampNeg];
  [1, 3, 5, 7, 9].forEach((d, k) => {
    ctx.strokeStyle = colors[k];
    ctx.lineWidth = d === 1 ? 1.5 : 2.2;
    ctx.setLineDash(d === 1 ? [5, 4] : []);
    ctx.beginPath();
    for (let i = 1; i <= 300; i++) {
      const p = (i / 300) * 0.5;
      (i > 1 ? ctx.lineTo : ctx.moveTo).call(ctx, X(p), Y(repetitionFailure(d, p)));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // label each curve where it crosses 10^-4 (the uncoded line where it crosses 3%)
    const level = d === 1 ? 0.03 : 1e-4;
    let a = 0;
    let c = 0.5;
    for (let it = 0; it < 50; it++) {
      const mid = (a + c) / 2;
      if (repetitionFailure(d, mid) < level) a = mid;
      else c = mid;
    }
    ctx.fillStyle = colors[k];
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(d === 1 ? 'no code' : `${d} qubits`, X(a) + 8, Y(level));
  });
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('error chance p per qubit (bit flips only; repetition codes)', (box.x0 + box.x1) / 2, h);
}

runCircuitLesson({
  slug: 'shor-code',
  n: 9,
  labels: ['q0 (message)', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'],
  dials: false,
  reroll: false,
  params: [
    { id: 'theta', label: 'Message tilt θ', type: 'range', min: 0, max: Math.PI, step: Math.PI / 24, value: Math.PI / 3, format: (v) => `${Math.round((v * 180) / Math.PI)}°` },
    { id: 'phi', label: 'Message phase φ', type: 'range', min: 0, max: 2 * Math.PI, step: Math.PI / 12, value: Math.PI / 2, format: angleLabel },
    { id: 'kind', label: 'Error', type: 'select', value: 'Y', options: Object.entries(KINDS).map(([value, label]) => ({ value, label })) },
    { id: 'qubit', label: 'On qubit', type: 'range', min: 0, max: 8, step: 1, value: 4, format: String, hint: 'Any kind, on any one qubit: it always comes back.' },
  ],
  views: [
    { title: 'Did the message survive?', legend: 'logical qubit before and after', mount: survival },
    { title: 'Bigger codes win, below a threshold', legend: 'chance the message is lost (log scale)', draw: threshold, height: 260 },
  ],
  build: (params) => {
    const { ops, m } = shorOps(params);
    return [
      {
        title: 'Two kinds of error at once',
        ops,
        until: m.prepared,
        html: `<p>The three-qubit codes each stop one kind of error: bit flips or phase flips, never both. Peter Shor's answer (1995) was to nest them.</p>
          <p>The message starts on qubit 0, as before.</p>`,
      },
      {
        title: 'Outer layer: against phase flips',
        ops,
        until: m.outer,
        html: `<p>First encode with the phase-flip code across qubits 0, 3 and 6: each of these heads a <b>block</b>.</p>`,
      },
      {
        title: 'Inner layer: against bit flips',
        ops,
        until: m.encoded,
        html: `<p>Then protect each block head with a bit-flip code over its block (0-1-2, 3-4-5, 6-7-8). One logical qubit now lives on <b>nine</b> physical qubits:</p>
          <p>|0⟩ → (|000⟩ + |111⟩)⊗3/(2√2),  |1⟩ → (|000⟩ − |111⟩)⊗3/(2√2).</p>`,
      },
      {
        title: 'Any error strikes',
        ops,
        until: m.error,
        html: ({ params: p }) => `<p>Now ${KINDS[p.kind]}${p.kind === 'none' ? '' : ` hits qubit ${p.qubit}`}. Pick any kind and any qubit in <b>Try it</b>, including an arbitrary rotation, which is not a flip at all.</p>`,
      },
      {
        title: 'Vote inside each block',
        ops,
        until: m.inner,
        html: `<p>Decoding runs the encoding backwards, and at each layer a <b>Toffoli</b> gate takes a majority vote: in each block, if the other two qubits both disagree with the head, it gets flipped back. That repairs any bit flip.</p>
          <p>This version corrects with gates instead of measuring a syndrome; the two are equivalent.</p>`,
      },
      {
        title: 'Vote across the blocks',
        ops,
        until: m.decoded,
        decodedStep: true,
        html: ({ params: p }) => `<p>Back in the phase basis, a second vote across the three block heads repairs any phase flip. Qubit 0 holds the message again: fidelity 100% for ${KINDS[p.kind]}${p.kind === 'none' ? '' : ` on qubit ${p.qubit}`}.</p>
          <p>Try every qubit and every kind: all nine × four come back perfectly.</p>`,
      },
      {
        title: 'Errors become discrete',
        ops,
        until: m.decoded,
        decodedStep: true,
        html: `<p>Why does even a small random rotation get fixed? Any single-qubit error is a combination of "nothing", X, Y and Z. Checking the code's parities (or voting) forces it to be one of those four, and each of them is then undone.</p>
          <p>That's the surprise of quantum error correction: a continuum of possible errors, corrected by a finite set of checks.</p>`,
      },
      {
        title: 'Bigger codes, below a threshold',
        ops,
        until: m.decoded,
        decodedStep: true,
        html: `<p>Longer codes fail only if many qubits go wrong at once. When each qubit is reliable enough, <b>every extra layer makes things much better</b>; when it isn't, bigger codes make things worse. The crossing point is the <b>threshold</b> (right: 1/2 for these simple bit-flip codes, about 1% for the surface codes used today).</p>
          <p>In 2024, Google's team crossed it on real hardware: each time they enlarged their surface code (distance 3, 5, 7) the logical error rate roughly halved.</p>`,
      },
    ];
  },
});
