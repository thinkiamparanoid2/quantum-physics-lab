import { blochFromRho, reducedQubit, repetitionFailure } from '../lib/noise.js';
import { angleLabel, percent } from '../lib/format.js';
import { BlochView, withAlpha } from '../ui/bloch.js';
import { MONO, prep, xAxis, yAxis } from '../ui/charts.js';
import { runCircuitLesson } from '../ui/circuit-lesson.js';

// The three-qubit repetition code with syndrome measurement. Qubit 0 carries the message,
// qubits 1 and 2 join it in the code, qubits 3 and 4 are the ancillas that measure the parities
// q0 xor q1 and q1 xor q2. The correction depends on both syndrome bits.
//
// code 'bit' protects against X (bit flips); code 'phase' adds Hadamards so that it protects
// against Z (phase flips) instead.

function ecOps({ theta, phi, code, error }) {
  const ops = [
    { gate: 'RY', target: 0, angle: theta },
    { gate: 'RZ', target: 0, angle: phi },
  ];
  const marks = { prepared: ops.length };
  ops.push({ gate: 'X', target: 1, controls: [0] }, { gate: 'X', target: 2, controls: [0] });
  if (code === 'phase') ops.push({ gate: 'H', target: 0 }, { gate: 'H', target: 1 }, { gate: 'H', target: 2 });
  marks.encoded = ops.length;
  if (error !== 'none') ops.push({ gate: error[0], target: Number(error[1]), label: `${error[0]}!` });
  marks.error = ops.length;
  if (code === 'phase') ops.push({ gate: 'H', target: 0 }, { gate: 'H', target: 1 }, { gate: 'H', target: 2 });
  ops.push({ gate: 'X', target: 3, controls: [0] }, { gate: 'X', target: 3, controls: [1] }, { gate: 'X', target: 4, controls: [1] }, { gate: 'X', target: 4, controls: [2] });
  marks.parities = ops.length;
  ops.push({ gate: 'MEASURE', target: 3, bit: 3 }, { gate: 'MEASURE', target: 4, bit: 4 });
  marks.measured = ops.length;
  ops.push(
    { gate: 'X', target: 0, if: [{ bit: 3, value: 1 }, { bit: 4, value: 0 }] },
    { gate: 'X', target: 1, if: [{ bit: 3, value: 1 }, { bit: 4, value: 1 }] },
    { gate: 'X', target: 2, if: [{ bit: 3, value: 0 }, { bit: 4, value: 1 }] },
  );
  marks.corrected = ops.length;
  ops.push({ gate: 'X', target: 2, controls: [0] }, { gate: 'X', target: 1, controls: [0] });
  marks.decoded = ops.length;
  return { ops, marks };
}

const ERROR_NAMES = { none: 'no error', X0: 'a bit flip on qubit 0', X1: 'a bit flip on qubit 1', X2: 'a bit flip on qubit 2', Z0: 'a phase flip on qubit 0', Z1: 'a phase flip on qubit 1', Z2: 'a phase flip on qubit 2' };

// The message Alice started with next to qubit 0 now, with their fidelity.
function survival(box) {
  box.innerHTML = `<div class="bloch-row"><canvas role="img" aria-label="The message"></canvas><canvas role="img" aria-label="Qubit 0 now"></canvas></div><p class="hint" aria-live="polite"></p>`;
  const [a, b] = box.querySelectorAll('canvas');
  const message = new BlochView(a, { title: 'The message', labels: 'poles' });
  const now = new BlochView(b, { title: 'Qubit 0 now', labels: 'poles' });
  const note = box.querySelector('p');
  return {
    draw({ params, shownState, step, theme }) {
      const th0 = step.theta ?? params.theta;
      const ph0 = step.phi ?? params.phi;
      const m = [Math.sin(th0) * Math.cos(ph0), Math.sin(th0) * Math.sin(ph0), Math.cos(th0)];
      const v = blochFromRho(reducedQubit(shownState, 0));
      message.vector = m;
      now.vector = v;
      message.draw(theme);
      now.draw(theme);
      const fidelity = (1 + m[0] * v[0] + m[1] * v[1] + m[2] * v[2]) / 2;
      note.innerHTML = step.decodedStep
        ? fidelity > 0.9999
          ? `Fidelity <b>100%</b>: the message survived.`
          : `Fidelity <b>${percent(fidelity)}</b>: this error got through.`
        : `While encoded, qubit 0 on its own is entangled with the others (a short arrow). Fidelity is only meaningful after decoding.`;
    },
  };
}

function failureChart(canvas, { theme: th }) {
  const { ctx, w, h } = prep(canvas);
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, 0.5], th);
  const X = xAxis(ctx, box, [0, 0.5], th);
  const curve = (f, color, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const p = (i / 200) * 0.5;
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p), Y(f(p)));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  curve((p) => p, withAlpha(th.muted, 0.9), [5, 4]);
  curve((p) => repetitionFailure(3, p), th.ampPos);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('unprotected: p', X(0.3) + 6, Y(0.3) - 4);
  ctx.fillStyle = th.ampPos;
  ctx.textBaseline = 'top';
  ctx.fillText('3-qubit code: 3p² − 2p³', X(0.2) + 8, Y(repetitionFailure(3, 0.2)) + 6);
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('chance p that each qubit flips', (box.x0 + box.x1) / 2, h);
}

runCircuitLesson({
  slug: 'error-correction',
  n: 5,
  labels: ['q0 (message)', 'q1', 'q2', 'ancilla a', 'ancilla b'],
  reroll: false,
  params: [
    { id: 'theta', label: 'Message tilt θ', type: 'range', min: 0, max: Math.PI, step: Math.PI / 24, value: Math.PI / 3, format: (v) => `${Math.round((v * 180) / Math.PI)}°` },
    { id: 'phi', label: 'Message phase φ', type: 'range', min: 0, max: 2 * Math.PI, step: Math.PI / 12, value: Math.PI / 2, format: angleLabel },
    {
      id: 'code',
      label: 'Code',
      type: 'select',
      value: 'bit',
      options: [
        { value: 'bit', label: 'bit-flip code' },
        { value: 'phase', label: 'phase-flip code' },
      ],
    },
    {
      id: 'error',
      label: 'Error',
      type: 'select',
      value: 'X1',
      options: Object.entries(ERROR_NAMES).map(([value, label]) => ({ value, label })),
      hint: 'Try every error with both codes. Each code fixes one kind.',
    },
  ],
  views: [
    { title: 'Did the message survive?', legend: 'compare the arrows', mount: survival },
    { title: 'When is the code worth it?', legend: 'chance the message is lost', draw: failureChart, height: 240 },
  ],
  build: (params) => {
    const { ops, marks } = ecOps(params);
    const errName = ERROR_NAMES[params.error];
    const bitZ = ecOps({ ...params, code: 'bit', error: 'Z1' });
    const phaseZ = ecOps({ ...params, code: 'phase', error: 'Z1' });
    return [
      {
        title: 'A fragile message',
        ops,
        until: marks.prepared,
        html: `<p>Qubit 0 holds a message: some state α|0⟩ + β|1⟩. Any stray flip destroys it, and we can't simply check it, because measuring it would destroy the superposition too.</p>
          <p>Classically you would keep three copies and take a majority vote. But the <b>no-cloning theorem</b> forbids copying an unknown qubit.</p>`,
      },
      {
        title: 'Spread it, don’t copy it',
        ops,
        until: marks.encoded,
        html: `<p>Two CNOTs turn α|0⟩ + β|1⟩ into <b>α|000⟩ + β|111⟩</b> (see the state). That isn't three copies of the message: it's one message spread over three qubits, all entangled.</p>
          <p>These three physical qubits now carry one <b>logical qubit</b>.</p>`,
      },
      {
        title: 'An error strikes',
        ops,
        until: marks.error,
        html: `<p>Now ${errName} happens (the gate marked with ! in the circuit; pick another in <b>Try it</b>). For a bit flip on qubit 1 the state becomes α|010⟩ + β|101⟩.</p>
          <p>We need to find out which qubit flipped without learning anything about α and β.</p>`,
      },
      {
        title: 'Ask about parities only',
        ops,
        until: marks.parities,
        html: `<p>Two helper qubits (ancillas) record the <b>parities</b>: does q0 agree with q1? does q1 agree with q2? Both branches of the superposition give the same answers, so the ancillas learn where the error is, and nothing about the message.</p>`,
      },
      {
        title: 'Measure the syndrome',
        ops,
        until: marks.measured,
        html: ({ bits }) => `<p>Measuring the ancillas gives the <b>syndrome</b>: m3 = ${bits[3]}, m4 = ${bits[4]}. The pattern points at the culprit: 10 means qubit 0, 11 qubit 1, 01 qubit 2, 00 no bit flip.</p>
          <p>The measurement is certain (the same outcome every time), and the message is still in superposition.</p>`,
      },
      {
        title: 'Fix it',
        ops,
        until: marks.corrected,
        html: `<p>Flip back the qubit the syndrome points at. Each correction in the circuit fires only for its own syndrome pattern (the "if" labels).</p>`,
      },
      {
        title: 'Decode',
        ops,
        until: marks.decoded,
        decodedStep: true,
        html: `<p>Undo the encoding. Qubit 0 holds the original message again, exactly: compare the two arrows. Any single bit flip is repaired, while the code never looked at α or β.</p>`,
      },
      {
        title: 'The weak spot: phase flips',
        ops: bitZ.ops,
        until: bitZ.marks.decoded,
        decodedStep: true,
        html: `<p>Qubits can also suffer a <b>phase flip</b> (Z): |1⟩ → −|1⟩. Here one hits qubit 1. The parities don't change, so the syndrome says "all fine", and the message comes out with the wrong phase. The bit-flip code is blind to it.</p>`,
      },
      {
        title: 'The phase-flip code',
        ops: phaseZ.ops,
        until: phaseZ.marks.decoded,
        decodedStep: true,
        html: `<p>Hadamard gates swap the roles of X and Z. Encode, apply H to all three qubits, and a phase flip turns into a bit flip that the same parity check can catch. Now the Z error is fixed, but bit flips get through instead.</p>
          <p>A real code has to catch both at once: that's <a href="../shor-code/">Shor's nine-qubit code</a>.</p>`,
      },
      {
        title: 'When is it worth it?',
        ops,
        until: marks.decoded,
        decodedStep: true,
        html: `<p>The code fails only if two or more of the three qubits flip: probability 3p² − 2p³ instead of p. That's better as long as p &lt; 1/2, and much better for small p: at p = 1%, the chance of losing the message drops to 0.03%.</p>
          <p>Your turn: try every error with both codes in <b>Try it</b>.</p>`,
      },
    ];
  },
});
