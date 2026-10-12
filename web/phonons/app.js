import { chainModes, energyOf, fluctuations, twoOscillatorsExact, twoOscillatorsFock } from '../lib/fields.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// From oscillators to particles: a chain of masses and springs, its normal modes, and the quanta
// of those modes (phonons). lib/fields.js; the tests check the mode frequencies against a
// numerical diagonalisation and the phonon spectrum of two coupled quantum oscillators against a
// diagonalisation in a truncated Fock basis.

const occOf = (text, N) => {
  const parts = String(text ?? '').split(',');
  return Array.from({ length: N }, (_, i) => Math.max(0, Math.min(9, Math.round(Number(parts[i]) || 0))));
};
let fockCache = null;

function bump(api, by) {
  const s = api.settings;
  const k = Math.min(Math.max(1, s.mode), s.N);
  const occ = occOf(s.occ, s.N);
  occ[k - 1] = Math.max(0, Math.min(9, occ[k - 1] + by));
  const last = occ.reduce((m, v, i) => (v ? i : m), -1);
  api.set({ occ: occ.slice(0, last + 1).join(','), show: 'quantum', mode: k });
}

function compute(s) {
  const modes = chainModes(s.N, s.w0);
  const occ = occOf(s.occ, s.N);
  return { modes, occ, sigma: fluctuations(modes, occ), E: energyOf(modes, occ), E0: energyOf(modes, []) };
}

// classical displacement of mass j at time t: the chosen mode, or modes 1 and 2 together
function displacement(api, j) {
  const { modes } = api.model;
  const s = api.settings;
  const t = api.t;
  if (s.mode > 0) {
    const m = modes[Math.min(s.mode, modes.length) - 1];
    return m.shape[j] * Math.cos(m.omega * t);
  }
  return (modes[0].shape[j] * Math.cos(modes[0].omega * t) + (modes[1]?.shape[j] ?? 0) * Math.cos((modes[1]?.omega ?? 0) * t)) / Math.SQRT2;
}

function drawChain(api) {
  const { ctx, w, h } = prep(api.canvas('chain'));
  const th = api.theme;
  const s = api.settings;
  const { sigma } = api.model;
  const N = s.N;
  const x0 = 40;
  const x1 = w - 40;
  const X = (j) => x0 + ((j + 1) / (N + 1)) * (x1 - x0);
  const yc = h / 2 + 6;
  const amp = (h / 2 - 40) * 2.2;
  // walls
  ctx.fillStyle = withAlpha(th.muted, 0.35);
  ctx.fillRect(x0 - 10, yc - 50, 10, 100);
  ctx.fillRect(x1, yc - 50, 10, 100);
  const ys = Array.from({ length: N }, (_, j) => yc - (s.show === 'quantum' ? 0 : amp * displacement(api, j)));
  // springs (zigzags) between neighbours and to the walls
  const spring = (xa, ya, xb, yb) => {
    const turns = 8;
    const dx = xb - xa;
    const dy = yb - ya;
    const len = Math.hypot(dx, dy);
    const [nx, ny] = [-dy / len, dx / len];
    ctx.beginPath();
    ctx.moveTo(xa, ya);
    for (let i = 1; i < 2 * turns; i++) {
      const f = i / (2 * turns);
      const side = i % 2 ? 5 : -5;
      ctx.lineTo(xa + dx * f + nx * side, ya + dy * f + ny * side);
    }
    ctx.lineTo(xb, yb);
    ctx.stroke();
  };
  ctx.strokeStyle = withAlpha(th.muted, 0.8);
  ctx.lineWidth = 1.3;
  const pts = [[x0, yc], ...ys.map((y, j) => [X(j), y]), [x1, yc]];
  for (let i = 0; i + 1 < pts.length; i++) spring(...pts[i], ...pts[i + 1]);
  // pinning springs (w0 > 0)
  if (s.w0 > 0) {
    ctx.strokeStyle = withAlpha(th.accent, 0.5);
    ys.forEach((y, j) => {
      ctx.beginPath();
      ctx.moveTo(X(j), yc + 60);
      ctx.lineTo(X(j), y + 12);
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }
  // quantum fluctuation bands: ±σ_j around the rest position
  if (s.show === 'quantum') {
    sigma.forEach((sg, j) => {
      const half = Math.max(2, amp * sg);
      const g = ctx.createLinearGradient(0, yc - half, 0, yc + half);
      g.addColorStop(0, withAlpha(th.accent2, 0));
      g.addColorStop(0.5, withAlpha(th.accent2, 0.55));
      g.addColorStop(1, withAlpha(th.accent2, 0));
      ctx.fillStyle = g;
      ctx.fillRect(X(j) - 9, yc - half, 18, 2 * half);
    });
  }
  // masses
  ys.forEach((y, j) => {
    ctx.beginPath();
    ctx.arc(X(j), y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = th.surfaceSolid;
    ctx.fill();
    ctx.strokeStyle = s.show === 'quantum' ? th.accent2 : th.ampNeg;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(
    s.show === 'quantum'
      ? `quantum: the band is ±√⟨u²⟩ for each mass in the state |${api.model.occ.join(',')}⟩`
      : s.mode > 0
        ? `classical: normal mode ${Math.min(s.mode, N)} alone, every mass at the same frequency (displacement drawn sideways)`
        : 'classical: modes 1 and 2 together (displacement drawn sideways)',
    8,
    4,
  );
}

function drawModes(api) {
  const { ctx, w, h } = prep(api.canvas('modes'));
  const th = api.theme;
  const s = api.settings;
  const { modes, occ } = api.model;
  const box = { x0: 52, y0: 16, x1: w - 16, y1: h - 36 };
  const wmax = Math.sqrt(s.w0 * s.w0 + 4) * 1.08;
  const X = (q) => box.x0 + (q / Math.PI) * (box.x1 - box.x0);
  const Y = (om) => box.y1 - (om / wmax) * (box.y1 - box.y0);
  ctx.strokeStyle = th.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(box.x0, box.y0);
  ctx.lineTo(box.x0, box.y1);
  ctx.lineTo(box.x1, box.y1);
  ctx.stroke();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = 0; v <= wmax; v += 0.5) ctx.fillText(v.toFixed(1), box.x0 - 6, Y(v));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('0', X(0), box.y1 + 5);
  ctx.fillText('π/2', X(Math.PI / 2), box.y1 + 5);
  ctx.fillText('π', X(Math.PI), box.y1 + 5);
  ctx.font = FONT;
  ctx.fillText('wave number q (per lattice spacing)', (box.x0 + box.x1) / 2, box.y1 + 19);
  // continuum dispersion, and the relativistic form near q = 0
  const curve = (f, color, dash = []) => {
    ctx.strokeStyle = color;
    ctx.setLineDash(dash);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const q = (i / 200) * Math.PI;
      const y = Y(f(q));
      if (y < box.y0) break;
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(q), y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  curve((q) => Math.sqrt(s.w0 * s.w0 + 4 * Math.sin(q / 2) ** 2), withAlpha(th.muted, 0.7));
  curve((q) => Math.sqrt(s.w0 * s.w0 + q * q), withAlpha(th.accent, 0.6), [4, 4]);
  modes.forEach((m, i) => {
    const sel = s.mode === m.k;
    ctx.beginPath();
    ctx.arc(X(m.q), Y(m.omega), sel ? 6 : 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = occ[i] ? th.marked : sel ? th.ampNeg : th.accent2;
    ctx.fill();
    if (occ[i]) {
      ctx.fillStyle = th.text;
      ctx.font = MONO;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`n=${occ[i]}`, X(m.q), Y(m.omega) - 8);
    }
  });
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = withAlpha(th.accent, 0.9);
  ctx.fillText(s.w0 > 0 ? 'dashed: √(m² + q²), a relativistic particle of mass m = w₀' : 'dashed: ω = |q|, massless, like light', box.x0 + 8, box.y0);
}

function drawLevels(api) {
  const { ctx, w, h } = prep(api.canvas('levels'));
  const th = api.theme;
  const { modes, occ, E, E0 } = api.model;
  // all states with up to two phonons, energies above the ground state
  const states = [{ label: 'vacuum', e: 0 }];
  modes.forEach((m, i) => states.push({ label: `1 in mode ${m.k}`, e: m.omega, one: i }));
  modes.forEach((m, i) => modes.forEach((m2, j) => j >= i && states.push({ e: m.omega + m2.omega, two: [i, j] })));
  const emax = 2 * modes[modes.length - 1].omega * 1.05;
  const box = { x0: 70, y0: 14, x1: w - 200, y1: h - 18 };
  const Y = (e) => box.y1 - (e / emax) * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('E − E₀', box.x0 - 8, box.y0 + 4);
  const cols = [box.x0, box.x0 + (box.x1 - box.x0) * 0.36, box.x0 + (box.x1 - box.x0) * 0.68];
  const colW = (box.x1 - box.x0) * 0.28;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ['0 phonons', '1 phonon', '2 phonons'].forEach((t, k) => ctx.fillText(t, cols[k] + colW / 2, box.y1 + 16));
  for (const st of states) {
    const col = st.two ? 2 : st.one !== undefined ? 1 : 0;
    ctx.strokeStyle = withAlpha(col === 0 ? th.text : col === 1 ? th.accent2 : th.ampNeg, 0.75);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cols[col], Y(st.e));
    ctx.lineTo(cols[col] + colW, Y(st.e));
    ctx.stroke();
  }
  // the current Fock state
  const cur = E - E0;
  ctx.strokeStyle = th.marked;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(box.x0 - 4, Y(Math.min(cur, emax)));
  ctx.lineTo(box.x1 + 8, Y(Math.min(cur, emax)));
  ctx.stroke();
  ctx.fillStyle = th.marked;
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const total = occ.reduce((a, b) => a + b, 0);
  ctx.fillText(`|${occ.join(',')}⟩: ${total} phonon${total === 1 ? '' : 's'}`, box.x1 + 14, Y(Math.min(cur, emax)) - 9);
  ctx.fillText(`E − E₀ = ${fmt(cur, 3)}${cur > emax ? ' (off scale)' : ''}`, box.x1 + 14, Y(Math.min(cur, emax)) + 9);
}

function checkHtml(api) {
  const box = api.el('check');
  if (!fockCache) {
    const w0 = 1;
    const kappa = 0.6;
    fockCache = { values: twoOscillatorsFock(10, w0, kappa), exact: twoOscillatorsExact(w0, kappa, 8) };
  }
  const { values, exact } = fockCache;
  box.innerHTML = `<table class="tally"><thead><tr><th>level</th><th>Fock-basis diagonalisation</th><th>ω₊(n₊ + ½) + ω₋(n₋ + ½)</th><th>phonons (n₊, n₋)</th></tr></thead><tbody>
    ${exact.map((x, i) => `<tr><td>${i}</td><td>${values[i].toFixed(6)}</td><td>${x.E.toFixed(6)}</td><td>(${x.np}, ${x.nm})</td></tr>`).join('')}</tbody></table>
    <p class="hint">Two pinned masses (w₀ = 1) joined by a spring (κ = 0.6), written in the basis |n₁, n₂⟩ of the separate oscillators (up to 10 quanta each, a 121 × 121 matrix) and diagonalised numerically. The levels are exactly sums of quanta of the two normal modes, ω₊ = 1 and ω₋ = √(1 + 2κ) ≈ 1.483: the coupled system is a gas of independent phonons.</p>`;
}

const STEPS = [
  {
    title: 'Masses and springs',
    preset: { N: 8, w0: 0, mode: 0, show: 'classical', occ: '' },
    focus: ['A chain of masses'],
    play: true,
    html: `<p>Eight masses joined by springs, ends fixed. Push one and the motion spreads along the chain in a complicated way: every mass is coupled to its neighbours.</p>
      <p>This is a model of a crystal, and, in the limit of many masses, of a field: a displacement u(x, t) at every point of space.</p>`,
  },
  {
    title: 'Normal modes: independent oscillators',
    preset: { N: 8, w0: 0, mode: 1, show: 'classical', occ: '' },
    focus: ['A chain of masses', 'Modes and their frequencies'],
    play: true,
    html: `<p>There are special patterns, the <b>normal modes</b>, in which every mass moves at one shared frequency. Mode k is a standing wave with k half-wavelengths. Any motion is a sum of modes, and each mode oscillates on its own, untouched by the others.</p>
      <p>So N coupled masses are secretly N <i>uncoupled</i> oscillators. Pick a mode in <b>Try it</b>.</p>`,
    math: `<span class="eq">u_j = √(2/(N+1)) sin(j q_k),  q_k = kπ/(N+1),  ω_k = 2 sin(q_k/2)</span>
      The frequencies are the square roots of the eigenvalues of the matrix of spring couplings (tridiagonal 2, −1); the tests compare both.`,
  },
  {
    title: 'Quantise each mode',
    preset: { N: 8, w0: 0, mode: 1, show: 'quantum', occ: '1' },
    focus: ['Energy levels', 'Modes and their frequencies'],
    html: `<p>Quantum mechanically each mode is a harmonic oscillator with levels ω<sub>k</sub>(n<sub>k</sub> + ½). The number n<sub>k</sub> counts how many <b>quanta</b> are in mode k. A state of the whole chain is a list of these numbers, |n<sub>1</sub>, n<sub>2</sub>, …⟩, a <b>Fock state</b>.</p>
      <p>Here mode 1 holds one quantum. A quantum of vibration is called a <b>phonon</b>.</p>`,
    math: `<span class="eq">H = Σ_k ω_k (a_k† a_k + ½),  a_k† |…, n_k, …⟩ = √(n_k + 1) |…, n_k + 1, …⟩</span>`,
  },
  {
    title: 'Phonons behave like particles',
    preset: { N: 8, w0: 0, mode: 0, show: 'quantum', occ: '0,1,0,0,1' },
    focus: ['Energy levels', 'Modes and their frequencies'],
    html: `<p>A phonon in mode k carries energy ω<sub>k</sub> and wave number q<sub>k</sub>, like a particle with momentum. Two phonons have the sum of their energies. Two phonons in the same mode are not "phonon A and phonon B": only the count n<sub>k</sub> means anything. They are identical <b>bosons</b>.</p>
      <p>The ladder of levels on the right is the spectrum of a gas of free particles.</p>`,
    predict: {
      q: 'Two phonons sit in mode 1, or one each in modes 1 and 2. Which state has more energy?',
      options: ['Two in mode 1', 'One each in modes 1 and 2', 'They are equal', 'It depends on the masses’ positions'],
      answer: 1,
      why: 'Energies add: 2ω₁ against ω₁ + ω₂, and ω₂ > ω₁.',
    },
  },
  {
    title: 'The vacuum is not still',
    preset: { N: 8, w0: 0, mode: 0, show: 'quantum', occ: '' },
    focus: ['A chain of masses', 'Energy levels'],
    html: `<p>With no phonons at all, each mode still has energy ω<sub>k</sub>/2, and each mass still jitters: the bands show ±√⟨u<sub>j</sub>²⟩. These <b>zero-point fluctuations</b> of the vacuum are real; in a field theory they give the Casimir force and the Lamb shift.</p>
      <p>Add phonons to a mode in <b>Try it</b> and watch the bands widen where that mode's standing wave is large.</p>`,
  },
  {
    title: 'Pin the masses: particles get a mass',
    preset: { N: 12, w0: 0.8, mode: 1, show: 'classical', occ: '' },
    focus: ['Modes and their frequencies', 'A chain of masses'],
    play: true,
    html: `<p>Now tie every mass to its rest position with an extra spring of frequency w<sub>0</sub>. Even the longest wave now costs at least w<sub>0</sub>: the spectrum has a <b>gap</b>.</p>
      <p>Near q = 0 the dispersion is ω² = w<sub>0</sub>² + q², exactly the energy–momentum relation of a relativistic particle, E² = m²c⁴ + p²c², with mass m = w<sub>0</sub>. This chain is a lattice version of the <b>Klein–Gordon field</b>, and its phonons are massive particles. With w<sub>0</sub> = 0 they are massless, like photons.</p>`,
    math: `<span class="eq">ω_k² = w₀² + 4 sin²(q_k/2) → w₀² + q² for small q</span>
      In the continuum limit, ü = ∂²u/∂x² − w₀² u: the Klein–Gordon equation.`,
  },
  {
    title: 'Checking the quantum story',
    preset: { N: 8, w0: 0, mode: 0, show: 'quantum', occ: '' },
    focus: ['Quantum check: two coupled oscillators'],
    html: `<p>Is the coupled quantum system really just independent phonons? Take two masses, write the Hamiltonian in the basis of the separate oscillators, and diagonalise it numerically. Every level comes out as a sum of normal-mode quanta.</p>`,
  },
  {
    title: 'Your turn',
    preset: { N: 8, w0: 0.5, mode: 2, show: 'classical', occ: '0,2' },
    html: `<p>Change the number of masses, the pinning and the mode. Add phonons to different modes with the buttons and read off energies and fluctuations.</p>`,
  },
];

runLesson({
  slug: 'phonons',
  settings: { N: 8, w0: 0, mode: 0, show: 'classical', occ: '' },
  controls: [
    { id: 'show', label: 'Show', type: 'choice', options: [['classical', 'Classical motion'], ['quantum', 'Quantum fluctuations']] },
    { id: 'N', label: 'Masses N', type: 'range', min: 2, max: 16, step: 1 },
    { id: 'w0', label: 'Pinning w₀ (the mass)', type: 'range', min: 0, max: 1.5, step: 0.05, format: (v) => v.toFixed(2) },
    { id: 'mode', label: 'Normal mode k (0 = modes 1 and 2 together)', type: 'range', min: 0, max: 16, step: 1 },
    { type: 'button', label: 'Add a phonon to mode k', primary: true, onClick: (a) => bump(a, 1) },
    { type: 'button', label: 'Remove one', onClick: (a) => bump(a, -1) },
    { type: 'button', label: 'Empty (vacuum)', onClick: (a) => a.set({ occ: '' }) },
  ],
  cards: [
    { id: 'chain', title: 'A chain of masses', height: 230 },
    { id: 'modes', title: 'Modes and their frequencies', legend: 'dots = the N modes · amber = occupied', height: 250 },
    { id: 'levels', title: 'Energy levels', legend: 'all states with up to two phonons · amber = this state', height: 280 },
    { id: 'check', title: 'Quantum check: two coupled oscillators', kind: 'html', folded: true },
  ],
  steps: STEPS,
  compute,
  player: { duration: (api) => (6 * Math.PI) / api.model.modes[0].omega },
  draw(api) {
    drawChain(api);
    drawModes(api);
    drawLevels(api);
    checkHtml(api);
  },
});
