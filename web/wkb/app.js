import { action, wkbLevel, wkbTransmission } from '../lib/approx.js';
import { eigenstates, makeGrid, potentialFrom, transmission } from '../lib/wave.js';
import { withAlpha } from '../ui/bloch.js';
import { MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { mountLesson } from '../ui/lesson.js';

// WKB: a slowly varying potential lets the wave be treated as locally plane, with wavelength
// 2 pi / p(x). Levels from the quantisation condition  integral p dx = (n + mu) pi, compared with the
// exact numerical levels; a tunnelling estimate exp(-2 integral kappa dx) against exact transmission.

const L = 12;
const GRID = makeGrid(2400, -L, L);
const POTENTIALS = {
  oscillator: { name: 'Harmonic oscillator', V: (x) => (x * x) / 2, mu: 0.5, eMax: 9, xRange: [-5, 5] },
  vee: { name: 'V-shaped well |x|', V: (x) => Math.abs(x), mu: 0.5, eMax: 7, xRange: [-7, 7] },
  quartic: { name: 'Quartic well x⁴/4', V: (x) => x ** 4 / 4, mu: 0.5, eMax: 9, xRange: [-3, 3] },
  // exact levels for the box are analytic: a grid can only approximate a wall at an exact position
  box: { name: 'Box (width π, hard walls)', V: (x) => (Math.abs(x) < Math.PI / 2 ? 0 : 1e4), mu: 1, eMax: 20, xRange: [-2, 2], exact: (n) => (n + 1) ** 2 / 2 },
};
const BARRIER = { V0: 3, V: (x) => 3 * Math.exp(-x * x) };

const STEPS = [
  {
    title: 'A wave with a changing wavelength',
    preset: { pot: 'vee', n: 6 },
    html: `<p>Where the potential changes slowly, the wave doesn't notice: locally it looks like a plane wave with momentum p(x) = √(2m(E − V(x))) and wavelength 2π/p. Near the bottom of the well the particle is fast and the wiggles are short; near the walls it slows and they stretch.</p>
      <p>That's the <b>WKB approximation</b> (Wentzel, Kramers, Brillouin, 1926). The amber curve is ψ<sub>WKB</sub> ∝ cos(∫p dx)/√p; the cyan one is exact.</p>`,
  },
  {
    title: 'Fitting a whole number of wiggles',
    preset: { pot: 'oscillator', n: 3 },
    html: `<p>For a state to fit in the well, the phase ∫p dx accumulated between the two turning points must be (n + ½)π. The extra ½ comes from the wave leaking a little past each soft turning point.</p>
      <p>In <b>phase space</b> (right) each classical orbit is a closed curve, and the rule says its area is (n + ½)h: the old Bohr–Sommerfeld rule, now derived. For the oscillator it gives E = n + ½ exactly.</p>`,
  },
  {
    title: 'Better at high energy',
    preset: { pot: 'vee', n: 0 },
    html: ({ rows }) => `<p>For the V-shaped well WKB is not exact. The table compares it with the exact levels: ${rows[0].err.toFixed(1)}% off for the ground state, but ${rows[rows.length - 1].err.toFixed(2)}% for level ${rows.length - 1}.</p>
      <p>Higher levels have shorter wavelengths, so the potential looks ever more slowly varying: WKB becomes exact in the classical limit, another face of the correspondence principle.</p>`,
  },
  {
    title: 'Hard walls',
    preset: { pot: 'box', n: 2 },
    html: `<p>At a hard wall the wave must vanish, with no leaking, so each wall adds ½ instead of ¼ and the rule becomes (n + 1)π. For the box that reproduces E<sub>n</sub> = n²/2 exactly.</p>`,
  },
  {
    title: 'Where it fails: turning points',
    preset: { pot: 'quartic', n: 1 },
    html: `<p>Look closely at the turning points: ψ<sub>WKB</sub> ∝ 1/√p <b>blows up</b> where p → 0, because the wavelength becomes infinite and "slowly varying" makes no sense. The exact wave passes smoothly.</p>
      <p>Matching across the turning point with Airy functions (the "connection formulas") is what produces the ½ in the quantisation rule.</p>`,
  },
  {
    title: 'Tunnelling, estimated',
    preset: { pot: 'vee', n: 3 },
    html: `<p>Under a barrier p is imaginary and the wave decays as e<sup>−∫κ dx</sup>, so the transmission is roughly T ≈ e<sup>−2∫κ dx</sup> (lower chart, log scale). Deep below the top it tracks the exact curve; near the top the estimate fails.</p>
      <p>Gamow used exactly this in 1928 to explain alpha decay: tiny changes in the energy change the exponent, so half-lives range from nanoseconds to billions of years.</p>`,
  },
  {
    title: 'Your turn',
    preset: { pot: 'quartic', n: 8 },
    html: `<p>Pick a potential and a level. How high do you need to go in each well before WKB is within 0.1%?</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<figure class="panel card">
    <figcaption class="card-head"><h2>The wave in the well</h2><span class="legend">amber = WKB; cyan = exact; dashed = level energy</span></figcaption>
    <canvas id="wave" class="chart tall" role="img" aria-label="WKB and exact wavefunctions in the potential"></canvas>
  </figure>
  <div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2>Phase space</h2><span class="legend">orbits of area (n + μ)h; the chosen level filled</span></figcaption>
      <canvas id="phase" class="chart" style="height: 320px" role="img" aria-label="Classical orbits in phase space"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>WKB against exact</h2><span class="legend" id="table-legend"></span></figcaption>
      <div id="table"></div>
    </figure>
  </div>
  <figure class="panel card">
    <figcaption class="card-head"><h2>Tunnelling through a smooth barrier</h2><span class="legend">V = 3 e^(−x²); log scale</span></figcaption>
    <canvas id="tunnel" class="chart" role="img" aria-label="Transmission against energy: exact and WKB"></canvas>
  </figure>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">Potential</span>
      <select id="pot">${Object.entries(POTENTIALS)
        .map(([k, p]) => `<option value="${k}">${p.name}</option>`)
        .join('')}</select></label>
    <label class="field"><span class="label">Level n <output id="n-out"></output></span><input id="n" type="range" min="0" max="10" step="1"></label>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { pot: 'vee', n: 3 };
let index = 0;
let model = null;
let tunnelCurve = null;

function rebuild() {
  const P = POTENTIALS[settings.pot];
  const V = potentialFrom(GRID, P.V);
  const states = eigenstates(V, GRID.dx, 11);
  const levels = states.map((_, n) => wkbLevel(P.V, n, { mu: P.mu, range: [-L, L], Emax: 400 }));
  model = { P, V, states, levels };
}

// psi_WKB for energy E: cos(phase - pi/4)/sqrt(p) inside, a decaying exponential outside.
function wkbWave(E, n) {
  const { P } = model;
  const x = GRID.x;
  const p = Float64Array.from(x, (xi) => Math.sqrt(Math.max(0, 2 * (E - P.V(xi)))));
  const left = x.findIndex((xi) => P.V(xi) < E);
  const out = new Float64Array(x.length);
  let phase = 0;
  // cos(phase - pi/4) from a soft turning point; sin(phase) = cos(phase - pi/2) from a hard wall
  const offset = P.mu === 1 ? -Math.PI / 2 : -Math.PI / 4;
  for (let i = left; i < x.length && P.V(x[i]) < E; i++) {
    phase += p[i] * GRID.dx;
    out[i] = Math.cos(phase + offset) / Math.sqrt(p[i]);
  }
  // decaying tails (soft walls only)
  if (P.mu !== 1) {
    let k = 0;
    for (let i = left - 1; i >= 0; i--) {
      k += Math.sqrt(2 * (P.V(x[i]) - E)) * GRID.dx;
      out[i] = (0.5 * Math.exp(-k)) / Math.sqrt(Math.sqrt(2 * (P.V(x[i]) - E)));
    }
    const right = x.findLastIndex((xi) => P.V(xi) < E);
    k = 0;
    // every potential here is symmetric, so level n has parity (-1)^n
    const sign = n % 2 ? -1 : 1;
    for (let i = right + 1; i < x.length; i++) {
      k += Math.sqrt(2 * (P.V(x[i]) - E)) * GRID.dx;
      out[i] = (sign * 0.5 * Math.exp(-k)) / Math.sqrt(Math.sqrt(2 * (P.V(x[i]) - E)));
    }
  }
  return out;
}

function drawWave(th) {
  const { ctx, w, h } = prep($('wave'));
  const box = { x0: 44, y0: 12, x1: w - 14, y1: h - 28 };
  const { P, V, states, levels } = model;
  const n = settings.n;
  const X = xAxis(ctx, box, P.xRange, th);
  const Y = (e) => box.y1 - (e / P.eMax) * (box.y1 - box.y0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  ctx.clip();
  ctx.fillStyle = withAlpha(th.muted, 0.14);
  ctx.beginPath();
  ctx.moveTo(X(GRID.x[0]), box.y1);
  GRID.x.forEach((x, i) => ctx.lineTo(X(x), Math.max(box.y0 - 2, Y(V[i]))));
  ctx.lineTo(X(GRID.x[GRID.n - 1]), box.y1);
  ctx.fill();
  const E = states[n].E;
  const base = Y(E);
  ctx.strokeStyle = withAlpha(th.text, 0.4);
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(box.x0, Math.round(base) + 0.5);
  ctx.lineTo(box.x1, Math.round(base) + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  // exact state, scaled; WKB scaled to match it near the bottom of the well
  const ex = states[n].psi;
  const wk = wkbWave(levels[n], n);
  let peak = 0;
  for (const v of ex) peak = Math.max(peak, Math.abs(v));
  // least-squares scale of WKB onto exact over the allowed region, away from the turning points
  let num = 0;
  let den = 0;
  GRID.x.forEach((x, i) => {
    if (P.V(x) < 0.8 * E) {
      num += wk[i] * ex[i];
      den += wk[i] * wk[i];
    }
  });
  const scale = den > 0 ? num / den : 0;
  const amp = 0.16 * (box.y1 - box.y0);
  const line = (vals, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    vals.forEach((v, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(GRID.x[i]), base - Math.max(-3, Math.min(3, v / peak)) * amp));
    ctx.stroke();
  };
  line(ex, th.ampPos, 2.5);
  line(Array.from(wk, (v) => v * scale), th.marked, 2);
  ctx.restore();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`position x; level n = ${n}`, (box.x0 + box.x1) / 2, h);
}

function drawPhase(th) {
  const { ctx, w, h } = prep($('phase'));
  const box = { x0: 44, y0: 12, x1: w - 14, y1: h - 28 };
  const { P, levels } = model;
  const Emax = levels[Math.min(10, levels.length - 1)];
  const pMax = Math.sqrt(2 * Emax) * 1.05;
  const X = xAxis(ctx, box, P.xRange, th);
  const Y = yAxis(ctx, box, [-pMax, pMax], th);
  levels.forEach((E, n) => {
    const on = n === settings.n;
    const pts = [];
    for (let i = 0; i < 400; i++) {
      const x = P.xRange[0] + ((P.xRange[1] - P.xRange[0]) * i) / 399;
      const v = P.V(x);
      if (v < E) pts.push([x, Math.sqrt(2 * (E - v))]);
    }
    if (!pts.length) return;
    ctx.beginPath();
    pts.forEach(([x, p], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(x), Y(p)));
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(X(pts[i][0]), Y(-pts[i][1]));
    ctx.closePath();
    if (on) {
      ctx.fillStyle = withAlpha(th.marked, 0.25);
      ctx.fill();
    }
    ctx.strokeStyle = on ? th.marked : withAlpha(th.ampPos, 0.55);
    ctx.lineWidth = on ? 2.5 : 1.2;
    ctx.stroke();
  });
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('position x; momentum p up', (box.x0 + box.x1) / 2, h);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const area = 2 * action(P.V, levels[settings.n], [-L, L]);
  ctx.fillText(`area of orbit ${settings.n} = ${(area / (2 * Math.PI)).toFixed(3)} h`, box.x0 + 4, box.y0);
}

function tableRows() {
  const { states, levels, P } = model;
  return states
    .map((s, n) => {
      const exact = P.exact ? P.exact(n) : s.E;
      return { n, exact, wkb: levels[n], err: (Math.abs(levels[n] - exact) / exact) * 100 };
    })
    .filter((r) => r.exact < P.eMax * 3);
}

function drawTable(rows) {
  $('table').innerHTML = `<div class="table-scroll"><table class="data-table"><thead><tr><th>n</th><th>WKB</th><th>exact</th><th>error</th></tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr${r.n === settings.n ? ' style="color: var(--marked)"' : ''}><td>${r.n}</td><td>${r.wkb.toFixed(4)}</td><td>${r.exact.toFixed(4)}</td><td>${r.err < 0.005 ? '< 0.01%' : `${r.err.toFixed(2)}%`}</td></tr>`,
    )
    .join('')}</tbody></table></div>`;
  $('table-legend').textContent = `∫p dx = (n + ${model.P.mu === 1 ? '1' : '½'})π`;
}

function drawTunnel(th) {
  if (!tunnelCurve) {
    const tg = makeGrid(3000, -8, 8);
    const V = potentialFrom(tg, BARRIER.V);
    tunnelCurve = Array.from({ length: 120 }, (_, i) => {
      const E = 0.1 + (i / 119) * 3.4;
      return [E, transmission(V, tg.dx, E).T, E < BARRIER.V0 ? wkbTransmission(BARRIER.V, E, [-8, 8]) : 1];
    });
  }
  const { ctx, w, h } = prep($('tunnel'));
  const box = { x0: 52, y0: 12, x1: w - 14, y1: h - 30 };
  const lo = -8;
  const Y = (T) => box.y1 - ((Math.log10(Math.max(T, 1e-8)) - lo) / -lo) * (box.y1 - box.y0);
  const X = xAxis(ctx, box, [0, 3.5], th);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let e = lo; e <= 0; e += 2) {
    ctx.strokeStyle = withAlpha(th.muted, 0.15);
    ctx.beginPath();
    ctx.moveTo(box.x0, Math.round(Y(10 ** e)) + 0.5);
    ctx.lineTo(box.x1, Math.round(Y(10 ** e)) + 0.5);
    ctx.stroke();
    ctx.fillText(e === 0 ? '1' : `10^${e}`, box.x0 - 6, Y(10 ** e));
  }
  ctx.strokeStyle = withAlpha(th.muted, 0.7);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(Math.round(X(BARRIER.V0)) + 0.5, box.y0);
  ctx.lineTo(Math.round(X(BARRIER.V0)) + 0.5, box.y1);
  ctx.stroke();
  ctx.setLineDash([]);
  const line = (k, color, width, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    tunnelCurve.forEach((r, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(r[0]), Y(r[k])));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  line(1, th.ampPos, 2.5);
  line(2, th.marked, 2, [6, 4]);
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('top of barrier', X(BARRIER.V0) + 4, box.y0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('energy E; cyan = exact, amber dashed = WKB', (box.x0 + box.x1) / 2, h);
}

function render() {
  const th = theme();
  const rows = tableRows();
  drawWave(th);
  drawPhase(th);
  drawTable(rows);
  drawTunnel(th);
  const ctx = { ...settings, rows };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

function syncControls() {
  $('pot').value = settings.pot;
  $('n').value = String(settings.n);
  $('n-out').textContent = String(settings.n);
}

$('pot').addEventListener('change', () => {
  settings.pot = $('pot').value;
  rebuild();
  render();
});
$('n').addEventListener('input', () => {
  settings.n = Number($('n').value);
  syncControls();
  render();
});

const lesson = mountLesson({ slug: 'wkb', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  Object.assign(settings, STEPS[i].preset);
  rebuild();
  syncControls();
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  render();
}

window.addEventListener('themechange', render);
new ResizeObserver(() => render()).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
