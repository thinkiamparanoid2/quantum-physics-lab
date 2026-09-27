import { seededRandom } from '../lib/circuit.js';
import { wavelengthColor } from '../lib/hydrogen.js';
import { electronWavelengthNm, slitIntensity, slitSampler } from '../lib/optics.js';
import { withAlpha } from '../ui/bloch.js';
import { MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { mountLesson } from '../ui/lesson.js';

// Particles through two slits, landing one at a time on a far screen. Hits are drawn from the
// far-field (Fraunhofer) pattern in lib/optics.js. The top view is a schematic of the waves
// leaving the slits (not to scale: real slits are hundreds of wavelengths apart).

const SOURCES = {
  light: { name: 'Light (photons)', L: 1, unit: 'mm', scale: 1e3 },
  electrons: { name: 'Electrons', L: 0.35, unit: 'µm', scale: 1e6 },
};

const STEPS = [
  {
    title: 'Waves through two slits',
    preset: { source: 'light', nm: 550, d: 0.25, a: 0.05, open: 'both', marked: 0, fire: 3000 },
    html: `<p>Light passes two narrow slits and lands on a screen. From each slit a wave spreads out (top view). Where crests meet crests the waves add: <b>bright fringes</b>. Where crests meet troughs they cancel: <b>dark fringes</b>.</p>
      <p>Thomas Young showed this in 1801, and for a century it settled the matter: light is a wave.</p>`,
  },
  {
    title: 'One photon at a time',
    preset: { source: 'light', nm: 550, d: 0.25, a: 0.05, open: 'both', marked: 0, stream: true },
    html: `<p>Now make the light so dim that only one photon is in the apparatus at a time. Each photon lands as <b>one dot</b>, at a random spot, like a particle.</p>
      <p>Wait, or press <b>1000 at once</b>: the dots pile up into the same fringes. Every single photon follows the wave pattern for where it may land, yet it lands whole in one place.</p>`,
  },
  {
    title: 'Electrons do it too',
    preset: { source: 'electrons', kv: 50, d: 2, a: 0.5, open: 'both', marked: 0, stream: true },
    html: ({ lambdaPm }) => `<p>Switch to electrons: definitely particles, with mass and charge. Accelerated through 50 kV they have a de Broglie wavelength λ = h/p = ${lambdaPm.toFixed(2)} pm.</p>
      <p>Through slits 2 µm apart they form exactly the same kind of fringes. Jönsson did this in 1961; in 1989 Tonomura's team filmed it one electron at a time, and it looks just like this screen.</p>`,
  },
  {
    title: 'Close one slit',
    preset: { source: 'electrons', kv: 50, d: 2, a: 0.5, open: 'left', marked: 0, fire: 3000 },
    html: `<p>With one slit, the fringes disappear: a single broad bump. Now compare the dashed curve (two slits) with this one.</p>
      <p>At the dark fringes, <b>opening a second slit makes fewer electrons arrive</b>. More ways to get there, and yet fewer arrivals: no particle picture can do that. Amplitudes, not probabilities, add.</p>`,
  },
  {
    title: 'Which slit did it go through?',
    preset: { source: 'electrons', kv: 50, d: 2, a: 0.5, open: 'both', marked: 1, fire: 3000 },
    html: `<p>Put a detector at the slits that records which one each electron passes. The fringes <b>vanish</b>: the pattern becomes the plain sum of the two one-slit patterns.</p>
      <p>It doesn't matter whether anyone reads the detector. Once the path is recorded anywhere, the two paths can no longer interfere.</p>`,
  },
  {
    title: 'Half a look',
    preset: { source: 'electrons', kv: 50, d: 2, a: 0.5, open: 'both', marked: 0.5, fire: 3000 },
    html: ({ marked }) => `<p>A detector that only sometimes tells the slits apart gives <b>faded fringes</b>: here the contrast is ${Math.round((1 - marked) * 100)}% of the full value.</p>
      <p>The more you know about the path, the less interference you get. This trade-off is Bohr's <b>complementarity</b>, and you can slide it continuously with <b>Detector</b>.</p>`,
  },
  {
    title: 'Fringe spacing λL/d',
    preset: { source: 'light', nm: 650, d: 0.15, a: 0.05, open: 'both', marked: 0, fire: 3000 },
    html: ({ spacing, unit }) => `<p>The fringes are λL/d apart: ${spacing.toFixed(2)} ${unit} here. Longer wavelength or closer slits spread them out. Change <b>Wavelength</b> and <b>Slit separation</b> and watch.</p>
      <p>Measuring the spacing is how you measure a wavelength, for light or for electrons.</p>`,
  },
  {
    title: 'Your turn',
    preset: { source: 'light', nm: 450, d: 0.3, a: 0.04, open: 'both', marked: 0 },
    html: `<p>Molecules interfere too: in 1999 Arndt and Zeilinger sent C₆₀ "buckyballs" (60 carbon atoms) through a grating and saw fringes. So far no one has found a size limit.</p>
      <p>Try making the slits wider than their separation allows, or firing electrons with and without the detector.</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<figure class="panel card">
    <figcaption class="card-head"><h2>Top view</h2><span class="legend" id="top-legend">colour = phase of the wave; schematic, not to scale</span></figcaption>
    <canvas id="top" class="chart" style="height: 250px" role="img" aria-label="Waves spreading from two slits"></canvas>
  </figure>
  <div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2>The screen</h2><span class="legend" id="hit-count">0 hits</span></figcaption>
      <canvas id="screen" class="chart" style="height: 260px" role="img" aria-label="Particle hits on the screen"></canvas>
      <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px">
        <button id="fire1" class="btn" type="button">Fire 1</button>
        <button id="fire1000" class="btn btn-primary" type="button">1000 at once</button>
        <button id="stream" class="btn" type="button" aria-pressed="false">Stream</button>
        <button id="clear" class="btn" type="button">Clear</button>
      </div>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>Where they land</h2><span class="legend">bars = hits; line = prediction; dashed = two open slits, no detector</span></figcaption>
      <canvas id="hist" class="chart" style="height: 300px" role="img" aria-label="Histogram of hits with the predicted pattern"></canvas>
    </figure>
  </div>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">Send</span>
      <select id="source"><option value="light">Light (photons)</option><option value="electrons">Electrons</option></select></label>
    <div data-for="light" style="margin-top: 14px">
      <label class="field"><span class="label">Wavelength <output id="nm-out"></output></span><input id="nm" type="range" min="400" max="700" step="5"></label>
      <label class="field"><span class="label">Slit separation d <output id="d-light-out"></output></span><input id="d-light" type="range" min="0.1" max="0.6" step="0.01"></label>
      <label class="field"><span class="label">Slit width a <output id="a-light-out"></output></span><input id="a-light" type="range" min="0.02" max="0.1" step="0.005"></label>
    </div>
    <div data-for="electrons" style="margin-top: 14px">
      <label class="field"><span class="label">Accelerating voltage <output id="kv-out"></output></span><input id="kv" type="range" min="10" max="100" step="1"></label>
      <label class="field"><span class="label">Slit separation d <output id="d-electrons-out"></output></span><input id="d-electrons" type="range" min="1" max="4" step="0.05"></label>
      <label class="field"><span class="label">Slit width a <output id="a-electrons-out"></output></span><input id="a-electrons" type="range" min="0.2" max="1" step="0.02"></label>
    </div>
    <label class="field"><span class="label">Open slits</span>
      <select id="open"><option value="both">Both</option><option value="left">Only the left</option><option value="right">Only the right</option></select></label>
    <label class="field"><span class="label">Which-path detector <output id="marked-out"></output></span>
      <input id="marked" type="range" min="0" max="1" step="0.05"></label>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { source: 'light', nm: 550, kv: 50, d: 0.25, a: 0.05, open: 'both', marked: 0 };
// separate geometry per source, in mm (light) or µm (electrons)
const geom = { light: { d: 0.25, a: 0.05 }, electrons: { d: 2, a: 0.5 } };
let index = 0;
let hits = [];
let sample = null;
let params = null;
let half = 1;
let rng = seededRandom(1801);
let streaming = false;
let field = null;
let lastSpawn = 0;

// Physical parameters in metres.
function physics() {
  const src = SOURCES[settings.source];
  const g = geom[settings.source];
  const lambda = settings.source === 'light' ? settings.nm * 1e-9 : electronWavelengthNm(settings.kv * 1e3) * 1e-9;
  const toM = settings.source === 'light' ? 1e-3 : 1e-6;
  return { lambda, d: g.d * toM, a: g.a * toM, L: src.L, open: settings.open, marked: settings.open === 'both' ? settings.marked : 0 };
}

function rebuild() {
  params = physics();
  half = 1.15 * ((params.lambda * params.L) / params.a);
  sample = slitSampler(params, half);
  field = null;
}

function fire(n) {
  for (let i = 0; i < n; i++) hits.push([sample(rng), rng()]);
  if (hits.length > 30000) hits = hits.slice(-30000);
}

// ----- top view -----

// RGB for the site's phase colour wheel (hue 187 + phase in degrees, as ui/dials.js), one entry
// per degree, so each pixel is a table lookup.
function phaseTable() {
  const light = document.documentElement.dataset.theme === 'light';
  const S = 0.85;
  const Lt = light ? 0.45 : 0.62;
  return Array.from({ length: 360 }, (_, deg) => {
    const h = (((187 + deg) % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * Lt - 1)) * S;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = Lt - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  });
}

function buildField(w, h) {
  const cell = 3;
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  const lam = 13; // wavelength in cells
  const k = (2 * Math.PI) / lam;
  const g = geom[settings.source];
  const base = settings.source === 'light' ? { d: 0.25, a: 0.05 } : { d: 2, a: 0.5 };
  const dCells = Math.max(3, 5 * lam * (g.d / base.d) * 0.5);
  const aCells = Math.max(1, 1.1 * lam * (g.a / base.a) * 0.5);
  const wallX = Math.floor(cols * 0.22);
  const cy = rows / 2;
  const slits = [];
  if (settings.open !== 'right') slits.push(cy - dCells / 2);
  if (settings.open !== 'left') slits.push(cy + dCells / 2);
  const re = [new Float32Array(cols * rows), new Float32Array(cols * rows)];
  const im = [new Float32Array(cols * rows), new Float32Array(cols * rows)];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const idx = j * cols + i;
      if (i < wallX) {
        re[0][idx] = Math.cos(k * (i - wallX));
        im[0][idx] = Math.sin(k * (i - wallX));
        continue;
      }
      slits.forEach((sy, s) => {
        for (let p = -2; p <= 2; p++) {
          const y0 = sy + (p / 2) * (aCells / 2);
          const r = Math.hypot(i - wallX, j - y0) + 0.5;
          const amp = 0.45 / Math.sqrt(r) / 5;
          re[s][idx] += amp * Math.cos(k * r);
          im[s][idx] += amp * Math.sin(k * r);
        }
      });
    }
  }
  field = { cell, cols, rows, re, im, wallX, slits, aCells, count: slits.length };
}

function drawTop(th, now) {
  const { ctx, w, h } = prep($('top'));
  if (!field || field.w !== w || field.h !== h) {
    buildField(w, h);
    field.w = w;
    field.h = h;
  }
  const { cell, cols, rows, re, im, wallX } = field;
  const img = ctx.createImageData(cols, rows);
  const wt = -(now / 1000) * 4; // e^{-i omega t}
  const c = Math.cos(wt);
  const s = Math.sin(wt);
  const marked = settings.open === 'both' ? settings.marked : 0;
  const table = phaseTable();
  for (let idx = 0; idx < cols * rows; idx++) {
    const i = idx % cols;
    let r0;
    let i0;
    let bright;
    if (i < wallX || field.count === 1) {
      r0 = re[0][idx] + re[1][idx];
      i0 = im[0][idx] + im[1][idx];
      bright = Math.hypot(r0, i0);
    } else {
      // coherent sum, faded toward the incoherent sum as the path gets marked
      r0 = re[0][idx] + re[1][idx];
      i0 = im[0][idx] + im[1][idx];
      const coh = r0 * r0 + i0 * i0;
      const inc = re[0][idx] ** 2 + im[0][idx] ** 2 + re[1][idx] ** 2 + im[1][idx] ** 2;
      bright = Math.sqrt((1 - marked) * coh + marked * inc);
    }
    const ph = Math.atan2(i0 * c + r0 * s, r0 * c - i0 * s);
    const [R, G, B] = table[((Math.round((ph * 180) / Math.PI) % 360) + 360) % 360];
    const a = i < wallX ? 0.4 * Math.min(1, bright) : Math.min(1, (bright * 2.2) ** 0.75);
    img.data[4 * idx] = R;
    img.data[4 * idx + 1] = G;
    img.data[4 * idx + 2] = B;
    img.data[4 * idx + 3] = Math.round(255 * a);
  }
  const off = document.createElement('canvas');
  off.width = cols;
  off.height = rows;
  off.getContext('2d').putImageData(img, 0, 0);
  // a dark backdrop, like the screen, so the interference reads in both themes
  ctx.fillStyle = '#05060d';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, cols * cell, rows * cell);
  // the wall with its slits
  ctx.fillStyle = th.axis;
  const wx = wallX * cell;
  const holes = field.slits.map((sy) => [(sy - field.aCells / 2) * cell, (sy + field.aCells / 2) * cell]).sort((p, q) => p[0] - q[0]);
  let y = 0;
  for (const [a, b] of holes) {
    ctx.fillRect(wx - 2, y, 5, a - y);
    y = b;
  }
  ctx.fillRect(wx - 2, y, 5, h - y);
  // closed slit shown as a shutter
  if (settings.open !== 'both') {
    const cy = rows / 2;
    const dC = field.slits.length ? Math.abs(field.slits[0] - cy) : 0;
    const shut = settings.open === 'left' ? cy + dC : cy - dC;
    ctx.fillStyle = th.ampNeg;
    ctx.fillRect(wx - 4, (shut - field.aCells) * cell, 9, 2 * field.aCells * cell);
  }
  if (marked > 0 && settings.open === 'both') {
    ctx.font = MONO;
    ctx.fillStyle = th.marked;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`which-path detector: ${Math.round(marked * 100)}%`, wx + 10, 8);
    for (const sy of field.slits) {
      ctx.strokeStyle = th.marked;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx + 10, sy * cell, 6, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }
  // the screen edge
  ctx.fillStyle = withAlpha(th.muted, 0.5);
  ctx.fillRect(w - 6, 0, 6, h);
}

// ----- screen and histogram -----

function dotColor(th) {
  return settings.source === 'light' ? wavelengthColor(settings.nm) ?? th.accent2 : th.accent2;
}

function drawScreen(th) {
  const { ctx, w, h } = prep($('screen'));
  ctx.fillStyle = '#05060d';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = dotColor(th);
  const r = hits.length > 5000 ? 1 : 1.6;
  for (const [x, y] of hits) {
    ctx.globalAlpha = hits.length > 8000 ? 0.5 : 0.85;
    ctx.fillRect(((x + half) / (2 * half)) * w - r / 2, y * h - r / 2, r, r);
  }
  ctx.globalAlpha = 1;
  $('hit-count').textContent = `${hits.length.toLocaleString()} hit${hits.length === 1 ? '' : 's'}`;
}

function drawHist(th) {
  const { ctx, w, h } = prep($('hist'));
  const box = { x0: 44, y0: 12, x1: w - 14, y1: h - 30 };
  const src = SOURCES[settings.source];
  const bins = 90;
  const counts = new Array(bins).fill(0);
  for (const [x] of hits) {
    const b = Math.floor(((x + half) / (2 * half)) * bins);
    if (b >= 0 && b < bins) counts[b]++;
  }
  // predicted counts per bin, from the intensity
  const pred = (p) => {
    const vals = Array.from({ length: 600 }, (_, i) => slitIntensity(-half + ((i + 0.5) / 600) * 2 * half, p));
    const total = vals.reduce((s, v) => s + v, 0);
    return vals.map((v) => (v / total) * hits.length * (600 / bins));
  };
  const cur = pred(params);
  const both = pred({ ...params, open: 'both', marked: 0 });
  const yMax = Math.max(4, ...counts, ...cur) * 1.1;
  const Y = yAxis(ctx, box, [0, yMax], th);
  const X = xAxis(ctx, box, [-half * src.scale, half * src.scale], th);
  const bw = (box.x1 - box.x0) / bins;
  ctx.fillStyle = withAlpha(th.exact, 0.55);
  counts.forEach((c, i) => ctx.fillRect(box.x0 + i * bw + 0.5, Y(c), bw - 1, box.y1 - Y(c)));
  const line = (vals, color, dash, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    vals.forEach((v, i) => {
      const x = box.x0 + ((i + 0.5) / vals.length) * (box.x1 - box.x0);
      if (i === 0) ctx.moveTo(x, Y(v));
      else ctx.lineTo(x, Y(v));
    });
    ctx.stroke();
    ctx.setLineDash([]);
  };
  if (hits.length) {
    if (settings.open !== 'both' || settings.marked > 0) line(both, withAlpha(th.muted, 0.8), [4, 4], 1.25);
    line(cur, th.marked, [], 2);
  }
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`position on the screen (${src.unit})`, (box.x0 + box.x1) / 2, h);
}

function frame(now) {
  const th = theme();
  if (streaming && now - lastSpawn > 40) {
    fire(1);
    lastSpawn = now;
    drawScreen(th);
    drawHist(th);
  }
  drawTop(th, now);
  requestAnimationFrame(frame);
}

function render() {
  const th = theme();
  drawScreen(th);
  drawHist(th);
  drawTop(th, performance.now());
  const src = SOURCES[settings.source];
  const ctx = {
    ...settings,
    lambdaPm: electronWavelengthNm(settings.kv * 1e3) * 1e3,
    spacing: ((params.lambda * params.L) / params.d) * src.scale,
    unit: src.unit,
  };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

// ----- controls -----

function syncControls() {
  $('source').value = settings.source;
  $('nm').value = String(settings.nm);
  $('nm-out').textContent = `${settings.nm} nm`;
  $('kv').value = String(settings.kv);
  $('kv-out').textContent = `${settings.kv} kV (λ = ${(electronWavelengthNm(settings.kv * 1e3) * 1e3).toFixed(2)} pm)`;
  for (const s of ['light', 'electrons']) {
    const unit = SOURCES[s].unit;
    for (const k of ['d', 'a']) {
      $(`${k}-${s}`).value = String(geom[s][k]);
      $(`${k}-${s}-out`).textContent = `${geom[s][k]} ${unit}`;
    }
  }
  $('open').value = settings.open;
  $('marked').value = String(settings.marked);
  $('marked-out').textContent = settings.marked === 0 ? 'off' : `${Math.round(settings.marked * 100)}%`;
  $('marked').disabled = settings.open !== 'both';
  document.querySelectorAll('[data-for]').forEach((el) => (el.hidden = el.dataset.for !== settings.source));
}

function changed({ keepHits = false } = {}) {
  syncControls();
  rebuild();
  if (!keepHits) hits = [];
  render();
}

$('source').addEventListener('change', () => {
  settings.source = $('source').value;
  changed();
});
$('nm').addEventListener('input', () => {
  settings.nm = Number($('nm').value);
  changed();
});
$('kv').addEventListener('input', () => {
  settings.kv = Number($('kv').value);
  changed();
});
for (const s of ['light', 'electrons']) {
  for (const k of ['d', 'a']) {
    $(`${k}-${s}`).addEventListener('input', () => {
      geom[s][k] = Number($(`${k}-${s}`).value);
      changed();
    });
  }
}
$('open').addEventListener('change', () => {
  settings.open = $('open').value;
  changed();
});
$('marked').addEventListener('input', () => {
  settings.marked = Number($('marked').value);
  changed();
});
$('fire1').addEventListener('click', () => {
  fire(1);
  render();
});
$('fire1000').addEventListener('click', () => {
  fire(1000);
  render();
});
$('stream').addEventListener('click', () => setStreaming(!streaming));
$('clear').addEventListener('click', () => {
  hits = [];
  render();
});

function setStreaming(on) {
  streaming = on;
  $('stream').setAttribute('aria-pressed', String(on));
  $('stream').textContent = on ? 'Stop' : 'Stream';
}

const lesson = mountLesson({ slug: 'double-slit', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  const { fire: n, stream, d, a, ...pre } = STEPS[i].preset;
  Object.assign(settings, { kv: 50, nm: 550 }, pre);
  if (d !== undefined) geom[settings.source] = { d, a };
  rng = seededRandom(1801 + i);
  syncControls();
  rebuild();
  hits = [];
  if (n) fire(n);
  setStreaming(!!stream);
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  render();
}

window.addEventListener('themechange', render);
new ResizeObserver(() => {
  field = null;
  render();
}).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
requestAnimationFrame(frame);
