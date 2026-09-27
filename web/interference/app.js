import { gateMatrix, runOps } from '../lib/circuit.js';
import { angleLabel, percent } from '../lib/format.js';
import { FONT, MONO, hline, prep, yAxis } from '../ui/charts.js';
import { runCircuitLesson } from '../ui/circuit-lesson.js';
import { phaseColor } from '../ui/dials.js';

const H = { gate: 'H', target: 0 };
const HH = [H, H];
const HZH = [H, { gate: 'Z', target: 0 }, H];

function arrow(ctx, x0, y0, x1, y1, color, width) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 2) return;
  const a = Math.atan2(y1 - y0, x1 - x0);
  const head = Math.min(10, len * 0.4);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - Math.cos(a) * head * 0.7, y1 - Math.sin(a) * head * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45));
  ctx.lineTo(x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

// For the gate applied last: each output amplitude is a sum of contributions, one from each
// input amplitude. Draw them head to tail so the viewer sees them add up or cancel.
function drawPathSum(canvas, { theme: th, step }) {
  const { ctx, w, h } = prep(canvas);
  const k = step.until - 1;
  if (k < 0) {
    ctx.font = FONT;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.fillText('Apply a gate to see how it combines the amplitudes.', w / 2, h / 2);
    return;
  }
  const before = runOps(1, step.ops, k).state;
  const g = gateMatrix(step.ops[k]);
  const colors = [th.accent2, th.exact];
  const panelW = w / 2;
  const R = Math.max(20, Math.min(panelW, h - 44) / 2 - 14);

  for (let out = 0; out < 2; out++) {
    const cx = panelW * out + panelW / 2;
    const cy = 30 + R + 4;
    ctx.strokeStyle = th.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = th.axis;
    hline(ctx, cx - R - 8, cx + R + 8, cy);
    ctx.beginPath();
    ctx.moveTo(cx, cy - R - 8);
    ctx.lineTo(cx, cy + R + 8);
    ctx.stroke();

    // Each later contribution is nudged sideways a few pixels so that two arrows pointing
    // in opposite directions along the same line stay visible instead of overlapping.
    let x = 0;
    let y = 0;
    let drawn = 0;
    for (let inp = 0; inp < 2; inp++) {
      const mr = g.re[out * 2 + inp];
      const mi = g.im[out * 2 + inp];
      const cr = mr * before.re[inp] - mi * before.im[inp];
      const ci = mr * before.im[inp] + mi * before.re[inp];
      const len = Math.hypot(cr, ci);
      if (len > 1e-9) {
        const nx = (-ci / len) * 7 * drawn;
        const ny = (cr / len) * 7 * drawn;
        arrow(ctx, cx + R * x + nx, cy - R * y - ny, cx + R * (x + cr) + nx, cy - R * (y + ci) - ny, colors[inp], 3);
        drawn++;
      }
      x += cr;
      y += ci;
    }
    const mag = Math.hypot(x, y);
    if (mag > 1e-6) {
      ctx.setLineDash([5, 4]);
      arrow(ctx, cx, cy, cx + R * x, cy - R * y, phaseColor(Math.atan2(y, x)), 2);
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = th.ampNeg;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.font = `600 13px Inter, system-ui, sans-serif`;
    ctx.fillStyle = th.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`into |${out}⟩: ${mag < 1e-6 ? 'cancelled' : `P = ${percent(mag * mag)}`}`, cx, 4);
  }
  ctx.font = MONO;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.fillStyle = th.accent2;
  ctx.fillText('→ from |0⟩', 8, h - 4);
  ctx.fillStyle = th.exact;
  ctx.fillText('→ from |1⟩', 110, h - 4);
  ctx.fillStyle = th.muted;
  ctx.fillText('- - total', 212, h - 4);
}

// P(0) and P(1) after H, P(phi), H as the phase phi sweeps once around the circle.
function drawFringe(canvas, { theme: th, index, params }) {
  const { ctx, w, h } = prep(canvas);
  const box = { x0: 46, y0: 12, x1: w - 14, y1: h - 28 };
  const Y = yAxis(ctx, box, [0, 1], th);
  const X = (phi) => box.x0 + (phi / (2 * Math.PI)) * (box.x1 - box.x0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ['0', 'π/2', 'π', '3π/2', '2π'].forEach((t, i) => ctx.fillText(t, X((i * Math.PI) / 2), box.y1 + 7));

  const curve = (f, color, dash) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const phi = (i / 200) * 2 * Math.PI;
      if (i === 0) ctx.moveTo(X(phi), Y(f(phi)));
      else ctx.lineTo(X(phi), Y(f(phi)));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  curve((p) => Math.cos(p / 2) ** 2, th.ampPos, []);
  curve((p) => Math.sin(p / 2) ** 2, th.ampNeg, [6, 5]);

  const phi = index === 2 ? 0 : index === 4 ? Math.PI : index >= 5 ? params.phi : null;
  if (phi !== null) {
    ctx.strokeStyle = th.cursor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(X(phi), box.y0);
    ctx.lineTo(X(phi), box.y1);
    ctx.stroke();
    for (const [f, c] of [
      [Math.cos(phi / 2) ** 2, th.ampPos],
      [Math.sin(phi / 2) ** 2, th.ampNeg],
    ]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(X(phi), Y(f), 6, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = th.ampPos;
  ctx.fillText('P(0)', box.x1, box.y0);
  ctx.fillStyle = th.ampNeg;
  ctx.fillText('P(1) - -', box.x1, box.y0 + 16);
}

runCircuitLesson({
  slug: 'interference',
  n: 1,
  bloch: true,
  params: [
    {
      id: 'phi',
      label: 'Phase φ',
      type: 'range',
      min: 0,
      max: 2 * Math.PI,
      step: Math.PI / 32,
      value: Math.PI / 2,
      format: (v) => `${angleLabel(v)} (${Math.round((v * 180) / Math.PI)}°)`,
      hint: 'Used from step 6: the phase gate between the two Hadamards.',
    },
  ],
  views: [
    {
      title: 'How the last gate combined the amplitudes',
      legend: 'arrows placed head to tail',
      height: 250,
      draw: drawPathSum,
      caption:
        'Each outcome collects one contribution from every input amplitude. Arrows pointing the same way add up; opposite arrows cancel.',
    },
    {
      title: 'Interference fringe',
      legend: 'H, then a phase φ, then H',
      height: 220,
      draw: drawFringe,
      caption: 'Two Hadamards around a phase gate: the phase slides the outcome between |0⟩ and |1⟩, exactly like an optical interferometer.',
    },
  ],
  build: (params) => {
    const HPH = [H, { gate: 'P', target: 0, angle: params.phi }, H];
    return [
      {
        title: 'One qubit, one amplitude',
        ops: HH,
        until: 0,
        html: `<p>The qubit starts in |0⟩. In the <b>State</b> panel the |0⟩ dial is full (probability 100%) and |1⟩ is empty.</p>
          <p>Each dial is an <b>amplitude</b>: a number with a size <i>and a direction</i>. The direction is called the <b>phase</b>, and it is what makes quantum computing different.</p>`,
      },
      {
        title: 'Hadamard: split into two',
        ops: HH,
        until: 1,
        html: `<p>A Hadamard gate splits the amplitude between |0⟩ and |1⟩. Each gets size 1/√2, so each outcome has probability (1/√2)² = 50%.</p>
          <p>Both hands point the same way. So far this looks just like a fair coin.</p>`,
      },
      {
        title: 'Hadamard again: back to |0⟩',
        ops: HH,
        until: 2,
        html: `<p>A coin flipped twice is still random. This qubit is not: a second Hadamard returns it to |0⟩ <b>every time</b>.</p>
          <p>Look at <b>How the last gate combined the amplitudes</b>. |0⟩ receives two arrows pointing the same way, so they add up. |1⟩ receives two arrows pointing in <b>opposite</b> directions, so they cancel. That is interference.</p>`,
      },
      {
        title: 'Flip one arrow',
        ops: HZH,
        until: 2,
        html: `<p>Start again, but after the first Hadamard apply <b>Z</b>. It flips the phase of |1⟩: that hand now points the other way.</p>
          <p>The probabilities have not changed, still 50/50. Measuring now could not tell this state apart from the one two steps ago.</p>`,
      },
      {
        title: 'Now the other outcome wins',
        ops: HZH,
        until: 3,
        html: `<p>The same final Hadamard now sends the qubit to |1⟩ every time. The arrows that used to cancel now add up, and the ones that added now cancel.</p>
          <p>A change you could not see in any measurement completely changed the result. That is why phase matters.</p>`,
      },
      {
        title: 'Any phase in between',
        ops: HPH,
        until: 3,
        html: ({ probs }) => `<p>Replace Z with a phase gate P(φ) and drag <b>Phase φ</b> in Try it.
          The chance of measuring |0⟩ is cos²(φ/2), now <b>${percent(probs[0])}</b>.</p>
          <p>The fringe chart shows the whole pattern: the phase slides the result smoothly between the two outcomes, just as light does in an interferometer.</p>`,
      },
      {
        title: 'Why this matters',
        ops: HPH,
        until: 3,
        html: `<p>Every quantum algorithm is choreographed interference. Gates steer the phases so that paths to wrong answers cancel and paths to the right answer add up.</p>
          <p>Grover's search does it with sign flips. The quantum Fourier transform does it with phases spread evenly around the circle.</p>`,
      },
    ];
  },
});
