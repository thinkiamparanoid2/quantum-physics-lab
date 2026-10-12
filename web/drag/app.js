import { gateQuality, simulatePulse } from '../lib/pulses.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, xAxis } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// Microwave π pulses on a three-level transmon (anharmonicity −250 MHz): leakage to |2⟩, phase
// errors, and the DRAG correction, simulated in the rotating frame (lib/pulses.js). The tests check
// the two-level area theorem, time-step convergence and the DRAG improvements quoted here.

const BETAS = Array.from({ length: 41 }, (_, i) => -0.5 + i * 0.05);
const scans = new Map();

function scan(T) {
  if (scans.has(T)) return scans.get(T);
  const rows = BETAS.map((beta) => ({ beta, ...gateQuality(simulatePulse({ T, beta, steps: 400 }).U) }));
  scans.set(T, rows);
  return rows;
}

function compute(s) {
  const sim = simulatePulse({ T: s.T, beta: s.beta, steps: 800, record: 200 });
  return { sim, q: gateQuality(sim.U), scan: scan(s.T) };
}

function drawPulse(api) {
  const { ctx, w, h } = prep(api.canvas('pulse'));
  const th = api.theme;
  const s = api.settings;
  const { trace } = api.model.sim;
  const box = { x0: 56, y0: 16, x1: w - 16, y1: h - 40 };
  const X = xAxis(ctx, box, [0, s.T], th);
  const amp = Math.max(...trace.map((r) => Math.max(Math.abs(r.ox), Math.abs(r.oy)))) * 1.1;
  const Y = (v) => (box.y0 + box.y1) / 2 - (v / amp) * ((box.y1 - box.y0) / 2);
  ctx.strokeStyle = withAlpha(th.muted, 0.3);
  ctx.beginPath();
  ctx.moveTo(box.x0, Y(0));
  ctx.lineTo(box.x1, Y(0));
  ctx.stroke();
  const line = (get, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    trace.forEach((r, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(r.t), Y(get(r))));
    ctx.stroke();
  };
  line((r) => r.ox, th.accent2);
  line((r) => r.oy, th.ampNeg);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${fmt(amp / (2 * Math.PI) / 1.1 * 1000, 0)} MHz`, box.x0 - 4, Y(amp / 1.1));
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('time (ns)', (box.x0 + box.x1) / 2, box.y1 + 22);
  ctx.textAlign = 'left';
  ctx.fillStyle = th.text;
  ctx.fillText('drive envelopes Ω/2π · blue: Gaussian on X · pink: DRAG on Y (−β Ω̇ₓ/α)', box.x0 + 6, box.y0);
}

function drawPopulations(api) {
  const { ctx, w, h } = prep(api.canvas('populations'));
  const th = api.theme;
  const s = api.settings;
  const { trace } = api.model.sim;
  const box = { x0: 56, y0: 16, x1: w - 16, y1: h - 40 };
  const X = xAxis(ctx, box, [0, s.T], th);
  const Y = (p) => box.y1 - p * (box.y1 - box.y0);
  const colors = [th.accent2, th.ampNeg, th.marked];
  [0, 1, 2].forEach((lev) => {
    ctx.strokeStyle = colors[lev];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    trace.forEach((r, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(r.t), Y(lev === 2 ? Math.min(1, r.p[2] * 10) : r.p[lev])));
    ctx.stroke();
  });
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const p of [0, 0.5, 1]) ctx.fillText(String(p), box.x0 - 4, Y(p));
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('time (ns)', (box.x0 + box.x1) / 2, box.y1 + 22);
  ctx.textAlign = 'left';
  ctx.fillStyle = th.text;
  ctx.fillText('starting in |0⟩ · blue P₀ · pink P₁ · amber P₂ ×10 (leakage, magnified)', box.x0 + 6, box.y0);
}

function drawScan(api) {
  const { ctx, w, h } = prep(api.canvas('scan'));
  const th = api.theme;
  const s = api.settings;
  const rows = api.model.scan;
  const box = { x0: 60, y0: 16, x1: w - 16, y1: h - 40 };
  const X = xAxis(ctx, box, [-0.5, 1.5], th);
  const [ya, yb] = [-8, 0];
  const Y = (v) => box.y1 - ((Math.log10(Math.max(v, 1e-9)) - ya) / (yb - ya)) * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let e = ya; e <= yb; e += 2) {
    ctx.strokeStyle = withAlpha(th.muted, 0.12);
    ctx.beginPath();
    ctx.moveTo(box.x0, Y(10 ** e));
    ctx.lineTo(box.x1, Y(10 ** e));
    ctx.stroke();
    ctx.fillText(e === 0 ? '1' : `10^${e}`, box.x0 - 6, Y(10 ** e));
  }
  const line = (key, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    rows.forEach((r, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(r.beta), Y(r[key])));
    ctx.stroke();
  };
  line('error', th.accent2);
  line('leakage', th.marked);
  ctx.strokeStyle = th.text;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(X(s.beta), box.y0);
  ctx.lineTo(X(s.beta), box.y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('DRAG coefficient β', (box.x0 + box.x1) / 2, box.y1 + 22);
  ctx.textAlign = 'left';
  ctx.fillStyle = th.text;
  ctx.fillText(`${s.T} ns pulse · blue: gate error (after a free virtual Z) · amber: leakage to |2⟩`, box.x0 + 6, box.y0);
}

function readout(api) {
  const { q } = api.model;
  const best = api.model.scan.reduce((a, b) => (b.error < a.error ? b : a));
  const leastLeak = api.model.scan.reduce((a, b) => (b.leakage < a.leakage ? b : a));
  api.el('readout').innerHTML = `<div class="readout-grid">
      <div class="stat"><span>Gate error now</span><b>${q.error.toExponential(1)}</b></div>
      <div class="stat"><span>Leakage now</span><b>${q.leakage.toExponential(1)}</b></div>
      <div class="stat"><span>Best β for error</span><b>${fmt(best.beta, 2)} (${best.error.toExponential(1)})</b></div>
      <div class="stat"><span>Best β for leakage</span><b>${fmt(leastLeak.beta, 2)} (${leastLeak.leakage.toExponential(1)})</b></div></div>`;
}

const STEPS = [
  {
    title: 'A π pulse',
    preset: { T: 40, beta: 0 },
    focus: ['The pulse', 'Populations during the pulse'],
    html: `<p>To flip a transmon from |0⟩ to |1⟩, send a microwave pulse at the qubit frequency. In the rotating frame it is a slowly varying envelope; a Gaussian whose area is π flips a two-level system exactly, whatever its shape (the tests check this). A 40 ns pulse does the job almost perfectly here.</p>`,
  },
  {
    title: 'Faster pulses leak',
    preset: { T: 6, beta: 0 },
    focus: ['Populations during the pulse', 'Numbers'],
    html: `<p>Fast gates matter: qubits decohere, so every nanosecond counts. But a transmon is not a two-level system: the 1–2 transition is only 250 MHz below the 0–1 transition, and a short pulse has a spectrum broad enough to reach it. At 6 ns, 4% of the population ends up in |2⟩: <b>leakage</b>, which the qubit-level description cannot even represent.</p>`,
  },
  {
    title: 'DRAG: a derivative on the other quadrature',
    preset: { T: 8, beta: 1 },
    focus: ['The pulse', 'Gate quality against β', 'Numbers'],
    html: `<p>Motzoi, Gambetta, Rebentrost and Wilhelm (2009) found the fix: add the time derivative of the envelope on the other quadrature, Ω<sub>y</sub> = −β Ω̇<sub>x</sub>/α. It cancels the drive's effect on the 1–2 transition. With β = 1 the leakage of an 8 ns pulse drops from 2 × 10⁻³ to 6 × 10⁻⁶.</p>`,
    math: `<span class="eq">Ω_y(t) = −β Ω̇_x(t) / α</span>
      α = 2π × (−250 MHz) is the anharmonicity. The level-2 coupling is √2 stronger than the 0–1 coupling, as for a harmonic-oscillator ladder.`,
  },
  {
    title: 'Leakage is not the whole error',
    preset: { T: 8, beta: 0.5 },
    focus: ['Gate quality against β', 'Numbers'],
    html: `<p>The scan over β shows two different optima. Leakage is smallest near β = 1, but the gate error is dominated by a phase error caused by level 2 shifting level 1, and that is smallest near β = 0.5, where the error falls from 3 × 10⁻² to 9 × 10⁻⁴, thirty times better. Gambetta et al. (2011) derived both values analytically; in practice β is calibrated on the device.</p>`,
    predict: {
      q: 'Why can the remaining phase error be corrected for free?',
      options: ['It is too small to matter', 'A Z rotation can be applied in software by shifting the phase of later pulses ("virtual Z")', 'Error correction removes it', 'It cancels on its own'],
      answer: 1,
      why: 'Shifting the reference phase of all following pulses implements Z rotations with no physical gate (McKay et al. 2017).',
    },
  },
  {
    title: 'Speed against fidelity',
    preset: { T: 12, beta: 0.5 },
    focus: ['Gate quality against β', 'Numbers'],
    html: `<p>With DRAG, single-qubit gates of 20–30 ns reach errors around 10⁻⁴ in practice, where decoherence and calibration drift, not leakage, set the limit. Further refinements (optimal control, higher-order DRAG) shape pulses for multi-level systems and crosstalk.</p>`,
  },
  {
    title: 'Your turn',
    preset: { T: 6, beta: 0 },
    html: `<p>For each pulse length, find the best β. How short can a pulse be and still stay below 10⁻³ error?</p>`,
  },
];

runLesson({
  slug: 'drag',
  settings: { T: 40, beta: 0 },
  controls: [
    { id: 'T', label: 'Pulse length (ns)', type: 'choice', options: [4, 6, 8, 12, 20, 40].map((t) => [t, String(t)]) },
    { id: 'beta', label: 'DRAG coefficient β', type: 'range', min: -0.5, max: 1.5, step: 0.05, format: (v) => v.toFixed(2) },
  ],
  cards: [
    { id: 'pulse', title: 'The pulse', height: 200 },
    { id: 'populations', title: 'Populations during the pulse', height: 200 },
    { id: 'scan', title: 'Gate quality against β', height: 240 },
    { id: 'readout', title: 'Numbers', kind: 'html' },
  ],
  steps: STEPS,
  compute,
  draw(api) {
    drawPulse(api);
    drawPopulations(api);
    drawScan(api);
    readout(api);
  },
});
