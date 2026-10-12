import { percent } from '../lib/format.js';
import { classicalWalk, noisyWalk, quantumWalk, spread } from '../lib/walk.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, xAxis, yAxis } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';
import { drawCarpet } from '../ui/wave-plot.js';

// A walker on a line steered by a coin. Classical: a random coin. Quantum: a Hadamard "coin" in
// superposition, so paths interfere. lib/walk.js evolves the walk exactly (density matrix when the
// coin is noisy); tests check <x²>/t² → 1 − 1/√2 and the classical limit.

function compute(s) {
  const q = noisyWalk(s.steps, s.coin, s.noise);
  const c = classicalWalk(s.steps);
  const clean = s.noise > 0 ? quantumWalk(s.steps, s.coin) : q;
  const sd = (frames) => frames.map((p) => spread(p, s.steps).sd);
  return { q, c, sdQ: sd(q), sdClean: sd(clean), sdC: sd(c) };
}

const frameAt = (api) => Math.min(api.settings.steps, Math.floor(api.t + 1e-9));

function drawDist(api) {
  const { ctx, w, h } = prep(api.canvas('dist'));
  const th = api.theme;
  const T = api.settings.steps;
  const t = frameAt(api);
  const p = api.model.q[t];
  const c = api.model.c[t];
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 30 };
  let top = 0.05;
  for (let i = 0; i < p.length; i++) top = Math.max(top, p[i], c[i]);
  const Y = yAxis(ctx, box, [0, top * 1.1], th);
  const X = xAxis(ctx, box, [-T, T], th, { integer: true });
  const bw = Math.max(1, (X(1) - X(0)) * 0.9);
  for (let i = 0; i < p.length; i++) {
    if (p[i] < 1e-6) continue;
    ctx.fillStyle = th.accent2;
    ctx.fillRect(X(i - T) - bw / 2, Y(p[i]), bw, box.y1 - Y(p[i]));
  }
  // classical walk on the same sites (it occupies the same parity as the quantum one)
  ctx.strokeStyle = th.marked;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i < c.length; i++) {
    if ((i - T - t) % 2 !== 0) continue;
    const [x, y] = [X(i - T), Y(c[i])];
    if (pen) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
    pen = true;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`after ${t} step${t === 1 ? '' : 's'}`, box.x0 + 6, box.y0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('position x', (box.x0 + box.x1) / 2, h);
}

function drawSpread(api) {
  const { ctx, w, h } = prep(api.canvas('spread'));
  const th = api.theme;
  const T = api.settings.steps;
  const t = frameAt(api);
  const { sdQ, sdClean, sdC } = api.model;
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, Math.max(...sdClean) * 1.1], th);
  const X = xAxis(ctx, box, [0, T], th);
  const line = (arr, color, dash = [], upto = arr.length - 1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (let k = 0; k <= upto; k++) (k ? ctx.lineTo : ctx.moveTo).call(ctx, X(k), Y(arr[k]));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  line(sdC, th.marked, [5, 4]);
  if (api.settings.noise > 0) line(sdClean, withAlpha(th.accent2, 0.35), [2, 3]);
  line(sdQ, th.accent2, [], t);
  ctx.strokeStyle = th.cursor;
  ctx.beginPath();
  ctx.moveTo(X(t), box.y0);
  ctx.lineTo(X(t), box.y1);
  ctx.stroke();
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = th.accent2;
  ctx.fillText(`quantum: spread ∝ t`, X(T * 0.55), Y(sdClean[Math.round(T * 0.55)]) - 6);
  ctx.fillStyle = th.marked;
  ctx.fillText('classical: spread = √t', X(T * 0.55), Y(sdC[Math.round(T * 0.55)]) - 6);
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('steps t', (box.x0 + box.x1) / 2, h);
}

function drawCarpetView(api) {
  const T = api.settings.steps;
  // Neighbouring sites alternate between empty and full each step; add each pair so the
  // space-time picture shows the walk, not that checkerboard.
  const frames = api.model.q.map((p) => Float64Array.from(p, (v, i) => v + (i + 1 < p.length ? p[i + 1] : 0)));
  const x = Float64Array.from({ length: 2 * T + 1 }, (_, i) => i - T);
  drawCarpet(api.canvas('carpet'), { theme: api.theme, frames, x, xRange: [-T, T], tMax: T, currentT: frameAt(api) });
}

function readout(api) {
  const t = frameAt(api);
  const s = api.model.sdQ[t];
  const c = api.model.sdC[t];
  const p = api.model.q[t];
  const T = api.settings.steps;
  let edge = 0;
  for (let i = 0; i < p.length; i++) if (Math.abs(i - T) >= 0.6 * t) edge += p[i];
  api.el('stats').innerHTML = `<div class="readout-grid">
    <div class="stat"><span>Spread of the quantum walker</span><b>${fmt(s, 1)}</b></div>
    <div class="stat"><span>Spread of the classical walker</span><b>${fmt(c, 1)}</b></div>
    <div class="stat"><span>Ratio</span><b>${fmt(c > 0 ? s / c : 1, 2)}×</b></div>
    <div class="stat"><span>Chance of being far out (|x| ≥ 0.6t)</span><b>${percent(edge)}</b></div></div>`;
}

const STEPS = [
  {
    title: 'A random walk',
    preset: { coin: '0', noise: 1, steps: 60 },
    play: true,
    html: `<p>A walker flips a fair coin every step: heads, one step left; tails, one step right. After t steps it is usually near the start, spread over about √t sites: the bell-shaped binomial distribution (dashed amber line).</p>
      <p>Here the quantum walker's coin is "measured" every step, which makes it exactly this classical walk.</p>`,
  },
  {
    title: 'A quantum coin',
    preset: { coin: '0', noise: 0, steps: 60 },
    play: true,
    html: `<p>Now the coin is a qubit, "tossed" with a Hadamard gate, and the walker moves left and right <b>in superposition</b>. Paths that end at the same place interfere.</p>
      <p>The result looks nothing like a bell curve: two sharp peaks racing outward and a dip in the middle where paths cancel.</p>`,
    predict: {
      q: 'After 400 steps, roughly how far does the quantum walker spread compared with the classical one?',
      options: ['About the same', 'About twice as far', 'About ten times as far', 'Less far'],
      answer: 2,
      why: 'The quantum spread grows like t: about 0.46t = 182 sites from this start (0.54t for a symmetric coin), against √400 = 20 for the classical walk. The gap itself grows like √t.',
    },
  },
  {
    title: 'Spreading like t, not √t',
    preset: { coin: '0', noise: 0, steps: 100 },
    play: true,
    focus: ['Spread over time', 'Where the walker is'],
    html: ({ model, settings }) => `<p>The quantum walker's spread grows <b>linearly</b> in time (ballistically), while the classical one grows as √t. After ${settings.steps} steps: ${fmt(model.sdQ[settings.steps], 1)} sites against ${fmt(model.sdC[settings.steps], 1)}.</p>
      <p>This quadratic speedup in spreading is behind quantum-walk search algorithms.</p>`,
    math: `For the Hadamard walk, ⟨x²⟩/t² → 1 − 1/√2 ≈ 0.293 for large t (Konno's limit theorem), whatever the starting coin. With the symmetric coin the mean stays 0, so σ ≈ 0.54t; started in |0⟩ the walk also drifts (⟨x⟩ ≈ −0.29t), leaving σ ≈ 0.46t. A classical walk has ⟨x²⟩ = t exactly.`,
  },
  {
    title: 'A lopsided walk',
    preset: { coin: '0', noise: 0, steps: 80 },
    focus: ['Where the walker is', 'Space and time'],
    html: `<p>Started with the coin in |0⟩, the walk drifts left: the Hadamard treats |0⟩ and |1⟩ differently (one picks up a minus sign). The space-time picture shows the interference fringes inside the light cone.</p>`,
  },
  {
    title: 'A symmetric walk',
    preset: { coin: 'sym', noise: 0, steps: 80 },
    focus: ['Where the walker is', 'Space and time'],
    html: `<p>Start the coin in (|0⟩ + i|1⟩)/√2 and the two directions never interfere with each other, so the walk is perfectly symmetric.</p>`,
  },
  {
    title: 'Noise makes it classical',
    preset: { coin: 'sym', noise: 0.1, steps: 80 },
    focus: ['Where the walker is', 'Spread over time'],
    html: ({ settings }) => `<p>Now the coin is dephased with probability ${fmt(settings.noise)} each step (an environment peeking at it). The walk is computed exactly as a density matrix.</p>
      <p>Even a little noise destroys the interference over time: the peaks melt into a bell curve and the spread turns back towards √t. Slide the noise from 0 to 1.</p>`,
  },
  {
    title: 'Why it matters',
    preset: { coin: 'sym', noise: 0, steps: 100 },
    html: `<p>Quantum walks are a toolkit for algorithms: search on graphs, element distinctness, and an exponential speedup for crossing certain graphs ("glued trees", Childs et al. 2003). Grover's search can be seen as one.</p>
      <p>They have been built with photons in waveguides, trapped ions and superconducting qubits.</p>`,
  },
  {
    title: 'Your turn',
    preset: { coin: 'sym', noise: 0.02, steps: 100 },
    html: `<p>Change the number of steps, the starting coin and the noise, and replay.</p>`,
  },
];

runLesson({
  slug: 'quantum-walk',
  settings: { coin: '0', noise: 1, steps: 60 },
  controls: [
    { id: 'coin', label: 'Starting coin', type: 'choice', options: [['0', '|0⟩'], ['sym', '(|0⟩ + i|1⟩)/√2']] },
    { id: 'noise', label: 'Coin noise per step', type: 'range', min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2), hint: '1 = the coin is measured every step: a classical walk.' },
    { id: 'steps', label: 'Steps', type: 'range', min: 10, max: 100, step: 10 },
  ],
  cards: [
    { id: 'dist', title: 'Where the walker is', legend: 'bars = quantum · dashed = classical', height: 250 },
    { id: 'stats', title: 'Numbers', kind: 'html' },
    { id: 'spread', title: 'Spread over time', legend: 'standard deviation of x', height: 220 },
    { id: 'carpet', title: 'Space and time', legend: 'position across, time downwards', height: 260 },
  ],
  steps: STEPS,
  compute,
  player: { duration: (api) => api.settings.steps, speed: 8 },
  draw(api) {
    drawDist(api);
    readout(api);
    drawSpread(api);
    drawCarpetView(api);
  },
});
