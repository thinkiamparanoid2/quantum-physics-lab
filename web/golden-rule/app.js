import { bandEnergies, exactDecay, firstOrder, goldenRate, lorentzian, selfEnergyShift } from '../lib/decay.js';
import { percent } from '../lib/format.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, xAxis, yAxis } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// A level |0⟩ coupled to a band of 201 evenly spaced levels: the model behind Fermi's golden rule.
// The evolution is exact (diagonalisation in lib/decay.js); first-order perturbation theory and
// the golden rule are drawn on top of it, and the tests check where each one holds.

const N = 201;

function compute(s) {
  const E = bandEnergies(N, s.delta, s.centre);
  const psiAt = exactDecay(s.V, E);
  const inBandNow = s.centre - ((N - 1) / 2) * s.delta < 0 && s.centre + ((N - 1) / 2) * s.delta > 0;
  const G0 = inBandNow ? goldenRate(s.V, s.delta) : 0;
  const tLong = Math.min(1.25 * ((2 * Math.PI) / s.delta), 900);
  // 'decay' shows about eight lifetimes; 'long' runs past the recurrence time 2π/δ
  const tmax = s.window === 'long' || G0 === 0 ? tLong : Math.min(tLong, Math.max(30, 8 / G0));
  const samples = 300;
  const times = Float64Array.from({ length: samples + 1 }, (_, i) => (i / samples) * tmax);
  const P0 = times.map((t) => {
    const st = psiAt(t);
    return st.re[0] ** 2 + st.im[0] ** 2;
  });
  return { E, psiAt, tmax, times, P0, G: G0, inBand: inBandNow };
}

function drawSurvival(api) {
  const { ctx, w, h } = prep(api.canvas('survival'));
  const th = api.theme;
  const m = api.model;
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, 1.02], th);
  const X = xAxis(ctx, box, [0, m.tmax], th);
  // golden rule
  if (m.G > 0) {
    ctx.strokeStyle = th.marked;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * m.tmax;
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(t), Y(Math.exp(-m.G * t)));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // first-order perturbation theory: 1 - sum_k P_k^(1)(t)
  ctx.strokeStyle = withAlpha(th.ampNeg, 0.9);
  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= 200; i++) {
    const t = (i / 200) * m.tmax;
    let lost = 0;
    for (const e of m.E) lost += firstOrder(api.settings.V, e, t);
    const v = 1 - lost;
    if (v < -0.05) break;
    (started ? ctx.lineTo : ctx.moveTo).call(ctx, X(t), Y(Math.max(0, v)));
    started = true;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // exact, revealed up to the current time
  ctx.strokeStyle = th.accent2;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  m.times.forEach((t, i) => t <= api.t + 1e-9 && (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(t), Y(m.P0[i])));
  ctx.stroke();
  // recurrence time
  const tr = (2 * Math.PI) / api.settings.delta;
  if (tr < m.tmax) {
    ctx.strokeStyle = withAlpha(th.muted, 0.7);
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(X(tr), box.y0);
    ctx.lineTo(X(tr), box.y1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = FONT;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('2π/δ', X(tr) - 4, box.y0 + 30);
  }
  ctx.strokeStyle = th.cursor;
  ctx.beginPath();
  ctx.moveTo(X(api.t), box.y0);
  ctx.lineTo(X(api.t), box.y1);
  ctx.stroke();
  ctx.font = FONT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = th.marked;
  ctx.fillText(m.G > 0 ? `Γ = ${fmt(m.G, 4)}` : 'Γ = 0: no states at this energy', box.x1 - 4, box.y0);
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('time', (box.x0 + box.x1) / 2, h);
}

function drawSpectrum(api) {
  const { ctx, w, h } = prep(api.canvas('spectrum'));
  const th = api.theme;
  const m = api.model;
  const t = Math.max(api.t, 1e-6);
  const st = m.psiAt(t);
  const P = Array.from(m.E, (_, k) => st.re[k + 1] ** 2 + st.im[k + 1] ** 2);
  // a window around energy 0 that shrinks as the peak narrows (about ten peak widths)
  const halfBand = ((N - 1) / 2) * api.settings.delta;
  const span = Math.max(0.15, Math.min(halfBand + Math.abs(api.settings.centre), 60 / Math.max(t, 1)));
  const xr = [-span, span];
  const box = { x0: 60, y0: 14, x1: w - 14, y1: h - 30 };
  let top = 1e-6;
  P.forEach((v, k) => m.E[k] >= xr[0] && m.E[k] <= xr[1] && (top = Math.max(top, v)));
  const Y = yAxis(ctx, box, [0, top * 1.15], th);
  const X = xAxis(ctx, box, xr, th);
  const bw = Math.max(1.5, (X(api.settings.delta) - X(0)) * 0.7);
  m.E.forEach((e, k) => {
    if (e < xr[0] || e > xr[1]) return;
    ctx.fillStyle = th.accent2;
    ctx.fillRect(X(e) - bw / 2, Y(P[k]), bw, box.y1 - Y(P[k]));
  });
  // Early on, first-order perturbation theory; once the level has decayed, the Lorentzian line
  // shape of width Γ (with the band's small self-energy shift). In between, neither applies.
  const { V, delta } = api.settings;
  const Gt = m.G * t;
  const W = (N / 2) * delta;
  const curve = Gt < 1 ? (e) => firstOrder(V, e, t) : Gt > 3 ? (e) => lorentzian(V, e - selfEnergyShift(V, 1 / delta, W, e), m.G) : null;
  if (curve) {
    ctx.strokeStyle = Gt < 1 ? th.ampNeg : th.marked;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i <= 300; i++) {
      const e = xr[0] + (i / 300) * (xr[1] - xr[0]);
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(e), Y(Math.min(top * 1.15, curve(e))));
    }
    ctx.stroke();
  }
  ctx.font = FONT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = Gt < 1 ? th.ampNeg : th.marked;
  if (curve) ctx.fillText(Gt < 1 ? 'line: first order' : `line: Lorentzian of width Γ = ${fmt(m.G, 3)}`, box.x1 - 4, box.y0);
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`t = ${fmt(t, 1)}: peak width ≈ 2π/t = ${fmt((2 * Math.PI) / t, 3)}`, box.x0 + 6, box.y0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('energy of the final level, relative to the initial one', (box.x0 + box.x1) / 2, h);
}

const STEPS = [
  {
    title: 'One level, many neighbours',
    preset: { V: 0.02, delta: 0.01, centre: 0 },
    play: true,
    html: `<p>An excited atom can drop to its ground state by emitting a photon into any of a huge number of modes. Here is the simplest model of that: one level (energy 0) weakly coupled, with strength V, to a band of 201 closely spaced levels.</p>
      <p>Press <b>Play</b>: the chance of still being in the first level (blue) leaks away.</p>`,
  },
  {
    title: 'At first, quadratic',
    preset: { V: 0.02, delta: 0.01, centre: 0 },
    focus: ['Is it still there?'],
    html: `<p>Very early on, first-order perturbation theory (pink dots) describes the loss perfectly. Each final level k gains P_k(t) = 4V² sin²(E_k t/2)/E_k², which starts out growing like <b>t²</b>, not linearly.</p>
      <p>Zoom in with the time slider near t = 0.</p>`,
    math: `To first order in V, starting from |0⟩:
      <span class="eq">c_k(t) = −i ∫₀ᵗ V e^(iE_k t′) dt′,  P_k(t) = 4V² sin²(E_k t/2)/E_k²</span>
      For t ≪ 1/(band width) every sin can be expanded: P_k ≈ V²t².`,
  },
  {
    title: 'Energy conservation emerges',
    preset: { V: 0.02, delta: 0.01, centre: 0 },
    focus: ['Which levels it went to'],
    play: true,
    html: `<p>Which levels receive the probability? At short times many, even ones far from energy 0. As time goes on the distribution narrows into a peak of width ≈ 2π/t around the starting energy: transitions that don't conserve energy die out.</p>
      <p>This sin²(Et/2)/E² shape is the time–energy uncertainty in action.</p>`,
  },
  {
    title: 'Fermi’s golden rule',
    preset: { V: 0.02, delta: 0.01, centre: 0 },
    focus: ['Is it still there?', 'Which levels it went to'],
    html: ({ model }) => `<p>The peak narrows like 1/t while its height grows like t², so the total probability that has left grows <b>linearly</b>: a constant rate. That rate is Fermi's golden rule, Γ = 2π|V|²ρ, where ρ = 1/δ is the number of final states per unit energy. Here Γ = ${fmt(model.G, 4)}.</p>
      <p>A constant rate means exponential decay, e^(−Γt) (amber dashes), and the exact curve follows it.</p>`,
    math: `Summing the first-order P_k over a dense band with density ρ:
      <span class="eq">Σ_k 4V² sin²(E_k t/2)/E_k² → ρ ∫ 4V² sin²(Et/2)/E² dE = 2π V² ρ t</span>
      valid once t ≫ 1/(band width) and while Γt is small; the exact solution then continues it as e^(−Γt).`,
    predict: {
      q: 'You double the coupling V. How does the decay rate change?',
      options: ['It doubles', 'It quadruples', 'It halves', 'It stays the same'],
      answer: 1,
      why: 'Γ = 2π|V|²ρ is quadratic in the coupling.',
    },
  },
  {
    title: 'Twice the coupling',
    preset: { V: 0.04, delta: 0.01, centre: 0 },
    play: true,
    focus: ['Is it still there?'],
    html: ({ model }) => `<p>With V doubled, Γ = ${fmt(model.G, 4)}: four times faster. Fermi's golden rule underlies every decay rate you'll meet: spontaneous emission, beta decay, absorption of light, scattering cross sections.</p>`,
  },
  {
    title: 'The natural line width',
    preset: { V: 0.02, delta: 0.01, centre: 0 },
    focus: ['Which levels it went to', 'Is it still there?'],
    html: ({ model }) => `<p>Once the level has emptied, look at where the probability ended up. It is spread over a <b>Lorentzian</b> of full width Γ = ${fmt(model.G, 3)} around the starting energy (amber line). A state that lives for a time τ = 1/Γ has an energy blurred by about ħ/τ.</p>
      <p>That is why spectral lines from short-lived states are broad: the natural line width.</p>`,
    math: `The Weisskopf–Wigner solution gives, for t ≫ 1/Γ,
      <span class="eq">P_k = V² / (E_k² + Γ²/4)</span>
      plus a small energy shift from the band (its self-energy). The tests check this against the exact evolution to 2%.`,
  },
  {
    title: 'The band gives it back',
    preset: { V: 0.02, delta: 0.03, centre: 0, window: 'long' },
    play: true,
    focus: ['Is it still there?'],
    html: `<p>With widely spaced levels the decay is only exponential for a while. At t = 2π/δ all the band's phases realign and the probability comes back (a <b>recurrence</b>). A true, irreversible decay needs a continuum, δ → 0, where the recurrence time is infinite.</p>`,
  },
  {
    title: 'No states, no decay',
    preset: { V: 0.02, delta: 0.01, centre: 2 },
    focus: ['Is it still there?'],
    html: `<p>Move the band away so that no final level has the starting energy. Now ρ = 0 at energy 0 and the golden rule says Γ = 0: the level barely changes. Energy conservation forbids the transition, which is why an atom whose excited state lies below every other channel is stable.</p>`,
  },
  {
    title: 'Your turn',
    preset: { V: 0.015, delta: 0.008, centre: 0 },
    html: `<p>Change the coupling, the level spacing and where the band sits, and compare the exact decay with first-order theory and the golden rule.</p>`,
  },
];

runLesson({
  slug: 'golden-rule',
  settings: { V: 0.02, delta: 0.01, centre: 0, window: 'decay' },
  controls: [
    { id: 'window', label: 'Time shown', type: 'choice', options: [['decay', 'A few lifetimes'], ['long', 'Past the recurrence']] },
    { id: 'V', label: 'Coupling V', type: 'range', min: 0.005, max: 0.05, step: 0.001, format: (v) => v.toFixed(3) },
    { id: 'delta', label: 'Level spacing δ in the band', type: 'range', min: 0.004, max: 0.05, step: 0.001, format: (v) => v.toFixed(3) },
    { id: 'centre', label: 'Centre of the band', type: 'range', min: -2, max: 2, step: 0.05, format: (v) => v.toFixed(2), hint: 'The starting level sits at energy 0.' },
  ],
  cards: [
    { id: 'survival', title: 'Is it still there?', legend: '<span class="key exact" style="border-color: var(--accent-2)"></span> exact <span class="key trotter"></span> golden rule e^(−Γt) <span class="key dashed" style="border-color: var(--amp-neg)"></span> first order', height: 250 },
    { id: 'spectrum', title: 'Which levels it went to', legend: 'bars = exact', height: 220 },
  ],
  steps: STEPS,
  compute,
  player: { duration: (api) => api.model.tmax },
  draw(api) {
    drawSurvival(api);
    drawSpectrum(api);
    const stats = api.el('survival');
    stats.setAttribute('aria-label', `Survival probability ${percent(api.model.P0[Math.min(api.model.P0.length - 1, Math.round((api.t / api.model.tmax) * 300))])}`);
  },
});
