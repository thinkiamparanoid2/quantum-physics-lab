import { COMPTON_PM, compton } from '../lib/optics.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { mountLesson } from '../ui/lesson.js';

// Compton scattering: a photon bounces off a free electron and comes out with a longer wavelength,
// lambda' - lambda = (h / m c)(1 - cos theta). lib/optics.js checks energy and momentum conservation.

const SOURCES = {
  mo: { name: 'X-rays, 71.1 pm (Compton’s)', pm: 71.1 },
  hard: { name: 'Hard X-rays, 10 pm', pm: 10 },
  gamma: { name: 'Gamma rays, 1.0 pm', pm: 1 },
  light: { name: 'Green light, 500 nm', pm: 500000 },
};

const STEPS = [
  {
    title: 'X-rays meet electrons',
    preset: { src: 'mo', deg: 90, bound: true },
    html: `<p>In 1923 Arthur Compton shone X-rays at a block of graphite and measured the wavelength of the X-rays scattered off to the side. As a wave, light should make the electrons oscillate at its own frequency and re-emit the <b>same wavelength</b> in every direction.</p>
      <p>Instead he found a second, <b>longer</b> wavelength, and it grew with the scattering angle.</p>`,
  },
  {
    title: 'Light as billiard balls',
    preset: { src: 'mo', deg: 90, bound: false },
    html: ({ r }) => `<p>Treat the X-ray as a particle, a photon with energy hc/λ and momentum h/λ, colliding with a free electron. The electron recoils (arrow) and takes some energy, so the photon comes away with less energy: a longer wavelength.</p>
      <p>Conserving energy and momentum gives λ′ − λ = (h/mc)(1 − cos θ). At 90°: ${(r.out - SOURCES.mo.pm).toFixed(3)} pm, the <b>Compton wavelength</b> of the electron.</p>`,
  },
  {
    title: 'Bigger angle, bigger shift',
    preset: { src: 'mo', deg: 150, bound: false },
    html: `<p>Drag the angle. Glancing collisions barely change the photon; a head-on bounce straight back (180°) gives the largest shift, twice the Compton wavelength: ${(2 * COMPTON_PM).toFixed(2)} pm.</p>
      <p>The shift doesn't depend on the wavelength you start with. That was the smoking gun: momentum h/λ, the same rule de Broglie would soon turn around for electrons.</p>`,
  },
  {
    title: 'Why nobody saw it with light',
    preset: { src: 'light', deg: 180, bound: false },
    html: ({ r }) => `<p>For green light the shift is still about 5 pm, but that's ${((r.out / SOURCES.light.pm - 1) * 1e6).toFixed(0)} parts in a million of 500 nm: invisible. Only for X-rays (and more so gamma rays) is the change a large fraction of the wavelength.</p>`,
  },
  {
    title: 'Two peaks in the data',
    preset: { src: 'mo', deg: 135, bound: true },
    html: `<p>Compton's detector saw two peaks (lower chart). The shifted one comes from loosely held outer electrons. The unshifted one comes from inner electrons held so tightly that the whole atom recoils, and an atom is thousands of times heavier, so its "Compton wavelength" is tiny.</p>
      <p>Compton won the 1927 Nobel Prize: light carries momentum in lumps, as Einstein had proposed.</p>`,
  },
  {
    title: 'Your turn',
    preset: { src: 'gamma', deg: 60, bound: false },
    html: `<p>With gamma rays the photon can lose most of its energy to the electron. At what angle does a 1 pm gamma ray give half its energy away? (Medical PET scanners and gamma detectors must deal with exactly this scattering.)</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<figure class="panel card">
    <figcaption class="card-head"><h2>The collision</h2><span class="legend">wavelengths drawn to scale; arrow = electron recoil</span></figcaption>
    <canvas id="scene" class="chart tall" role="img" aria-label="A photon scattering off an electron"></canvas>
    <dl class="facts" id="facts"></dl>
  </figure>
  <div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2>Shift against angle</h2><span class="legend">(h/mc)(1 − cos θ)</span></figcaption>
      <canvas id="shift" class="chart" style="height: 260px" role="img" aria-label="Wavelength shift against scattering angle"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>What the detector sees</h2><span class="legend">intensity against wavelength</span></figcaption>
      <canvas id="spectrum" class="chart" style="height: 260px" role="img" aria-label="Detected spectrum with shifted and unshifted peaks"></canvas>
    </figure>
  </div>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">Incoming light</span>
      <select id="src">${Object.entries(SOURCES)
        .map(([k, s]) => `<option value="${k}">${s.name}</option>`)
        .join('')}</select></label>
    <label class="field"><span class="label">Scattering angle θ <output id="deg-out"></output></span><input id="deg" type="range" min="0" max="180" step="1"></label>
    <label class="field" style="display: flex; gap: 8px; align-items: center"><input id="bound" type="checkbox"> Include tightly bound electrons (unshifted peak)</label>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { src: 'mo', deg: 90, bound: true };
let index = 0;

function wave(ctx, x0, y0, angle, length, lambdaPx, color, width) {
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let s = 0; s <= length; s += 1) {
    const y = 9 * Math.sin((2 * Math.PI * s) / lambdaPx);
    if (s === 0) ctx.moveTo(s, y);
    else ctx.lineTo(s, y);
  }
  ctx.stroke();
  // arrow head
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(length + 12, 0);
  ctx.lineTo(length, -6);
  ctx.lineTo(length, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawScene(th, r) {
  const { ctx, w, h } = prep($('scene'));
  const cx = w * 0.45;
  const cy = h * 0.5;
  const src = SOURCES[settings.src];
  // scale: the incoming wavelength is drawn 34 px long, or proportionally for the outgoing one;
  // visible light is drawn at the same 34 px (its shift is far too small to see anyway)
  const pxPerPm = 34 / src.pm;
  const inLen = Math.min(cx - 40, 240);
  wave(ctx, cx - inLen - 20, cy, 0, inLen, src.pm * pxPerPm, th.ampPos, 2.5);
  const theta = (settings.deg * Math.PI) / 180;
  wave(ctx, cx + 18 * Math.cos(-theta), cy + 18 * Math.sin(-theta), -theta, Math.min(220, w - cx - 60), r.out * pxPerPm, th.marked, 2.5);
  // electron and its recoil
  ctx.fillStyle = th.text;
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, 2 * Math.PI);
  ctx.fill();
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('electron', cx, cy + 12);
  if (settings.deg > 0) {
    const len = 30 + 120 * Math.min(1, r.p / (2 * r.E0));
    ctx.strokeStyle = th.ampNeg;
    ctx.lineWidth = 3;
    const ex = cx + len * Math.cos(r.phi);
    const ey = cy + len * Math.sin(r.phi);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = th.ampNeg;
    ctx.beginPath();
    ctx.arc(ex, ey, 4, 0, 2 * Math.PI);
    ctx.fill();
  }
  // angle arc
  ctx.strokeStyle = withAlpha(th.muted, 0.7);
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 150, cy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(cx, cy, 44, -theta, 0);
  ctx.stroke();
  ctx.font = MONO;
  ctx.fillStyle = th.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`θ = ${settings.deg}°`, cx + 50 * Math.cos(-theta / 2) + 4, cy + 50 * Math.sin(-theta / 2));
}

function drawShift(th, r) {
  const { ctx, w, h } = prep($('shift'));
  const box = { x0: 48, y0: 14, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, 5.2], th);
  const X = xAxis(ctx, box, [0, 180], th);
  ctx.strokeStyle = th.ampPos;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let d = 0; d <= 180; d++) (d ? ctx.lineTo : ctx.moveTo).call(ctx, X(d), Y(COMPTON_PM * (1 - Math.cos((d * Math.PI) / 180))));
  ctx.stroke();
  ctx.fillStyle = th.marked;
  ctx.beginPath();
  ctx.arc(X(settings.deg), Y(r.out - SOURCES[settings.src].pm), 6, 0, 2 * Math.PI);
  ctx.fill();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('angle θ (degrees); shift in pm', (box.x0 + box.x1) / 2, h);
}

function drawSpectrum(th, r) {
  const { ctx, w, h } = prep($('spectrum'));
  const box = { x0: 44, y0: 14, x1: w - 14, y1: h - 30 };
  const l0 = SOURCES[settings.src].pm;
  const shift = r.out - l0;
  const width = Math.max(0.35, l0 * 0.004);
  const lo = l0 - 4 * width - 1;
  const hi = l0 + Math.max(2 * COMPTON_PM, shift) + 4 * width + 1;
  const X = xAxis(ctx, box, [lo - l0, hi - l0], th);
  const Y = yAxis(ctx, box, [0, 1.1], th);
  const g = (x, c) => Math.exp(-((x - c) ** 2) / (2 * width * width));
  ctx.strokeStyle = th.marked;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i <= 400; i++) {
    const x = lo + ((hi - lo) * i) / 400;
    const I = 0.9 * g(x, r.out) + (settings.bound ? 0.6 * g(x, l0) : 0);
    (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(x - l0), Y(I));
  }
  ctx.stroke();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('wavelength minus the original, pm', (box.x0 + box.x1) / 2, h);
  ctx.textBaseline = 'top';
  ctx.fillStyle = th.marked;
  if (shift > 0.3) ctx.fillText('shifted', X(shift), box.y0);
  if (settings.bound) {
    ctx.fillStyle = th.muted;
    ctx.fillText('unshifted', X(0), box.y0 + 14);
  }
}

function render() {
  const th = theme();
  const src = SOURCES[settings.src];
  const r = compton(src.pm, (settings.deg * Math.PI) / 180);
  drawScene(th, r);
  drawShift(th, r);
  drawSpectrum(th, r);
  const fmtE = (keV) => (keV >= 0.1 ? `${keV.toFixed(2)} keV` : `${(keV * 1000).toFixed(2)} eV`);
  $('facts').innerHTML = `
    <dt>Wavelength in → out</dt><dd><b>${src.pm >= 1000 ? `${(src.pm / 1000).toFixed(0)} nm` : `${src.pm} pm`} → ${src.pm >= 1000 ? `${(r.out / 1000).toFixed(6)} nm` : `${r.out.toFixed(3)} pm`}</b> (shift ${(r.out - src.pm).toFixed(3)} pm)</dd>
    <dt>Photon energy in → out</dt><dd>${fmtE(r.E0)} → ${fmtE(r.E1)}</dd>
    <dt>Electron gets</dt><dd>${fmtE(r.kinetic)}, moving off at ${Math.round((Math.abs(r.phi) * 180) / Math.PI)}° below the beam</dd>`;
  const ctx = { ...settings, r };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

function syncControls() {
  $('src').value = settings.src;
  $('deg').value = String(settings.deg);
  $('deg-out').textContent = `${settings.deg}°`;
  $('bound').checked = settings.bound;
}

$('src').addEventListener('change', () => {
  settings.src = $('src').value;
  render();
});
$('deg').addEventListener('input', () => {
  settings.deg = Number($('deg').value);
  syncControls();
  render();
});
$('bound').addEventListener('change', () => {
  settings.bound = $('bound').checked;
  render();
});

const lesson = mountLesson({ slug: 'compton', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  Object.assign(settings, STEPS[i].preset);
  syncControls();
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  render();
}

window.addEventListener('themechange', render);
new ResizeObserver(() => render()).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
