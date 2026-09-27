import { wavelengthColor } from '../lib/hydrogen.js';
import { H_OVER_E, METALS, collectorCurrent, fitLine, frequencyHz, maxKinetic, photonEnergy, thresholdNm } from '../lib/optics.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { mountLesson } from '../ui/lesson.js';

// Light on a metal plate in a vacuum tube. Photons arrive at a rate set by the intensity; each
// one with hf > phi frees one electron (a fraction EJECT of the time, for a calmer picture)
// with kinetic energy spread evenly up to hf - phi. A voltage between the plates speeds the
// electrons up or turns them back. The curves use the same model (lib/optics.js).

const H = 6.62607015e-34;
const EJECT = 0.8;
const PHOTON_RATE = 70; // photons per second at 100% intensity
const V_RANGE = [-4, 3];

const STEPS = [
  {
    title: 'Light knocks electrons out',
    preset: { metal: 'sodium', nm: 400, intensity: 50, volts: 0 },
    html: `<p>Violet light shines on a sodium plate inside a vacuum tube. Electrons fly off the plate and across to the other plate, and a current flows round the circuit.</p>
      <p>This is the <b>photoelectric effect</b>, discovered by Hertz in 1887. Light carries energy, and some of it goes into freeing electrons.</p>`,
  },
  {
    title: 'The wave picture predicts…',
    preset: { metal: 'sodium', nm: 650, intensity: 100, volts: 0 },
    html: `<p>If light is a wave, brighter light shakes the electrons harder, so any colour should work if it is bright enough. Here is red light at full brightness.</p>
      <p><b>Nothing.</b> Not one electron, however bright the light or however long you wait. Slide the brightness: still nothing.</p>`,
  },
  {
    title: 'Light comes in lumps',
    preset: { metal: 'sodium', nm: 540, intensity: 60, volts: 0 },
    html: ({ threshold }) => `<p>Einstein's answer (1905): light arrives in <b>photons</b>, each with energy E = hf. One photon frees at most one electron, and only if its energy beats the metal's grip, the <b>work function</b> φ.</p>
      <p>For sodium that means wavelengths shorter than ${threshold.toFixed(0)} nm. Slide the <b>Wavelength</b> slowly across it and watch the electrons switch on.</p>`,
  },
  {
    title: 'Brighter means more, not faster',
    preset: { metal: 'sodium', nm: 400, intensity: 100, volts: 0 },
    html: `<p>Turn the brightness down. Fewer photons arrive, so fewer electrons come out and the current falls, but each electron leaves just as fast: its energy depends only on the colour.</p>
      <p>The flat top of the <b>current–voltage</b> curve scales with brightness; where it starts doesn't move.</p>`,
  },
  {
    title: 'Stop them with a voltage',
    preset: { metal: 'sodium', nm: 400, intensity: 80, volts: -0.6 },
    html: ({ kmax }) => `<p>Make the far plate negative. Electrons now have to climb uphill; slow ones turn back. At the <b>stopping voltage</b> even the fastest are turned back and the current is zero.</p>
      <p>Here that is ${kmax.toFixed(2)} V: the fastest electrons have K<sub>max</sub> = hf − φ = ${kmax.toFixed(2)} eV. Drag <b>Voltage</b> to find it.</p>`,
  },
  {
    title: "Measure Planck's constant",
    preset: { metal: 'sodium', nm: 300, intensity: 70, volts: -1, record: [450, 400, 350, 300] },
    html: ({ fit }) => `<p>Measure the stopping voltage for several colours and plot it against frequency: a straight line, V = (h/e) f − φ/e. Its slope gives Planck's constant.</p>
      <p>${
        fit ? `From these points: <b>h = ${sci(fit.h)} J s</b>, ${Math.abs(fit.err) < 0.05 ? 'within 0.05%' : `${fit.err.toFixed(2)}% off`} the true value. ` : ''
      }Millikan did this in 1916 hoping to prove Einstein wrong, and confirmed him. Pick a wavelength and press <b>Record</b> to add your own points.</p>`,
  },
  {
    title: 'Other metals, same h',
    preset: { metal: 'zinc', nm: 250, intensity: 70, volts: 0, record: [280, 250, 220, 200] },
    html: ({ threshold }) => `<p>Zinc holds its electrons more tightly (φ = 4.33 eV), so it needs ultraviolet light shorter than ${threshold.toFixed(0)} nm. Its line in the plot is shifted, but its <b>slope is the same</b>.</p>
      <p>That slope is h/e, a constant of nature, the same for every metal. Einstein's Nobel Prize (1921) was for this, not for relativity.</p>`,
  },
  {
    title: 'Your turn',
    preset: { metal: 'cesium', nm: 600, intensity: 60, volts: 0 },
    html: `<p>Cesium has the smallest work function here. Which is the reddest light that still frees electrons from it? Record points for two metals and compare their lines.</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<figure class="panel card">
    <figcaption class="card-head"><h2>The apparatus</h2><span class="legend">photons from the lamp; electrons in white</span></figcaption>
    <canvas id="tube" class="chart tall" role="img" aria-label="Light falling on a metal plate in a vacuum tube, with electrons flying across"></canvas>
    <dl class="facts" id="facts"></dl>
  </figure>
  <div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2>Current against voltage</h2><span class="legend">dot = now</span></figcaption>
      <canvas id="iv" class="chart" style="height: 280px" role="img" aria-label="Current against voltage"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>Stopping voltage against frequency</h2><button id="record" class="btn" type="button">Record</button></figcaption>
      <canvas id="millikan" class="chart" style="height: 280px" role="img" aria-label="Recorded stopping voltages against light frequency with a fitted line"></canvas>
    </figure>
  </div>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">Metal plate</span>
      <select id="metal">${Object.entries(METALS)
        .map(([k, m]) => `<option value="${k}">${m.name} (φ = ${m.phi} eV)</option>`)
        .join('')}</select></label>
    <label class="field"><span class="label">Wavelength <output id="nm-out"></output></span>
      <input id="nm" type="range" min="150" max="850" step="1"></label>
    <label class="field"><span class="label">Brightness <output id="intensity-out"></output></span>
      <input id="intensity" type="range" min="0" max="100" step="1"></label>
    <label class="field"><span class="label">Voltage on the far plate <output id="volts-out"></output></span>
      <input id="volts" type="range" min="${V_RANGE[0]}" max="${V_RANGE[1]}" step="0.01"></label>
    <button id="clear" class="btn" type="button" style="margin-top: 14px">Clear recorded points</button>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { metal: 'sodium', nm: 400, intensity: 50, volts: 0 };
let index = 0;
let points = []; // recorded { f, v, metal }
let photons = [];
let electrons = [];
let arrivals = []; // collector arrival times, for the ammeter
let lastT = null;
let spawnDebt = 0;

const phi = () => METALS[settings.metal].phi;
// 6.626e-34 -> 6.626 × 10⁻³⁴
const sci = (v) => {
  const [m, e] = v.toExponential(3).split('e');
  return `${m} × 10${[...String(Number(e))].map((c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'[c === '-' ? 0 : Number(c) + 1]).join('')}`;
};
const lightColor = (th) => wavelengthColor(settings.nm) ?? (settings.nm < 380 ? withAlpha(th.accent, 0.95) : withAlpha(th.ampNeg, 0.8));

function record(nm = settings.nm) {
  const K = maxKinetic(nm, phi());
  if (K <= 0) return false;
  points.push({ f: frequencyHz(nm), v: K, metal: settings.metal });
  return true;
}

function fitFor(metal) {
  const pts = points.filter((p) => p.metal === metal).map((p) => [p.f, p.v]);
  if (pts.length < 2) return null;
  const { slope, intercept } = fitLine(pts);
  const h = slope * 1.602176634e-19;
  return { slope, intercept, h, err: ((h - H) / H) * 100 };
}

// ----- animation -----

function geometry(w, h) {
  return { left: 110, right: w - 110, top: 90, bottom: h - 90, lamp: [Math.min(w * 0.36, 420), 26] };
}

function step(now) {
  const dt = lastT === null ? 0 : Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const r = $('tube').getBoundingClientRect();
  const G = geometry(r.width, r.height);
  // new photons
  spawnDebt += dt * PHOTON_RATE * (settings.intensity / 100);
  while (spawnDebt >= 1) {
    spawnDebt -= 1;
    photons.push({ t: 0, y: G.top + 20 + Math.random() * (G.bottom - G.top - 40) });
  }
  const K = maxKinetic(settings.nm, phi());
  const survivors = [];
  for (const p of photons) {
    p.t += dt / 0.45;
    if (p.t < 1) survivors.push(p);
    else if (K > 0 && Math.random() < EJECT) electrons.push({ s: 0.003, dir: 1, K: Math.random() * K, y: p.y });
  }
  photons = survivors;
  const V = settings.volts;
  const still = [];
  for (const e of electrons) {
    const kin = e.K + V * e.s;
    if (kin <= 0.001 && e.dir > 0) e.dir = -1;
    e.s += e.dir * dt * (0.25 + 1.1 * Math.sqrt(Math.max(0, e.K + V * e.s)));
    if (e.s >= 1) arrivals.push(now);
    else if (e.s > 0) still.push(e);
  }
  electrons = still.slice(-400);
  arrivals = arrivals.filter((t) => now - t < 2000);
  drawTube(theme(), G);
  requestAnimationFrame(step);
}

function drawTube(th, G) {
  const { ctx, w, h } = prep($('tube'));
  // glass tube
  ctx.strokeStyle = withAlpha(th.muted, 0.6);
  ctx.lineWidth = 1.5;
  ctx.fillStyle = withAlpha(th.accent, 0.04);
  ctx.beginPath();
  ctx.roundRect(G.left - 40, G.top - 20, G.right - G.left + 80, G.bottom - G.top + 40, 40);
  ctx.fill();
  ctx.stroke();
  // plates
  ctx.fillStyle = th.axis;
  ctx.fillRect(G.left - 10, G.top, 10, G.bottom - G.top);
  ctx.fillRect(G.right, G.top, 10, G.bottom - G.top);
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(METALS[settings.metal].name, G.left - 5, G.bottom + 26);
  ctx.fillText('collector', G.right + 5, G.bottom + 26);
  // lamp and beam
  const col = lightColor(th);
  const [lx, ly] = G.lamp;
  ctx.fillStyle = withAlpha(col, 0.08 + 0.18 * (settings.intensity / 100));
  ctx.beginPath();
  ctx.moveTo(lx - 10, ly);
  ctx.lineTo(lx + 10, ly);
  ctx.lineTo(G.left, G.bottom - 20);
  ctx.lineTo(G.left, G.top + 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(lx, ly, 10, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = th.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${settings.nm} nm${settings.nm < 380 ? ' (ultraviolet)' : settings.nm > 780 ? ' (infrared)' : ''}`, lx + 18, ly);
  // photons as short wavy dashes
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  for (const p of photons) {
    const x = lx + (G.left - lx) * p.t;
    const y = ly + (p.y - ly) * p.t;
    ctx.beginPath();
    for (let k = -6; k <= 6; k++) {
      const u = k / 6;
      const px = x + u * 7;
      const py = y + u * 7 * ((p.y - ly) / (G.left - lx)) + Math.sin(u * Math.PI * 2) * 2.5;
      if (k === -6) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  // electrons
  ctx.fillStyle = th.text;
  for (const e of electrons) {
    ctx.beginPath();
    ctx.arc(G.left + e.s * (G.right - G.left), e.y, 3, 0, 2 * Math.PI);
    ctx.fill();
  }
  // circuit and meters
  const cy = G.bottom + 58;
  ctx.strokeStyle = withAlpha(th.muted, 0.8);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(G.left - 5, G.bottom);
  ctx.lineTo(G.left - 5, G.bottom + 14);
  ctx.moveTo(G.right + 5, G.bottom);
  ctx.lineTo(G.right + 5, G.bottom + 14);
  ctx.stroke();
  const current = collectorCurrent({ nm: settings.nm, phi: phi(), intensity: settings.intensity / 100, volts: settings.volts });
  ctx.font = MONO;
  ctx.fillStyle = th.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`voltage ${settings.volts >= 0 ? '+' : ''}${settings.volts.toFixed(2)} V      current ${(current * 100).toFixed(1)}   (${(arrivals.length / 2).toFixed(0)} electrons/s arriving)`, w / 2, Math.min(h - 10, cy));
}

// ----- charts -----

function drawIV(th) {
  const { ctx, w, h } = prep($('iv'));
  const box = { x0: 48, y0: 14, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, 105], th);
  const X = xAxis(ctx, box, V_RANGE, th);
  const curve = (intensity, color, dash, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i <= 400; i++) {
      const V = V_RANGE[0] + (i / 400) * (V_RANGE[1] - V_RANGE[0]);
      const I = 100 * collectorCurrent({ nm: settings.nm, phi: phi(), intensity, volts: V });
      if (i === 0) ctx.moveTo(X(V), Y(I));
      else ctx.lineTo(X(V), Y(I));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  curve(1, withAlpha(th.muted, 0.55), [4, 4], 1.25);
  curve(settings.intensity / 100, lightColor(th), [], 2.5);
  const I = 100 * collectorCurrent({ nm: settings.nm, phi: phi(), intensity: settings.intensity / 100, volts: settings.volts });
  ctx.fillStyle = th.marked;
  ctx.beginPath();
  ctx.arc(X(settings.volts), Y(I), 6, 0, 2 * Math.PI);
  ctx.fill();
  const K = maxKinetic(settings.nm, phi());
  if (K > 0 && -K > V_RANGE[0]) {
    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`stops at −${K.toFixed(2)} V`, X(-K) - 4, Y(0) - 4);
  }
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('voltage (V)', (box.x0 + box.x1) / 2, h);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('current (dashed: full brightness)', box.x0 + 4, box.y0);
}

function drawMillikan(th) {
  const { ctx, w, h } = prep($('millikan'));
  const box = { x0: 48, y0: 14, x1: w - 14, y1: h - 30 };
  const fMax = 16; // 10^14 Hz
  const Y = yAxis(ctx, box, [0, 5], th);
  const X = xAxis(ctx, box, [0, fMax], th);
  const colors = [th.ampPos, th.marked, th.accent, th.ampNeg, th.accent2, th.exact, th.text];
  const metals = Object.keys(METALS);
  for (const metal of new Set(points.map((p) => p.metal))) {
    const color = colors[metals.indexOf(metal) % colors.length];
    const fit = fitFor(metal);
    if (fit) {
      ctx.strokeStyle = withAlpha(color, 0.8);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      const f0 = -fit.intercept / fit.slope;
      ctx.moveTo(X(f0 / 1e14), Y(0));
      ctx.lineTo(X(fMax), Y(fit.slope * fMax * 1e14 + fit.intercept));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = color;
    for (const p of points.filter((q) => q.metal === metal)) {
      ctx.beginPath();
      ctx.arc(X(p.f / 1e14), Y(p.v), 5, 0, 2 * Math.PI);
      ctx.fill();
    }
    const last = points.filter((q) => q.metal === metal).at(-1);
    ctx.font = FONT;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    if (last) ctx.fillText(METALS[metal].name, Math.min(box.x1, X(last.f / 1e14) + 20), Y(last.v) - 8);
  }
  const fNow = frequencyHz(settings.nm) / 1e14;
  if (fNow < fMax) {
    ctx.strokeStyle = withAlpha(th.muted, 0.5);
    ctx.beginPath();
    ctx.moveTo(Math.round(X(fNow)) + 0.5, box.y0);
    ctx.lineTo(Math.round(X(fNow)) + 0.5, box.y1);
    ctx.stroke();
  }
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('frequency (10¹⁴ Hz)', (box.x0 + box.x1) / 2, h);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('stopping voltage (V)', box.x0 + 4, box.y0);
}

function render() {
  const th = theme();
  drawIV(th);
  drawMillikan(th);
  const E = photonEnergy(settings.nm);
  const K = E - phi();
  const fit = fitFor(settings.metal);
  $('facts').innerHTML = `
    <dt>Photon energy hf</dt><dd><b>${E.toFixed(2)} eV</b></dd>
    <dt>Work function φ (${METALS[settings.metal].name})</dt><dd>${phi().toFixed(2)} eV, so light shorter than ${thresholdNm(phi()).toFixed(0)} nm</dd>
    <dt>Fastest electron hf − φ</dt><dd>${K > 0 ? `<b>${K.toFixed(2)} eV</b>` : 'none escape'}</dd>
    ${fit ? `<dt>Fitted slope × e</dt><dd>h = ${sci(fit.h)} J s (true value 6.626 × 10⁻³⁴)</dd>` : ''}`;
  const ctx = { ...settings, threshold: thresholdNm(phi()), kmax: Math.max(0, K), fit };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

// ----- controls -----

function syncControls() {
  $('metal').value = settings.metal;
  for (const k of ['nm', 'intensity', 'volts']) $(k).value = String(settings[k]);
  $('nm-out').textContent = `${settings.nm} nm`;
  $('intensity-out').textContent = `${settings.intensity}%`;
  $('volts-out').textContent = `${settings.volts >= 0 ? '+' : ''}${settings.volts.toFixed(2)} V`;
}

for (const k of ['nm', 'intensity', 'volts']) {
  $(k).addEventListener('input', () => {
    settings[k] = Number($(k).value);
    syncControls();
    render();
  });
}
$('metal').addEventListener('change', () => {
  settings.metal = $('metal').value;
  electrons = [];
  render();
});
$('record').addEventListener('click', () => {
  if (!record()) {
    $('record').textContent = 'No electrons: nothing to stop';
    setTimeout(() => ($('record').textContent = 'Record'), 1600);
  }
  render();
});
$('clear').addEventListener('click', () => {
  points = [];
  render();
});

const lesson = mountLesson({ slug: 'photoelectric', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  const { record: rec, ...pre } = STEPS[i].preset;
  Object.assign(settings, pre);
  electrons = [];
  photons = [];
  if (rec) {
    points = points.filter((p) => p.metal !== settings.metal);
    rec.forEach((nm) => record(nm));
  }
  syncControls();
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  render();
}

window.addEventListener('themechange', render);
new ResizeObserver(() => render()).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
requestAnimationFrame(step);
