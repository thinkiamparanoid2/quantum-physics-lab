import { evolveExact } from '../lib/dynamics.js';
import { zExpectations } from '../lib/manybody.js';
import { observables, schwingerModel } from '../lib/schwinger.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, xAxis } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// The lattice Schwinger model: pair creation after a quench from the bare vacuum, the experiment of
// Martinez et al. (Nature 2016) on trapped ions. Exact statevector evolution (lib/dynamics.js) of
// lib/schwinger.js; the tests check the Hamiltonian against an independent bit-string build and the
// playground's real-time curve against Qiskit.

const FRAMES = 120;
const runs = new Map();

function simulate(s) {
  const key = `${s.N}|${s.mass}|${s.g}|${s.eps}|${s.T}`;
  if (runs.has(key)) return runs.get(key);
  const model = schwingerModel(s.N, { x: 1, mass: s.mass, g: s.g, background: s.eps });
  const dim = 1 << s.N;
  const re = new Float64Array(dim);
  const im = new Float64Array(dim);
  re[model.vacuum] = 1;
  const frames = [];
  for (let f = 0; f <= FRAMES; f++) {
    if (f) evolveExact(model.op, re, im, s.T / FRAMES);
    const o = observables(model, zExpectations(s.N, re, im));
    frames.push({ ...o, echo: re[model.vacuum] ** 2 + im[model.vacuum] ** 2 });
  }
  const run = { model, frames };
  runs.set(key, run);
  return run;
}

const compute = (s) => simulate(s);
const frameAt = (api) => api.model.frames[Math.min(FRAMES, Math.round((api.t / api.settings.T) * FRAMES))];

function drawLattice(api) {
  const { ctx, w, h } = prep(api.canvas('lattice'));
  const th = api.theme;
  const s = api.settings;
  const f = frameAt(api);
  const N = s.N;
  const x0 = 50;
  const x1 = w - 50;
  const X = (n) => x0 + (n / (N - 1)) * (x1 - x0);
  const yS = h * 0.62;
  const yF = h * 0.3;
  const fmax = Math.max(1.2, Math.abs(s.eps) + 1);
  // links: electric field as bars above the chain
  for (let n = 0; n + 1 < N; n++) {
    const L = f.field[n];
    const xm = (X(n) + X(n + 1)) / 2;
    const hgt = (L / fmax) * (h * 0.22);
    ctx.fillStyle = withAlpha(L >= 0 ? th.marked : th.accent, 0.8);
    ctx.fillRect(xm - 10, yF - Math.max(0, hgt), 20, Math.abs(hgt));
    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(fmt(L, 2), xm, yF + 6);
  }
  ctx.strokeStyle = withAlpha(th.muted, 0.4);
  ctx.beginPath();
  ctx.moveTo(x0, yF);
  ctx.lineTo(x1, yF);
  ctx.stroke();
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = th.muted;
  ctx.fillText('electric field ⟨L⟩ on each link', 8, yF - h * 0.22 - 4);
  // sites: particle density as filled discs (particles on even sites, antiparticles on odd)
  ctx.strokeStyle = withAlpha(th.muted, 0.5);
  ctx.beginPath();
  ctx.moveTo(X(0), yS);
  ctx.lineTo(X(N - 1), yS);
  ctx.stroke();
  for (let n = 0; n < N; n++) {
    const p = f.particles[n];
    const col = n % 2 ? th.accent2 : th.ampNeg;
    ctx.beginPath();
    ctx.arc(X(n), yS, 18, 0, 2 * Math.PI);
    ctx.fillStyle = th.surfaceSolid;
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(X(n), yS, 18 * Math.sqrt(Math.min(1, p)), 0, 2 * Math.PI);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.font = MONO;
    ctx.fillStyle = th.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(n % 2 ? 'e⁺' : 'e⁻', X(n), yS + 24);
    ctx.fillStyle = th.muted;
    ctx.fillText(fmt(p, 2), X(n), yS + 38);
  }
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = th.muted;
  ctx.fillText(`t = ${fmt(api.t, 2)} · particles ${fmt(f.total, 3)} · vacuum persistence ${fmt(f.echo, 3)}`, 8, h - 18);
}

function drawCurves(api) {
  const { ctx, w, h } = prep(api.canvas('curves'));
  const th = api.theme;
  const s = api.settings;
  const { frames } = api.model;
  const box = { x0: 50, y0: 18, x1: w - 16, y1: h - 34 };
  const X = xAxis(ctx, box, [0, s.T], th);
  const ymax = Math.max(1, ...frames.map((f) => f.total)) * 1.08;
  const Y = (v) => box.y1 - (v / ymax) * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = 0; v <= ymax; v += ymax > 3 ? 1 : 0.5) {
    ctx.fillText(v.toFixed(1), box.x0 - 6, Y(v));
    ctx.strokeStyle = withAlpha(th.muted, 0.12);
    ctx.beginPath();
    ctx.moveTo(box.x0, Y(v));
    ctx.lineTo(box.x1, Y(v));
    ctx.stroke();
  }
  const line = (get, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    frames.forEach((f, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X((i / FRAMES) * s.T), Y(get(f))));
    ctx.stroke();
  };
  line((f) => f.total, th.ampNeg);
  line((f) => f.echo, th.accent2);
  ctx.strokeStyle = th.text;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(X(api.t), box.y0);
  ctx.lineTo(X(api.t), box.y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  [
    ['particles (electrons + positrons)', th.ampNeg],
    ['vacuum persistence |⟨vac|ψ(t)⟩|²', th.accent2],
  ].forEach(([t, c], i) => {
    ctx.fillStyle = c;
    ctx.fillRect(box.x1 - 250, box.y0 + 6 + 18 * i, 14, 3);
    ctx.fillStyle = th.text;
    ctx.fillText(t, box.x1 - 230, box.y0 + 8 + 18 * i);
  });
}

const STEPS = [
  {
    title: 'QED on a line of qubits',
    preset: { N: 6, mass: 0.5, g: 0.6, eps: 0, T: 6 },
    focus: ['The lattice'],
    html: `<p>The Schwinger model is quantum electrodynamics in one space dimension: electrons, positrons and an electric field. It shares the deep features of the real theories (pair creation, confinement, a vacuum full of activity) and is small enough to simulate exactly.</p>
      <p>On a lattice of N sites, Kogut and Susskind's <b>staggered fermions</b> put electrons on even sites and positrons on odd sites. Each site is one qubit (via Jordan–Wigner). This is the <b>bare vacuum</b>: no particles, no field.</p>`,
    math: `<span class="eq">H = x Σ (X_n X_{n+1} + Y_n Y_{n+1})/2 − (m/2) Σ (−1)^n Z_n + g Σ L_n²</span>
      Hopping creates or moves pairs, the staggered mass costs m per particle, and g L² is the energy of the electric field on each link.`,
  },
  {
    title: 'Gauss’s law removes the photon',
    preset: { N: 6, mass: 0.5, g: 0.6, eps: 0, T: 6 },
    focus: ['The lattice'],
    html: `<p>In one dimension the electric field has no freedom of its own: Gauss's law fixes the field on each link from the charges to its left, L<sub>n</sub> = ε₀ + Σ<sub>k≤n</sub> q<sub>k</sub>. Substituting it in leaves qubits only, at the price of a long-range interaction: g L<sub>n</sub>² couples every pair of sites to the left of link n.</p>
      <p>So 6 sites need just 6 qubits, which is what made the first quantum simulation possible.</p>`,
  },
  {
    title: 'A quench: pairs from nothing',
    preset: { N: 6, mass: 0.5, g: 0.6, eps: 0, T: 6 },
    focus: ['The lattice', 'Particles and the vacuum over time'],
    play: true,
    html: `<p>The bare vacuum is not an eigenstate of the full Hamiltonian, because hopping can create a pair from it. Start there and let it evolve: electron–positron pairs appear, and each pair carries electric flux between its members.</p>
      <p>This is the experiment Martinez et al. ran in 2016 with four trapped-ion qubits, the first simulation of a gauge theory on a digital quantum computer.</p>`,
  },
  {
    title: 'Heavier particles, fewer pairs',
    preset: { N: 6, mass: 2, g: 0.6, eps: 0, T: 6 },
    focus: ['Particles and the vacuum over time'],
    play: true,
    html: `<p>With mass m = 2 each pair costs more energy than the hopping can easily lend: the particle number peaks near 1.3, against 3.2 at m = 0.5, and doubling the mass again cuts it by about another factor of three. The mass gap protects the vacuum.</p>`,
    predict: {
      q: 'Make the particles massless (m = 0). What happens to pair creation?',
      options: ['It stops', 'More pairs appear', 'Nothing changes', 'Only electrons appear'],
      answer: 1,
      why: 'Without a mass gap pairs cost only field energy: on 6 sites the particle number peaks near 3.9, against 3.2 at m = 0.5.',
    },
  },
  {
    title: 'How long does the vacuum survive?',
    preset: { N: 8, mass: 0.5, g: 0.6, eps: 0, T: 6 },
    focus: ['Particles and the vacuum over time'],
    play: true,
    html: `<p>The blue curve is the probability that the system is still in the bare vacuum, the <b>vacuum persistence</b> (a Loschmidt echo). It falls fast, and its dips mark moments when the evolving state is nearly orthogonal to where it started. Martinez et al. measured this too; sharp features in its logarithm are called dynamical quantum phase transitions.</p>`,
  },
  {
    title: 'A strong field makes pairs',
    preset: { N: 8, mass: 1.5, g: 1, eps: 2, T: 10 },
    focus: ['The lattice', 'Particles and the vacuum over time'],
    play: true,
    html: `<p>Now give the particles a larger mass (m = 1.5) and switch on a background electric field ε₀ = 2 across the chain. The vacuum can lower its field energy by producing pairs whose own flux points against the background. Compared with no field (set ε₀ to 0 in Try it), about two and a half times as many particles are present at late times, and the field on the links drops a little below 2.</p>
      <p>This is the lattice version of the <b>Schwinger effect</b>, the prediction that a strong enough electric field tears electron–positron pairs out of empty space. On 8 sites the pairs cannot get far enough apart to screen the field completely.</p>`,
  },
  {
    title: 'How we know it is right',
    preset: { N: 6, mass: 0.5, g: 0.6, eps: 0, T: 6 },
    html: `<p>The Hamiltonian is built twice, once from Pauli algebra here and once directly from bit strings in numpy, and the two agree. The real-time particle number is checked against Qiskit's exact evolution of the Python lab's model.</p>
      <p>One correction came out of this review: an earlier version of this site and of the Python lab had the signs of the mass and charge terms flipped (Martinez et al. number sites from 1, here from 0), so the "vacuum" was the most excited bare state. The tests now check that the bare vacuum is the flux-free ground state at x = 0.</p>`,
  },
  {
    title: 'Your turn',
    preset: { N: 8, mass: 0.5, g: 0.6, eps: 0, T: 10 },
    html: `<p>Change the mass, the coupling and the background field. When does the field get screened completely? What does a larger coupling g do to the oscillations?</p>`,
  },
];

runLesson({
  slug: 'schwinger',
  settings: { N: 6, mass: 0.5, g: 0.6, eps: 0, T: 6 },
  controls: [
    { id: 'N', label: 'Sites (qubits)', type: 'choice', options: [[4, '4'], [6, '6'], [8, '8'], [10, '10']] },
    { id: 'mass', label: 'Mass m', type: 'range', min: 0, max: 3, step: 0.1, format: (v) => v.toFixed(1) },
    { id: 'g', label: 'Coupling g', type: 'range', min: 0, max: 2, step: 0.05, format: (v) => v.toFixed(2) },
    { id: 'eps', label: 'Background field ε₀', type: 'range', min: 0, max: 2, step: 0.1, format: (v) => v.toFixed(1) },
    { id: 'T', label: 'Time span', type: 'choice', options: [[6, '6'], [10, '10'], [20, '20']] },
  ],
  cards: [
    { id: 'lattice', title: 'The lattice', legend: 'pink = electron sites · blue = positron sites · bars = electric field', height: 300 },
    { id: 'curves', title: 'Particles and the vacuum over time', legend: 'exact statevector evolution, hopping x = 1', height: 260 },
  ],
  steps: STEPS,
  compute,
  player: { duration: (api) => api.settings.T },
  draw(api) {
    drawLattice(api);
    drawCurves(api);
  },
});
