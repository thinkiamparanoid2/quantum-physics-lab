import { CHANNELS, applyChannel, blochMap, blochOf, completeness, dilationOps, inputOps, kraus, mapVector, rhoOf } from '../lib/channels.js';
import { runOps } from '../lib/circuit.js';
import { reducedDensity } from '../lib/entanglement.js';
import { angleLabel, formatComplex } from '../lib/format.js';
import { BlochView, withAlpha } from '../ui/bloch.js';
import { drawCircuit } from '../ui/circuit-view.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// A single qubit's state as a point in the Bloch ball, and noise as a map that squeezes and shifts
// the ball. Kraus operators, the Bloch-ball map and the Stinespring circuit all come from
// lib/channels.js, where tests check them against each other.

const deg = (v) => `${Math.round((v * 180) / Math.PI)}°`;
let ball = null;

function compose(map, k) {
  // the affine map applied k times, as a function on vectors
  return (r) => {
    let v = r;
    for (let i = 0; i < k; i++) v = mapVector(map, v);
    return v;
  };
}

function drawImage(ctx, P, f, th) {
  // Latitude and longitude circles of the unit sphere, pushed through the map.
  const line = (pts) => {
    for (let i = 1; i < pts.length; i++) {
      const a = P(pts[i - 1]);
      const b = P(pts[i]);
      ctx.strokeStyle = withAlpha(th.marked, a.depth < 0 && b.depth < 0 ? 0.25 : 0.85);
      ctx.setLineDash(a.depth < 0 && b.depth < 0 ? [3, 4] : []);
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  };
  ctx.lineWidth = 1.4;
  for (const lat of [-60, -30, 0, 30, 60]) {
    const t = (lat * Math.PI) / 180;
    line(Array.from({ length: 65 }, (_, i) => f([Math.cos(t) * Math.cos((i / 64) * 2 * Math.PI), Math.cos(t) * Math.sin((i / 64) * 2 * Math.PI), Math.sin(t)])));
  }
  for (let lon = 0; lon < 180; lon += 30) {
    const u = (lon * Math.PI) / 180;
    line(Array.from({ length: 65 }, (_, i) => {
      const t = (i / 64) * 2 * Math.PI;
      return f([Math.sin(t) * Math.cos(u), Math.sin(t) * Math.sin(u), Math.cos(t)]);
    }));
  }
}

function matrixHtml(k) {
  const cell = (i) => formatComplex(k.re[i], k.im[i]);
  return `<table class="mini-matrix"><tr><td>${cell(0)}</td><td>${cell(1)}</td></tr><tr><td>${cell(2)}</td><td>${cell(3)}</td></tr></table>`;
}

function mapText({ M, c }) {
  const term = (i, v) => {
    const a = M[i * 4];
    const parts = [];
    if (Math.abs(a) > 1e-12) parts.push(`${Math.abs(a - 1) < 1e-12 ? '' : fmt(a, 3)}${v}`);
    if (Math.abs(c[i]) > 1e-12) parts.push(fmt(c[i], 3));
    return `${v} → ${parts.join(' + ') || '0'}`;
  };
  return ['x', 'y', 'z'].map((v, i) => term(i, v)).join(',  ');
}

function draw(api) {
  const { settings: s, theme: th } = api;
  const ks = kraus(s.channel, s.p);
  const map = blochMap(ks);
  const r0 = [Math.sin(s.theta) * Math.cos(s.phi), Math.sin(s.theta) * Math.sin(s.phi), Math.cos(s.theta)];

  // ----- the ball -----
  const box = api.el('ball');
  if (!ball) {
    box.innerHTML = '<canvas class="bloch-hero ball-canvas" role="img" aria-label="The Bloch ball and its image under the channel"></canvas><p class="hint" id="ball-note"></p>';
    ball = new BlochView(box.querySelector('canvas'), { labels: 'all' });
  }
  const trail = [r0];
  for (let k = 0; k < s.repeat; k++) trail.push(mapVector(map, trail[trail.length - 1]));
  const out = trail[trail.length - 1];
  ball.vector = out;
  ball.trail = s.repeat > 0 ? trail : [];
  ball.others = s.repeat > 0 ? [r0] : [];
  const f = compose(map, s.repeat);
  ball.overlay = s.channel === 'identity' || s.p === 0 || s.repeat === 0 ? null : (ctx, P) => drawImage(ctx, P, f, th);
  ball.draw(th);
  const len = Math.hypot(...out);
  box.querySelector('#ball-note').innerHTML = `Input arrow length 1 (a pure state). After ${s.repeat} use${s.repeat === 1 ? '' : 's'} of the channel: length <b>${fmt(len, 3)}</b>, purity tr ρ² = <b>${fmt((1 + len * len) / 2, 3)}</b>. The amber mesh is where the whole surface of the ball ends up.`;

  // ----- Kraus operators -----
  const comp = completeness(ks);
  const ok = Math.abs(comp.re[0] - 1) < 1e-12 && Math.abs(comp.re[3] - 1) < 1e-12 && Math.abs(comp.re[1]) < 1e-12;
  api.el('kraus').innerHTML = `<div class="kraus-row">${ks
    .map((k, i) => `<div><span class="label">K${'₀₁₂₃'[i]}</span>${matrixHtml(k)}</div>`)
    .join('')}</div>
    <p class="hint">Σ K†K = I ${ok ? '✓ (probabilities still add up to 1)' : '✗'} · Bloch ball: ${mapText(map)}</p>`;

  // ----- Stinespring dilation -----
  const { env, ops } = dilationOps(s.channel, s.p);
  const all = [...inputOps(s.theta, s.phi), ...ops];
  const labels = ['system', ...(env === 2 ? ['env 1', 'env 2'] : ['environment'])];
  const dil = api.el('dilation');
  if (!dil.querySelector('.circuit-scroll')) dil.innerHTML = '<div class="circuit-scroll"></div><p class="hint" id="dil-note"></p>';
  drawCircuit(dil.querySelector('.circuit-scroll'), { n: 1 + env, ops: all, applied: all.length, labels });
  const { state } = runOps(1 + env, all);
  const viaCircuit = blochOf(reducedDensity(state, [0]));
  const viaKraus = blochOf(applyChannel(ks, rhoOf(r0)));
  const v = (r) => `(${r.map((x) => fmt(x, 3)).join(', ')})`;
  dil.querySelector('#dil-note').innerHTML = `Ignore the environment and the system's Bloch vector is ${v(viaCircuit)}; the Kraus formula gives ${v(viaKraus)}. One noisy step on the qubit = one unitary step on qubit + environment.`;
}

const STEPS = [
  {
    title: 'States fill a ball',
    preset: { channel: 'identity', p: 0, repeat: 0 },
    focus: ['The Bloch ball'],
    html: `<p>A qubit's state is a density matrix ρ = (I + r·σ)/2, with a Bloch vector r. <b>Pure</b> states have |r| = 1 and sit on the surface. <b>Mixed</b> states, which describe uncertainty about which pure state we have, sit inside. The centre, r = 0, is a fair coin.</p>
      <p>Noise is anything that turns pure states into mixed ones, so it moves points inward.</p>`,
    math: `<span class="eq">ρ = ½(I + xX + yY + zZ),  tr ρ² = ½(1 + |r|²)</span>
      A pure state has tr ρ² = 1; the maximally mixed state I/2 has tr ρ² = ½.`,
  },
  {
    title: 'Depolarizing: shrink everything',
    preset: { channel: 'depolarizing', p: 0.3, repeat: 1 },
    html: `<p>The depolarizing channel replaces the state by a fair coin with probability p: ρ → (1 − p)ρ + p I/2. Every Bloch vector shrinks by the same factor, so the whole ball shrinks towards the centre (amber mesh).</p>`,
    predict: {
      q: 'The depolarizing channel is applied over and over. Where does every state end up?',
      options: ['At |0⟩', 'At the centre of the ball', 'On the equator', 'It keeps rotating'],
      answer: 1,
      why: 'Each use multiplies r by (1 − p), so r → 0: the maximally mixed state is the only fixed point.',
    },
  },
  {
    title: 'Repeat it',
    preset: { channel: 'depolarizing', p: 0.3, repeat: 5 },
    html: `<p>Five uses in a row: the arrow walks straight in towards the centre (the trail), and the image of the ball is a small sphere. Information about the original direction is being lost exponentially, as (1 − p)ᵏ.</p>`,
  },
  {
    title: 'Bit flip: squash two directions',
    preset: { channel: 'bitflip', p: 0.25, repeat: 1 },
    html: `<p>With probability p an X happens. X leaves the x axis alone and flips y and z, so the ball is squashed into a cigar along x: states along ±x are immune.</p>
      <p>That's why a code against bit flips (the repetition code) stores information in z, and why phase flips are its weak spot.</p>`,
  },
  {
    title: 'Dephasing: lose the phase',
    preset: { channel: 'dephasing', p: 0.5, repeat: 1 },
    html: `<p>Phase damping shrinks the x and y components and leaves z alone: the ball becomes a pancake standing on the z axis. Populations of |0⟩ and |1⟩ survive; superpositions lose their phase.</p>
      <p>This is <b>T₂</b> decoherence. It needs no energy exchange, only the environment learning (a little) whether the qubit is 0 or 1.</p>`,
  },
  {
    title: 'Amplitude damping: fall to |0⟩',
    preset: { channel: 'amplitude', p: 0.4, repeat: 3, theta: 2.6 },
    html: `<p>Amplitude damping is energy loss: |1⟩ decays to |0⟩ with probability γ each time. The ball shrinks <i>and slides</i> towards the north pole, so even the fair coin ends up at |0⟩.</p>
      <p>This is <b>T₁</b> relaxation. Its only fixed point is |0⟩, the ground state.</p>`,
    math: `<span class="eq">K₀ = [[1, 0], [0, √(1 − γ)]],  K₁ = [[0, √γ], [0, 0]]</span>
      <span class="eq">(x, y, z) → (√(1 − γ)x, √(1 − γ)y, γ + (1 − γ)z)</span>`,
  },
  {
    title: 'Kraus operators',
    preset: { channel: 'amplitude', p: 0.4, repeat: 1 },
    focus: ['Kraus operators', 'The Bloch ball'],
    html: `<p>Every physical noise process can be written as ρ → Σ Kᵢ ρ Kᵢ†, with operators Kᵢ that satisfy Σ Kᵢ†Kᵢ = I so probabilities still add to 1. Think of it as "one of several things happened, and we don't know which".</p>
      <p>Switch channels in <b>Try it</b> to see each set of Kraus operators and its effect on the ball.</p>`,
  },
  {
    title: 'Noise is entanglement with an environment',
    preset: { channel: 'amplitude', p: 0.4, repeat: 1 },
    focus: ['The same noise, as a circuit', 'The Bloch ball'],
    html: `<p>Every channel is a <b>unitary</b> on the qubit plus an environment, followed by ignoring the environment (Stinespring's theorem). The circuit shows how: here the qubit, if it is |1⟩, rotates an environment qubit and hands it its energy.</p>
      <p>The numbers under the circuit agree to every digit. Noise isn't magic: it's the qubit getting entangled with things we don't track.</p>`,
    predict: {
      q: 'If we could still access the environment qubit, could the noise be undone?',
      options: ['No, information is destroyed', 'Yes, in principle: the whole evolution was unitary', 'Only for depolarizing noise', 'Only by measuring the system'],
      answer: 1,
      why: 'Qubit plus environment evolved unitarily, so the information still exists, just in correlations we usually can’t reach. Error correction recovers it by other means.',
    },
  },
  {
    title: 'Your turn',
    preset: { channel: 'dephasing', p: 0.3, repeat: 2 },
    html: `<p>Choose a channel, its strength and how many times it acts, and pick the input state. Watch the trail, the image of the ball, and check the circuit against the Kraus formula for each one.</p>`,
  },
];

runLesson({
  slug: 'channels',
  settings: { channel: 'identity', p: 0, repeat: 0, theta: 1.1, phi: 0.6 },
  controls: [
    { id: 'channel', label: 'Channel', type: 'select', options: Object.entries(CHANNELS).map(([k, v]) => [k, v.label]) },
    { id: 'p', label: 'Strength p (or γ)', type: 'range', min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2) },
    { id: 'repeat', label: 'Times applied', type: 'range', min: 0, max: 12, step: 1 },
    { id: 'theta', label: 'Input tilt θ', type: 'range', min: 0, max: Math.PI, step: Math.PI / 36, format: deg },
    { id: 'phi', label: 'Input phase φ', type: 'range', min: 0, max: 2 * Math.PI, step: Math.PI / 36, format: angleLabel },
  ],
  cards: [
    { id: 'ball', title: 'The Bloch ball', legend: 'drag to turn · amber mesh = image of the whole ball', kind: 'html' },
    { id: 'kraus', title: 'Kraus operators', kind: 'html' },
    { id: 'dilation', title: 'The same noise, as a circuit', legend: 'qubit + environment, then ignore the environment', kind: 'html' },
  ],
  steps: STEPS,
  draw,
});
