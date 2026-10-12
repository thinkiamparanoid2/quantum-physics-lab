import { chemicalPotential, fermiEnergy, levels, occupation, trapTc } from '../lib/statistics.js';
import { percent } from '../lib/format.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, xAxis, yAxis } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// N identical, non-interacting particles in a ladder of levels or a 3D harmonic trap, at
// temperature T: Fermi–Dirac, Bose–Einstein or classical (Boltzmann) statistics, with the chemical
// potential found numerically (lib/statistics.js). The tests check the Sommerfeld expansion and
// the condensate fraction of a trapped Bose gas.

const KINDS = { fermi: 'Fermions', bose: 'Bosons', classical: 'Classical' };
const curveCache = { key: '', curve: [] };

function refT(s, N) {
  if (s.system === 'trap') return s.kind === 'fermi' ? Math.cbrt(6 * N) : trapTc(N);
  return s.kind === 'bose' ? Math.max(1, N / 4) : N;
}

function compute(s) {
  const N = Math.round(10 ** s.logN);
  const Tref = refT(s, N);
  const T = Math.max(1e-3, s.relT * Tref);
  const count = Math.min(8000, Math.ceil(2.2 * Math.max(Tref, s.system === 'trap' ? Math.cbrt(6 * N) : N) + 18 * T + 60));
  const lv = levels(s.system, count);
  const mu = chemicalPotential(s.kind, lv, N, T);
  const perLevel = lv.map(({ E, g }) => g * occupation(s.kind, (E - mu) / T));
  // mu and (for bosons) N0/N as functions of T; they don't depend on the temperature slider, so
  // they are kept until the particles, levels or N change
  const key = `${s.kind}|${s.system}|${N}`;
  if (curveCache.key !== key) {
    const big = levels(s.system, Math.min(8000, Math.ceil(2.2 * Math.max(Tref, s.system === 'trap' ? Math.cbrt(6 * N) : N) + 36 * Tref + 60)));
    const temps = Array.from({ length: 32 }, (_, i) => ((i + 1) / 32) * 2 * Tref);
    curveCache.key = key;
    curveCache.curve = temps.map((Tk) => {
      const m = chemicalPotential(s.kind, big, N, Tk);
      return { T: Tk, mu: m, n0: occupation(s.kind, (big[0].E - m) / Tk) * big[0].g };
    });
  }
  const curve = curveCache.curve;
  let energy = 0;
  perLevel.forEach((n, i) => (energy += n * lv[i].E));
  return { N, Tref, T, lv, mu, perLevel, curve, energy: energy / N, EF: fermiEnergy(lv, N) };
}

function drawLevels(api) {
  const { ctx, w, h } = prep(api.canvas('occ'));
  const th = api.theme;
  const m = api.model;
  const s = api.settings;
  const box = { x0: 60, y0: 14, x1: w - 14, y1: h - 30 };
  // show levels up to a few k_B T above the Fermi level / temperature
  const Emax = Math.max(12, Math.min(m.lv.length - 1, (s.kind === 'fermi' ? m.EF : 0) + 6 * m.T + 6));
  const shown = m.lv.filter((l) => l.E <= Emax);
  // occupation per single-particle state f(E), for each statistics at the same N and T
  const f = (kind) => {
    const mu = kind === s.kind ? m.mu : chemicalPotential(kind, m.lv, m.N, m.T);
    return shown.map(({ E }) => occupation(kind, (E - mu) / m.T));
  };
  const mine = f(s.kind);
  const top = s.kind === 'fermi' ? 1.05 : Math.max(1.05, Math.min(5, mine[0] * 1.1));
  const Y = yAxis(ctx, box, [0, top], th);
  const X = xAxis(ctx, box, [0, Emax], th);
  const bw = Math.max(1.5, (X(1) - X(0)) * 0.7);
  shown.forEach(({ E }, i) => {
    const v = Math.min(top, mine[i]);
    ctx.fillStyle = s.kind === 'bose' ? th.marked : s.kind === 'fermi' ? th.accent2 : th.exact;
    ctx.fillRect(X(E) - bw / 2, Y(v), bw, box.y1 - Y(v));
  });
  for (const kind of Object.keys(KINDS)) {
    if (kind === s.kind) continue;
    const other = f(kind);
    ctx.strokeStyle = withAlpha(kind === 'bose' ? th.marked : kind === 'fermi' ? th.accent2 : th.exact, 0.8);
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    shown.forEach(({ E }, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(E), Y(Math.min(top, other[i]))));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (m.mu > 0 && m.mu < Emax) {
    ctx.strokeStyle = th.cursor;
    ctx.beginPath();
    ctx.moveTo(X(m.mu), box.y0);
    ctx.lineTo(X(m.mu), box.y1);
    ctx.stroke();
    ctx.font = FONT;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('μ', X(m.mu) + 4, box.y0);
  }
  if (s.kind === 'bose' && mine[0] > top) {
    ctx.font = MONO;
    ctx.fillStyle = th.marked;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`ground state: ${Math.round(mine[0] * m.lv[0].g).toLocaleString()} particles (off the scale)`, X(0) + 10, box.y0);
  }
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('energy of the state (ħω = 1)', (box.x0 + box.x1) / 2, h);
}

function drawCurve(api) {
  const { ctx, w, h } = prep(api.canvas('curve'));
  const th = api.theme;
  const m = api.model;
  const s = api.settings;
  const box = { x0: 60, y0: 14, x1: w - 14, y1: h - 30 };
  const X = xAxis(ctx, box, [0, 2], th);
  if (s.kind === 'bose' && s.system === 'trap') {
    const Y = yAxis(ctx, box, [0, 1], th);
    ctx.strokeStyle = th.muted;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const r = i / 100;
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(r), Y(Math.max(0, 1 - r ** 3)));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = th.marked;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    m.curve.forEach((c, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(c.T / m.Tref), Y(c.n0 / m.N)));
    ctx.stroke();
    ctx.font = FONT;
    ctx.fillStyle = th.marked;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('fraction in the ground state, N₀/N', box.x1, box.y0);
    ctx.fillStyle = th.muted;
    ctx.fillText('dashed: 1 − (T/T_c)³, the large-N limit', box.x1, box.y0 + 16);
  } else {
    const mus = m.curve.map((c) => c.mu / m.Tref);
    const lo = Math.min(...mus, -1);
    const hi = Math.max(...mus, 1.1);
    const Y = yAxis(ctx, box, [lo, hi], th);
    ctx.strokeStyle = s.kind === 'fermi' ? th.accent2 : th.exact;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    m.curve.forEach((c, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(c.T / m.Tref), Y(c.mu / m.Tref)));
    ctx.stroke();
    ctx.font = FONT;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`chemical potential μ / ${s.kind === 'fermi' ? 'E_F' : 'T_ref'}`, box.x1, box.y0);
  }
  ctx.strokeStyle = th.cursor;
  ctx.beginPath();
  ctx.moveTo(X(s.relT), box.y0);
  ctx.lineTo(X(s.relT), box.y1);
  ctx.stroke();
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`temperature T / ${s.kind === 'fermi' ? 'T_F' : s.system === 'trap' ? 'T_c' : 'T_ref'}`, (box.x0 + box.x1) / 2, h);
}

function readout(api) {
  const m = api.model;
  const s = api.settings;
  const stat = (label, value) => `<div class="stat"><span>${label}</span><b>${value}</b></div>`;
  const n0 = m.perLevel[0];
  api.el('nums').innerHTML = `<div class="readout-grid">
    ${stat('Particles N', m.N.toLocaleString())}
    ${stat('Temperature k_BT', fmt(m.T, 2))}
    ${stat('Chemical potential μ', fmt(m.mu, 2))}
    ${s.kind === 'fermi' ? stat('Fermi energy (T = 0)', fmt(m.EF, 1)) : stat('In the ground state', `${Math.round(n0).toLocaleString()} (${percent(n0 / m.N)})`)}
    ${stat('Mean energy per particle', fmt(m.energy, 2))}</div>`;
}

const STEPS = [
  {
    title: 'Classical particles',
    preset: { kind: 'classical', system: 'trap', logN: 3, relT: 1 },
    html: `<p>Put many particles in a harmonic trap at temperature T. If they could be told apart, each state would be occupied in proportion to the <b>Boltzmann factor</b> e^(−E/k_BT): higher energies, exponentially fewer particles.</p>
      <p>The bars show the average number in each single-particle state; the dashed lines show what fermions and bosons would do instead.</p>`,
  },
  {
    title: 'Fermions fill the levels',
    preset: { kind: 'fermi', system: 'trap', logN: 3, relT: 0.04 },
    html: `<p>Identical fermions can't share a state. At low temperature they fill the lowest states one by one up to the <b>Fermi energy</b>: occupation 1 below, 0 above. Even at absolute zero most of them are moving fast.</p>
      <p>This is why electrons in a metal, and neutrons in a neutron star, resist compression.</p>`,
    math: `<span class="eq">f(E) = 1 / (e^((E − μ)/k_BT) + 1)</span>
      At T = 0, μ = E_F and f is a step. Each state holds 0 or 1 particle.`,
  },
  {
    title: 'Warm fermions: only the edge moves',
    preset: { kind: 'fermi', system: 'trap', logN: 3, relT: 0.15 },
    predict: {
      q: 'The temperature is a small fraction of the Fermi temperature. Which fermions can change their state?',
      options: ['All of them', 'Only those within about k_BT of the Fermi energy', 'Only the lowest ones', 'None'],
      answer: 1,
      why: 'Deeper fermions have no empty state nearby to move into; only a band of width ~k_BT around E_F is smeared.',
    },
    html: `<p>Warm them up and only a band about k_BT wide around the Fermi energy blurs. Deep fermions have nowhere to go, because the nearby states are full. That is why the electrons in a metal add so little to its heat capacity.</p>`,
  },
  {
    title: 'Bosons crowd together',
    preset: { kind: 'bose', system: 'trap', logN: 3, relT: 1.3 },
    html: `<p>Bosons have no such restriction, and in fact they prefer company: the Bose–Einstein occupation 1/(e^((E−μ)/k_BT) − 1) is larger than Boltzmann's, especially for the lowest states.</p>
      <p>Above a critical temperature the gas still looks nearly classical.</p>`,
  },
  {
    title: 'Bose–Einstein condensation',
    preset: { kind: 'bose', system: 'trap', logN: 4, relT: 0.5 },
    focus: ['Against temperature', 'Numbers', 'Who is where'],
    html: ({ model }) => `<p>Below the critical temperature T_c a <b>macroscopic</b> fraction of all the bosons drops into the single lowest state: here ${percent(model.perLevel[0] / model.N)} of ${model.N.toLocaleString()} particles. That is a Bose–Einstein condensate, first made in 1995 with trapped rubidium and sodium atoms.</p>
      <p>For a 3D trap the fraction follows 1 − (T/T_c)³ (dashed), with k_BT_c = ħω (N/ζ(3))^(1/3).</p>`,
    math: `The excited states can hold at most N_ex = Σ g_n/(e^(n/k_BT) − 1) ≈ ζ(3)(k_BT/ħω)³ particles (μ → 0). When N exceeds that, the rest must sit in the ground state:
      <span class="eq">N₀/N = 1 − (T/T_c)³,  k_BT_c = ħω (N/ζ(3))^(1/3)</span>
      The tests compare the exact sums with this, including its leading finite-N correction.`,
  },
  {
    title: 'Hot enough, everyone agrees',
    preset: { kind: 'fermi', system: 'trap', logN: 2, relT: 1.9 },
    html: `<p>At high temperature, or low density, every state is sparsely occupied (f ≪ 1). Then the ±1 in the denominators doesn't matter and fermions, bosons and classical particles all follow Boltzmann: the three curves merge.</p>
      <p>Quantum statistics matters when the thermal de Broglie wavelength is comparable to the spacing between particles.</p>`,
  },
  {
    title: 'Your turn',
    preset: { kind: 'bose', system: 'trap', logN: 3.5, relT: 0.8 },
    html: `<p>Switch statistics, the number of particles and the temperature. Try bosons on the 1D ladder: there, with equally spaced levels, there is no sharp condensation transition.</p>`,
  },
];

runLesson({
  slug: 'quantum-statistics',
  settings: { kind: 'classical', system: 'trap', logN: 3, relT: 1 },
  controls: [
    { id: 'kind', label: 'Particles', type: 'choice', options: Object.entries(KINDS) },
    { id: 'system', label: 'Levels', type: 'choice', options: [['trap', '3D harmonic trap'], ['ladder', '1D ladder']] },
    { id: 'logN', label: 'Number of particles', type: 'range', min: 1, max: 4, step: 0.1, format: (v) => Math.round(10 ** v).toLocaleString() },
    { id: 'relT', label: 'Temperature', type: 'range', min: 0.02, max: 2, step: 0.01, format: (v, s) => `${v.toFixed(2)} × ${s.kind === 'fermi' ? 'T_F' : s.system === 'trap' ? 'T_c' : 'T_ref'}` },
  ],
  cards: [
    { id: 'occ', title: 'Who is where', legend: 'bars = average particles per state · dashed = the other statistics', height: 250 },
    { id: 'nums', title: 'Numbers', kind: 'html' },
    { id: 'curve', title: 'Against temperature', legend: 'bosons in a trap: the condensed fraction · otherwise: the chemical potential', height: 220 },
  ],
  steps: STEPS,
  compute,
  draw(api) {
    drawLevels(api);
    readout(api);
    drawCurve(api);
  },
});
