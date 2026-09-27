import { SERIES, energyEV, wavelengthColor, wavelengthNm } from '../lib/hydrogen.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, theme } from '../ui/charts.js';
import { mountLesson } from '../ui/lesson.js';

// Hydrogen's spectrum from its energy levels: a jump from level u to level d emits a photon with
// E = E_u - E_d, wavelength from the Rydberg formula (vacuum, reduced-mass corrected).

const HC_EV_NM = 1239.84198;
const LAMBDA = [85, 4200]; // log-scale axis of the spectrum, nm
// Measured vacuum wavelengths of the visible Balmer lines (NIST), for comparison.
const MEASURED = { 3: 656.46, 4: 486.27, 5: 434.17, 6: 410.29 };

const STEPS = [
  {
    title: 'Hydrogen glows in lines',
    preset: { series: 1, maxN: 6, mode: 'emission', jump: null, visibleOnly: true },
    html: `<p>Pass electricity through hydrogen gas and it glows pink. Split that light with a prism and you don't get a rainbow: you get <b>four sharp lines</b>, red, cyan, blue and violet.</p>
      <p>In 1885 Johann Balmer, a school teacher, found a formula that fitted their wavelengths exactly. Nobody knew why it worked for another 28 years.</p>`,
  },
  {
    title: 'Each line is a jump',
    preset: { series: 1, maxN: 6, mode: 'emission', jump: [3, 2], visibleOnly: true },
    html: ({ jump }) => `<p>The electron can only have the energies E<sub>n</sub> = −13.6 eV/n² (the levels on the left). When it drops from n = ${jump[0]} to n = ${jump[1]}, the energy difference leaves as one photon.</p>
      <p>Photon energy and wavelength are tied by E = hc/λ: ${(energyEV(jump[0]) - energyEV(jump[1])).toFixed(3)} eV makes λ = ${wavelengthNm(...jump).toFixed(1)} nm, the red line. Bohr explained this in 1913.</p>`,
  },
  {
    title: 'The Balmer series',
    preset: { series: 1, maxN: 10, mode: 'emission', jump: [5, 2], visibleOnly: false },
    html: `<p>All jumps that land on n = 2 form the <b>Balmer series</b>. Higher starting levels are closer together, so the lines crowd toward a limit at 364.7 nm, the energy to free an electron from n = 2.</p>
      <p>Click any upper level and then n = 2 to pick a line.</p>`,
  },
  {
    title: 'Light you can’t see',
    preset: { series: -1, maxN: 7, mode: 'emission', jump: [2, 1], visibleOnly: false },
    html: `<p>Jumps down to n = 1 release much more energy: the <b>Lyman series</b>, all in the ultraviolet (121.6 nm and shorter). Jumps down to n = 3 give the infrared <b>Paschen series</b>, and to n = 4 the Brackett series.</p>
      <p>The spectrum axis is logarithmic so all of them fit; the rainbow band is the small part our eyes can see.</p>`,
  },
  {
    title: 'Dark lines: absorption',
    preset: { series: 1, maxN: 8, mode: 'absorption', jump: [2, 3], visibleOnly: true },
    html: `<p>Run it backwards. White light shining through hydrogen loses exactly the photons that can lift an electron up a level, leaving <b>dark lines</b> at the same wavelengths.</p>
      <p>Cool gas has its electrons in n = 1, so it absorbs the ultraviolet Lyman lines. In the hot atmospheres of stars enough atoms sit in n = 2 to absorb these visible Balmer lines. Astronomers read them to learn a star's temperature and, from the lines' shifts, its speed.</p>`,
  },
  {
    title: 'How good is the formula?',
    preset: { series: 1, maxN: 6, mode: 'emission', jump: [4, 2], visibleOnly: true },
    html: `<p>The table below compares the formula with measurements. They agree to 0.01 nm, better than 1 part in 30,000.</p>
      <p>The tiny remaining differences are real: relativity and the electron's spin split each level very slightly (<b>fine structure</b>). Explaining them took Dirac's relativistic quantum mechanics.</p>`,
  },
  {
    title: 'Your turn',
    preset: { series: -1, maxN: 8, mode: 'emission', jump: [6, 3], visibleOnly: false },
    html: `<p>Click any two levels to make a jump, in either direction. Which jump gives the longest wavelength that is still visible? Which series has lines on both sides of the visible band?</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2>Energy levels</h2><span class="legend">click two levels</span></figcaption>
      <canvas id="levels" class="chart" style="height: 420px; cursor: pointer" role="img" aria-label="Energy levels of hydrogen with transitions"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2 id="jump-title">The photon</h2><span class="legend" id="jump-legend"></span></figcaption>
      <canvas id="photon" class="chart" style="height: 150px" role="img" aria-label="The emitted photon drawn as a wave of its true colour"></canvas>
      <dl class="facts" id="facts"></dl>
    </figure>
  </div>
  <figure class="panel card">
    <figcaption class="card-head"><h2 id="spectrum-title">Spectrum</h2><span class="legend">wavelength in nm, logarithmic</span></figcaption>
    <canvas id="spectrum" class="chart" style="height: 170px" role="img" aria-label="Hydrogen's spectral lines on a wavelength axis"></canvas>
    <div id="table" style="margin-top: 12px"></div>
  </figure>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">Show the jumps to</span>
      <select id="series"><option value="-1">n = 1 to 4 (all four series)</option>${Object.entries(SERIES)
        .slice(0, 4)
        .map(([d, name]) => `<option value="${d - 1}">n = ${d} (${name})</option>`)
        .join('')}</select></label>
    <label class="field"><span class="label">Highest level <output id="maxN-out"></output></span>
      <input id="maxN" type="range" min="3" max="12" step="1"></label>
    <label class="field"><span class="label">Light</span>
      <select id="mode"><option value="emission">Emission: glowing gas</option><option value="absorption">Absorption: white light through gas</option></select></label>
    <label class="field" style="display: flex; gap: 8px; align-items: center"><input id="visibleOnly" type="checkbox"> Show only the visible part</label>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { series: 2, maxN: 6, mode: 'emission', jump: null, visibleOnly: false };
let index = 0;
let picking = null; // first level clicked

// Transitions to draw: pairs [upper, lower].
function lines() {
  const out = [];
  // "every level" means the four named series: jumps ending on n = 1 to 4
  for (let d = 1; d < Math.min(settings.maxN, 5); d++) {
    if (settings.series >= 0 && d !== settings.series + 1) continue;
    for (let u = d + 1; u <= settings.maxN; u++) out.push([u, d]);
  }
  return out;
}

const colorOf = (nm, th) => wavelengthColor(nm) ?? (nm < 380 ? withAlpha(th.accent, 0.9) : withAlpha(th.ampNeg, 0.75));
const region = (nm) => (nm < 380 ? 'ultraviolet' : nm > 780 ? 'infrared' : 'visible');

// ----- level diagram -----

function levelLayout(w, h) {
  const box = { x0: 70, y0: 26, x1: w - 64, y1: h - 18 };
  const Y = (E) => box.y0 + ((0 - E) / 14.2) * (box.y1 - box.y0);
  return { box, Y };
}

function drawLevels(th) {
  const { ctx, w, h } = prep($('levels'));
  const { box, Y } = levelLayout(w, h);
  ctx.font = MONO;
  // ionisation
  ctx.strokeStyle = withAlpha(th.muted, 0.5);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(box.x0, Math.round(Y(0)) + 0.5);
  ctx.lineTo(box.x1, Math.round(Y(0)) + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('n = ∞  0 eV (free electron)', box.x0, Y(0) - 4);
  let lastLabel = Infinity;
  for (let n = 1; n <= settings.maxN; n++) {
    const y = Math.round(Y(energyEV(n))) + 0.5;
    const sel = picking === n || settings.jump?.includes(n);
    ctx.strokeStyle = sel ? th.text : withAlpha(th.text, 0.55);
    ctx.lineWidth = sel ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(box.x0, y);
    ctx.lineTo(box.x1, y);
    ctx.stroke();
    // High levels crowd together below 0 eV; label only those with room.
    if (lastLabel - y >= 13) {
      lastLabel = y;
      ctx.fillStyle = th.text;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`n = ${n}`, box.x0 - 8, y);
      ctx.fillStyle = th.muted;
      ctx.textAlign = 'left';
      ctx.fillText(`${energyEV(n).toFixed(2)}`, box.x1 + 6, y);
    }
  }
  // transitions, grouped by lower level from left to right
  const all = lines();
  const groups = [...new Set(all.map(([, d]) => d))];
  const gw = (box.x1 - box.x0) / Math.max(1, groups.length);
  groups.forEach((d, gi) => {
    const inG = all.filter(([, lo]) => lo === d);
    inG.forEach(([u], k) => {
      const x = box.x0 + gi * gw + ((k + 1) / (inG.length + 1)) * gw;
      const nm = wavelengthNm(u, d);
      const sel = settings.jump && Math.max(...settings.jump) === u && Math.min(...settings.jump) === d;
      arrow(ctx, x, Y(energyEV(u)), Y(energyEV(d)), colorOf(nm, th), sel ? 3 : 1.5, sel ? 1 : 0.55, settings.mode === 'absorption');
    });
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(SERIES[d] ?? '', box.x0 + (gi + 0.5) * gw, Y(energyEV(d)) + 6);
  });
  // a picked jump that is not among the drawn ones
  if (settings.jump) {
    const [a, b] = settings.jump;
    const u = Math.max(a, b);
    const d = Math.min(a, b);
    if (!all.some(([x, y]) => x === u && y === d)) arrow(ctx, box.x1 - 20, Y(energyEV(u)), Y(energyEV(d)), colorOf(wavelengthNm(u, d), th), 3, 1, a < b);
  }
}

function arrow(ctx, x, yFrom, yTo, color, width, alpha, up) {
  const [y0, y1] = up ? [yTo, yFrom] : [yFrom, yTo];
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1 - Math.sign(y1 - y0) * 6);
  ctx.stroke();
  ctx.beginPath();
  const s = Math.sign(y1 - y0);
  ctx.moveTo(x, y1);
  ctx.lineTo(x - 4 - width, y1 - s * 9);
  ctx.lineTo(x + 4 + width, y1 - s * 9);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ----- the photon -----

function drawPhoton(th) {
  const { ctx, w, h } = prep($('photon'));
  if (!settings.jump) {
    ctx.font = FONT;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Click an upper level, then a lower one', w / 2, h / 2);
    return;
  }
  const [a, b] = settings.jump;
  const nm = wavelengthNm(Math.max(a, b), Math.min(a, b));
  // Draw the wave with its wavelength to scale: 700 nm spans this many pixels.
  const pxPerNm = w / 1400;
  const k = (2 * Math.PI) / (nm * pxPerNm);
  const color = colorOf(nm, th);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 1) {
    const env = Math.sin((Math.PI * x) / w) ** 0.6;
    const y = h / 2 - (h * 0.32) * env * Math.sin(k * x);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  // scale bar: 500 nm
  ctx.strokeStyle = th.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(10, h - 8);
  ctx.lineTo(10 + 500 * pxPerNm, h - 8);
  ctx.stroke();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('500 nm', 10, h - 11);
}

// ----- spectrum -----

function drawSpectrum(th) {
  const { ctx, w, h } = prep($('spectrum'));
  const box = { x0: 14, y0: 8, x1: w - 14, y1: h - 40 };
  const [lo, hi] = settings.visibleOnly ? [370, 790] : LAMBDA;
  const X = settings.visibleOnly
    ? (nm) => box.x0 + ((nm - lo) / (hi - lo)) * (box.x1 - box.x0)
    : (nm) => box.x0 + (Math.log(nm / lo) / Math.log(hi / lo)) * (box.x1 - box.x0);
  const absorption = settings.mode === 'absorption';
  // background: dark for emission, a continuum for absorption
  ctx.fillStyle = absorption ? withAlpha(th.muted, 0.35) : '#05060d';
  ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  for (let px = Math.max(box.x0, Math.floor(X(380))); px < Math.min(box.x1, X(780)); px++) {
    // invert X to find the wavelength at this pixel
    const nm = settings.visibleOnly ? lo + ((px - box.x0) / (box.x1 - box.x0)) * (hi - lo) : lo * (hi / lo) ** ((px - box.x0) / (box.x1 - box.x0));
    const c = wavelengthColor(nm);
    if (!c) continue;
    ctx.globalAlpha = absorption ? 1 : 0.14;
    ctx.fillStyle = c;
    ctx.fillRect(px, box.y0, 1.2, box.y1 - box.y0);
  }
  ctx.globalAlpha = 1;
  for (const [u, d] of lines()) {
    const nm = wavelengthNm(u, d);
    if (nm < lo || nm > hi) continue;
    const x = Math.round(X(nm));
    const sel = settings.jump && Math.max(...settings.jump) === u && Math.min(...settings.jump) === d;
    if (absorption) {
      ctx.fillStyle = '#05060d';
      ctx.fillRect(x - (sel ? 2 : 1), box.y0, sel ? 4 : 2.5, box.y1 - box.y0);
    } else {
      const c = colorOf(nm, th);
      ctx.shadowColor = c;
      ctx.shadowBlur = sel ? 14 : 6;
      ctx.fillStyle = c;
      ctx.fillRect(x - (sel ? 2 : 1), box.y0, sel ? 4 : 2.5, box.y1 - box.y0);
      ctx.shadowBlur = 0;
    }
    if (sel) {
      ctx.font = FONT;
      ctx.fillStyle = th.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${nm.toFixed(1)} nm`, Math.min(box.x1 - 30, Math.max(box.x0 + 30, x)), box.y1 + 20);
    }
  }
  // axis
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.strokeStyle = th.axis;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const ticks = settings.visibleOnly ? [400, 450, 500, 550, 600, 650, 700, 750] : [100, 200, 400, 700, 1000, 2000, 4000];
  for (const t of ticks) {
    const x = Math.round(X(t)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, box.y1);
    ctx.lineTo(x, box.y1 + 4);
    ctx.stroke();
    ctx.fillText(String(t), x, box.y1 + 6);
  }
  if (!settings.visibleOnly) {
    ctx.fillStyle = th.muted;
    ctx.textBaseline = 'bottom';
    ctx.fillText('ultraviolet', (X(lo) + X(380)) / 2, box.y1 - 4);
    ctx.fillText('infrared', (X(780) + X(hi)) / 2, box.y1 - 4);
  }
}

function drawTable() {
  const rows = [3, 4, 5, 6]
    .map((u) => {
      const nm = wavelengthNm(u, 2);
      return `<tr><td>H${'αβγδ'[u - 3]} (${u} → 2)</td><td>${nm.toFixed(2)}</td><td>${MEASURED[u].toFixed(2)}</td><td>${(nm - MEASURED[u]).toFixed(2)}</td></tr>`;
    })
    .join('');
  $('table').innerHTML =
    index === 5 || settings.series === 1
      ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Balmer line</th><th>formula (nm)</th><th>measured (nm)</th><th>difference</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="hint" style="margin-top: 8px">Vacuum wavelengths; measured values from the NIST Atomic Spectra Database.</p>`
      : '';
}

function render() {
  const th = theme();
  drawLevels(th);
  drawPhoton(th);
  drawSpectrum(th);
  drawTable();
  $('spectrum-title').textContent = settings.mode === 'absorption' ? 'Spectrum: white light after passing through hydrogen' : 'Spectrum: light from glowing hydrogen';
  if (settings.jump) {
    const [a, b] = settings.jump;
    const u = Math.max(a, b);
    const d = Math.min(a, b);
    const nm = wavelengthNm(u, d);
    const dE = energyEV(u) - energyEV(d);
    $('jump-title').textContent = a > b ? `Emitted: n = ${a} → ${b}` : `Absorbed: n = ${a} → ${b}`;
    $('jump-legend').textContent = `${region(nm)}, drawn to scale`;
    $('facts').innerHTML = `
      <dt>Energy E<sub>${u}</sub> − E<sub>${d}</sub></dt><dd><b>${dE.toFixed(3)} eV</b></dd>
      <dt>Wavelength λ = hc/E</dt><dd><b>${nm.toFixed(1)} nm</b> (${region(nm)})</dd>
      <dt>Series</dt><dd>${SERIES[d] ?? `ending on n = ${d}`}</dd>
      <dt>Check: hc / ΔE</dt><dd>${(HC_EV_NM / dE).toFixed(1)} nm</dd>`;
  } else {
    $('jump-title').textContent = 'The photon';
    $('jump-legend').textContent = '';
    $('facts').innerHTML = '';
  }
  const ctx = { ...settings };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

// ----- controls -----

function syncControls() {
  $('series').value = String(settings.series);
  $('maxN').value = String(settings.maxN);
  $('maxN-out').textContent = String(settings.maxN);
  $('mode').value = settings.mode;
  $('visibleOnly').checked = settings.visibleOnly;
}

$('levels').addEventListener('click', (e) => {
  const r = $('levels').getBoundingClientRect();
  const { Y } = levelLayout(r.width, r.height);
  const y = e.clientY - r.top;
  let best = null;
  for (let n = 1; n <= settings.maxN; n++) {
    const d = Math.abs(Y(energyEV(n)) - y);
    if (d < 12 && (!best || d < best[1])) best = [n, d];
  }
  if (!best) return;
  const n = best[0];
  if (picking === null || picking === n) {
    picking = picking === n ? null : n;
  } else {
    settings.jump = [picking, n];
    settings.mode = picking > n ? 'emission' : 'absorption';
    picking = null;
    syncControls();
  }
  render();
});
for (const k of ['series', 'maxN']) {
  $(k).addEventListener('input', () => {
    settings[k] = Number($(k).value);
    if (settings.jump && Math.max(...settings.jump) > settings.maxN) settings.jump = null;
    syncControls();
    render();
  });
}
$('mode').addEventListener('change', () => {
  settings.mode = $('mode').value;
  if (settings.jump) {
    const [a, b] = settings.jump;
    const up = settings.mode === 'absorption';
    settings.jump = up ? [Math.min(a, b), Math.max(a, b)] : [Math.max(a, b), Math.min(a, b)];
  }
  render();
});
$('visibleOnly').addEventListener('change', () => {
  settings.visibleOnly = $('visibleOnly').checked;
  render();
});

const lesson = mountLesson({ slug: 'atomic-spectra', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  Object.assign(settings, STEPS[i].preset);
  settings.jump = STEPS[i].preset.jump ? [...STEPS[i].preset.jump] : null;
  picking = null;
  syncControls();
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  render();
}

window.addEventListener('themechange', render);
new ResizeObserver(() => render()).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
