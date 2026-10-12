import { asymptotic, chargeBasisLevels, dispersion, phaseBasis } from '../lib/transmon.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// The transmon qubit: H = 4E_C(n − n_g)² − E_J cos φ, diagonalised in the charge basis for the
// level diagram and on a grid in φ for the wavefunctions (lib/transmon.js). The tests check the two
// solvers against each other and against Koch et al.'s asymptotic formulas.

const EC_GHZ = 0.25; // a typical charging energy E_C/h
const phaseCache = new Map();

function compute(s) {
  const key = `${s.ratio}|${s.ng}`;
  if (!phaseCache.has(key)) phaseCache.set(key, phaseBasis(s.ratio, s.ng, { M: 100, count: 4 }));
  const levels = chargeBasisLevels(s.ratio, s.ng, { count: 4 });
  return { levels, phase: phaseCache.get(key) };
}

function drawBands(api) {
  const { ctx, w, h } = prep(api.canvas('bands'));
  const th = api.theme;
  const s = api.settings;
  const box = { x0: 50, y0: 16, x1: w - 16, y1: h - 36 };
  const ngs = Array.from({ length: 161 }, (_, i) => -2 + i * 0.025);
  const rows = ngs.map((ng) => chargeBasisLevels(s.ratio, ng, { count: 3 }));
  // normalise like Koch et al.: energies relative to the ground level at n_g = 1/2, in units of E01 there
  const ref = chargeBasisLevels(s.ratio, 0.5, { count: 2 });
  const e01 = ref[1] - ref[0];
  const scaled = rows.map((r) => r.map((e) => (e - ref[0]) / e01));
  const lo = Math.min(...scaled.flat());
  const hi = Math.max(...scaled.flat());
  const X = (ng) => box.x0 + ((ng + 2) / 4) * (box.x1 - box.x0);
  const Y = (v) => box.y1 - ((v - lo) / (hi - lo || 1)) * (box.y1 - box.y0);
  const colors = [th.accent2, th.ampNeg, th.marked];
  for (let m = 0; m < 3; m++) {
    ctx.strokeStyle = colors[m];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ngs.forEach((ng, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(ng), Y(scaled[i][m])));
    ctx.stroke();
  }
  ctx.strokeStyle = th.text;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(X(s.ng), box.y0);
  ctx.lineTo(X(s.ng), box.y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const ng of [-2, -1, 0, 1, 2]) ctx.fillText(String(ng), X(ng), box.y1 + 4);
  ctx.font = FONT;
  ctx.fillText('offset charge n_g (set by stray charges and gate voltage)', (box.x0 + box.x1) / 2, box.y1 + 18);
  ctx.textAlign = 'left';
  ctx.fillStyle = th.text;
  ctx.fillText(`E_J/E_C = ${fmt(s.ratio, 1)} · levels 0, 1, 2 in units of the 0–1 spacing`, box.x0 + 6, box.y0);
}

function drawWell(api) {
  const { ctx, w, h } = prep(api.canvas('well'));
  const th = api.theme;
  const s = api.settings;
  const { phase } = api.model;
  const box = { x0: 40, y0: 16, x1: w - 16, y1: h - 30 };
  const X = (phi) => box.x0 + ((phi + Math.PI) / (2 * Math.PI)) * (box.x1 - box.x0);
  const top = s.ratio * 1.1;
  const bottom = -s.ratio * 1.05;
  const Y = (e) => box.y1 - ((e - bottom) / (top - bottom)) * (box.y1 - box.y0);
  ctx.strokeStyle = withAlpha(th.muted, 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 200; i++) {
    const phi = -Math.PI + (2 * Math.PI * i) / 200;
    (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(phi), Y(-s.ratio * Math.cos(phi)));
  }
  ctx.stroke();
  const colors = [th.accent2, th.ampNeg, th.marked];
  const spacing = (phase.levels[1] - phase.levels[0]) * 0.8;
  for (let m = 0; m < 3; m++) {
    const E = phase.levels[m];
    if (E > top) continue;
    const dens = phase.densities[m];
    const dmax = Math.max(...dens);
    ctx.strokeStyle = withAlpha(colors[m], 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(box.x0, Y(E));
    ctx.lineTo(box.x1, Y(E));
    ctx.stroke();
    ctx.strokeStyle = colors[m];
    ctx.lineWidth = 2;
    ctx.beginPath();
    phase.phis.forEach((phi, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(phi), Y(E + (dens[i] / dmax) * spacing * 0.9)));
    ctx.stroke();
  }
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  [
    [-Math.PI, '−π'],
    [0, '0'],
    [Math.PI, 'π'],
  ].forEach(([phi, t]) => ctx.fillText(t, X(phi), box.y1 + 4));
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.fillStyle = th.text;
  ctx.fillText('the potential −E_J cos φ in the superconducting phase φ, with the lowest three levels and |ψ(φ)|²', box.x0 + 6, box.y0);
}

function numbersHtml(api) {
  const s = api.settings;
  const L = api.model.levels;
  const e01 = L[1] - L[0];
  const e12 = L[2] - L[1];
  const disp = dispersion(s.ratio, 1) + dispersion(s.ratio, 0);
  api.el('numbers').innerHTML = `<div class="readout-grid">
      <div class="stat"><span>Qubit frequency f₀₁ (E_C/h = ${EC_GHZ} GHz)</span><b>${fmt(e01 * EC_GHZ, 3)} GHz</b></div>
      <div class="stat"><span>Anharmonicity f₁₂ − f₀₁</span><b>${fmt((e12 - e01) * EC_GHZ * 1000, 0)} MHz</b></div>
      <div class="stat"><span>f₀₁ wobble with n_g (charge dispersion)</span><b>${disp * EC_GHZ * 1e3 > 1 ? `${fmt(disp * EC_GHZ * 1e3, 1)} MHz` : `${fmt(disp * EC_GHZ * 1e6, disp * EC_GHZ * 1e6 < 1 ? 4 : 1)} kHz`}</b></div>
      <div class="stat"><span>Koch et al.'s estimate √(8E_JE_C) − E_C</span><b>${fmt(asymptotic.f01(s.ratio) * EC_GHZ, 3)} GHz</b></div></div>`;
}

const STEPS = [
  {
    title: 'A qubit made of a circuit',
    preset: { ratio: 1, ng: 0.3 },
    focus: ['Energy levels against offset charge'],
    html: `<p>A superconducting qubit is an electrical circuit cooled to about 10 mK: a capacitor and a <b>Josephson junction</b>, two superconductors separated by a thin insulator. Cooper pairs tunnel across it, and the junction behaves as a nonlinear inductor. Two energies set everything: the charging energy E<sub>C</sub> of the capacitor and the Josephson energy E<sub>J</sub>.</p>
      <p>With E<sub>J</sub> ≈ E<sub>C</sub> (the original Cooper-pair box) the levels swing wildly with the offset charge n<sub>g</sub>, which stray charges in the chip shift randomly. The qubit frequency jitters and the qubit dephases.</p>`,
    math: `<span class="eq">H = 4E_C (n − n_g)² − E_J cos φ</span>
      n counts Cooper pairs that have crossed the junction and φ is the superconducting phase difference; they are conjugate, like position and momentum.`,
  },
  {
    title: 'The transmon idea',
    preset: { ratio: 50, ng: 0.3 },
    focus: ['Energy levels against offset charge', 'Numbers'],
    html: `<p>Koch and colleagues (2007) proposed a large shunt capacitor, making E<sub>J</sub>/E<sub>C</sub> ≈ 50. The bands go flat: the sensitivity to charge falls <b>exponentially</b>, as e<sup>−√(8E<sub>J</sub>/E<sub>C</sub>)</sup>: the wobble of the qubit frequency drops from hundreds of megahertz at E<sub>J</sub> = E<sub>C</sub> to about 10 kHz at 50 (with E<sub>C</sub>/h = 250 MHz). This is the qubit inside most of today's superconducting processors.</p>`,
    predict: {
      q: 'What does the large E_J/E_C cost?',
      options: ['Nothing', 'Some anharmonicity: the levels become more evenly spaced, but only slowly', 'The qubit stops oscillating', 'Exponentially more noise'],
      answer: 1,
      why: 'The anharmonicity tends to about −E_C, falling only as a power law while charge sensitivity falls exponentially: the trade that made the transmon work.',
    },
  },
  {
    title: 'An anharmonic oscillator',
    preset: { ratio: 50, ng: 0.3 },
    focus: ['The potential and the wavefunctions', 'Numbers'],
    html: `<p>In the phase picture the transmon is a particle in a cosine well. Near the bottom it is almost a harmonic oscillator, but the well widens upwards, so each level spacing is smaller than the one below: the 1–2 transition sits a little more than E<sub>C</sub> below the 0–1 transition (287 MHz here; it tends to E<sub>C</sub> as E<sub>J</sub>/E<sub>C</sub> grows). That <b>anharmonicity</b> is what lets microwave pulses address levels 0 and 1 alone, and level 2 is close enough to cause leakage (next lesson).</p>`,
  },
  {
    title: 'Numbers you meet in the lab',
    preset: { ratio: 50, ng: 0.3 },
    focus: ['Numbers'],
    html: `<p>With E<sub>C</sub>/h = 250 MHz and E<sub>J</sub>/E<sub>C</sub> = 50, the qubit frequency is about 4.7 GHz, microwaves. At that frequency hf/k<sub>B</sub> ≈ 0.23 K, so the chip must sit at about 10 mK to keep thermal excitations rare. Koch et al.'s estimate √(8E<sub>J</sub>E<sub>C</sub>) − E<sub>C</sub> is within a percent; the tests check it, and two independent solvers, against each other.</p>`,
  },
  {
    title: 'Your turn',
    preset: { ratio: 10, ng: 0 },
    html: `<p>Sweep E<sub>J</sub>/E<sub>C</sub> from 1 to 100. At what ratio does the charge dispersion drop below 1 MHz? Watch the wavefunctions narrow in φ as the well deepens.</p>`,
  },
];

runLesson({
  slug: 'transmon',
  settings: { ratio: 1, ng: 0.3 },
  controls: [
    { id: 'ratio', label: 'E_J / E_C', type: 'range', min: 0.5, max: 100, step: 0.5, format: (v) => v.toFixed(1) },
    { id: 'ng', label: 'Offset charge n_g', type: 'range', min: -1, max: 1, step: 0.05, format: (v) => v.toFixed(2) },
  ],
  cards: [
    { id: 'bands', title: 'Energy levels against offset charge', height: 260 },
    { id: 'well', title: 'The potential and the wavefunctions', height: 260 },
    { id: 'numbers', title: 'Numbers', kind: 'html' },
  ],
  steps: STEPS,
  compute,
  draw(api) {
    drawBands(api);
    drawWell(api);
    numbersHtml(api);
  },
});
