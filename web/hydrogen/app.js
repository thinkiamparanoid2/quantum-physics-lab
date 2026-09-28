import { seededRandom } from '../lib/circuit.js';
import { RYDBERG_EV, energyEV, extent, orbital, orbitalName, radial, sampleCloud } from '../lib/hydrogen.js';
import { eigenstates, makeGrid } from '../lib/wave.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { mountLesson } from '../ui/lesson.js';

// Hydrogen orbitals psi_nlm = R_nl(r) Y_lm (real, chemists' forms), in units of the Bohr radius.
// The cloud is 5000 positions sampled from |psi|^2; colour is the sign of psi. The energy is
// checked live by solving the radial Schrodinger equation numerically (lib/wave.js).

const POINTS = 5000;
const L_NAMES = ['s', 'p', 'd', 'f'];

const STEPS = [
  {
    title: 'One proton, one electron',
    preset: { n: 1, l: 0, m: 0 },
    html: `<p>Hydrogen is the simplest atom: one electron bound to one proton. Its wavefunction in the lowest state, the <b>1s orbital</b>, is a fuzzy ball.</p>
      <p>Each dot is one place the electron could be found if you measured its position: 5000 imagined measurements. There is no orbit and no path, only where it is likely to be.</p>`,
  },
  {
    title: 'How far out?',
    preset: { n: 1, l: 0, m: 0 },
    html: `<p>The cloud is densest right at the proton, but there is very little room there. Multiply by the area of a shell, 4πr², and the most likely <b>distance</b> is exactly one Bohr radius, a<sub>0</sub> = 0.053 nm (the peak in <b>How far from the proton</b>).</p>
      <p>That's Bohr's 1913 orbit radius, recovered as the peak of a probability.</p>`,
  },
  {
    title: '2s: a shell inside a shell',
    preset: { n: 2, l: 0, m: 0 },
    html: `<p>The 2s orbital is bigger, and it has a <b>node</b>: a sphere on which the electron is never found. Inside it ψ is positive (cyan), outside negative (pink), like a wave that has crossed zero.</p>
      <p>It's the same idea as the particle in a box: more energy means more nodes. Look at the dip to zero in the radial chart and the ring in the slice.</p>`,
  },
  {
    title: 'p orbitals: two lobes',
    preset: { n: 2, l: 1, m: 0 },
    html: `<p>Now give the electron angular momentum (l = 1). The <b>2p<sub>z</sub></b> orbital has two lobes of opposite sign, with a flat node plane between them where ψ = 0.</p>
      <p>There are three: p<sub>x</sub>, p<sub>y</sub> and p<sub>z</sub>, identical but pointing along different axes. Pick them with <b>Orientation</b> in Try it, and drag the cloud to turn it.</p>
      <p>These are the real orbitals chemists draw. p<sub>z</sub> has a definite m = 0, while p<sub>x</sub> and p<sub>y</sub> are each an equal mix of m = +1 and m = −1.</p>`,
  },
  {
    title: 'Counting nodes',
    preset: { n: 3, l: 2, m: 0 },
    html: ({ n, l }) => `<p>Every orbital has n − 1 nodes: l of them are angular (planes or cones through the centre) and n − l − 1 are radial (spheres). This 3d<sub>z²</sub> orbital has ${l} angular and ${n - l - 1} radial nodes: two cones around the z axis.</p>
      <p>The letters s, p, d, f stand for l = 0, 1, 2, 3; they come from the look of spectral lines (sharp, principal, diffuse, fundamental).</p>`,
  },
  {
    title: 'Energy depends only on n',
    preset: { n: 2, l: 1, m: 1 },
    html: ({ n }) => `<p>The energy is E<sub>n</sub> = −13.6 eV / n², whatever l and m are: 2s and all three 2p orbitals share E<sub>2</sub> = ${energyEV(2).toFixed(2)} eV. Level n holds n² orbitals, or 2n² electrons once spin is counted: 2, 8, 18, 32.</p>
      <p>These capacities set the pattern of the periodic table (its rows hold 2, 8, 8, 18, 18, 32 and 32 elements, because in many-electron atoms the subshells fill in a slightly different order). The facts under the cloud check E<sub>${n}</sub> by solving the Schrödinger equation numerically, with the solver of the waves lessons.</p>`,
  },
  {
    title: 'Your turn',
    preset: { n: 4, l: 3, m: 0 },
    html: `<p>Explore every orbital up to n = 4, including the f orbitals that give the rare-earth elements their magnetism. Turn the cloud, and use the slice to see nodes that the cloud hides.</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2 id="cloud-title">Electron cloud</h2><span class="legend"><span class="key" style="border-color: var(--amp-pos)"></span> ψ &gt; 0 <span class="key" style="border-color: var(--amp-neg)"></span> ψ &lt; 0; drag to turn</span></figcaption>
      <canvas id="cloud" class="chart" style="height: 380px; touch-action: none; cursor: grab" role="img" aria-label="3D cloud of electron positions"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>A slice through the atom</h2><label class="inline-select"><span class="visually-hidden">Slice plane</span><select id="plane"><option value="xz">x–z plane</option><option value="xy">x–y plane</option><option value="yz">y–z plane</option></select></label></figcaption>
      <canvas id="slice" class="chart" style="height: 380px" role="img" aria-label="Probability density in a plane through the nucleus"></canvas>
    </figure>
  </div>
  <figure class="panel card">
    <figcaption class="card-head"><h2>How far from the proton</h2><span class="legend">radial probability r²R(r)², in Bohr radii</span></figcaption>
    <canvas id="radial" class="chart" role="img" aria-label="Probability of finding the electron at each distance"></canvas>
    <dl class="facts" id="facts"></dl>
  </figure>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <div class="row">
      <label class="field"><span class="label">n (shell)</span><select id="n">${[1, 2, 3, 4].map((k) => `<option value="${k}">${k}</option>`).join('')}</select></label>
      <label class="field"><span class="label">l (shape)</span><select id="l"></select></label>
    </div>
    <label class="field"><span class="label">Orientation (real orbital)</span><select id="m"></select></label>
    <p class="hint" id="orbital-name"></p>
    <label class="field" style="display: flex; gap: 8px; align-items: center"><input id="spin" type="checkbox" checked> Turn the cloud slowly</label>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { n: 1, l: 0, m: 0 };
let index = 0;
let cloud = [];
let cloudScale = 1;
let view = { yaw: 0.6, pitch: 0.35 };
let numeric = null;
let spinTimer = null;
let sliceImage = null;

function rebuild() {
  const { n, l, m } = settings;
  cloud = sampleCloud(n, l, m, POINTS, seededRandom(n * 100 + l * 10 + m + 5));
  // Scale so the radius holding 95% of the probability fills most of the view.
  const rs = cloud.map(([x, y, z]) => Math.hypot(x, y, z)).sort((a, b) => a - b);
  cloudScale = rs[Math.floor(rs.length * 0.95)];
  // Independent check: solve the radial equation for this l on a grid.
  const R = Math.max(60, 4 * extent(n));
  const g = makeGrid(6000, 0, R);
  const V = Float64Array.from(g.x, (r) => -1 / r + (l * (l + 1)) / (2 * r * r));
  const E = eigenstates(V, g.dx, n - l)[n - l - 1].E;
  numeric = E * 2 * RYDBERG_EV;
  // pick the slice plane that shows the most of this orbital
  const best = ['xz', 'xy', 'yz']
    .map((p) => [p, slicePeak(p)])
    .sort((a, b) => b[1] - a[1])[0][0];
  $('plane').value = best;
  sliceImage = null;
}

function planePoint(plane, u, v) {
  return plane === 'xz' ? [u, 0, v] : plane === 'xy' ? [u, v, 0] : [0, u, v];
}

function slicePeak(plane) {
  const L = extent(settings.n) * 0.6;
  let peak = 0;
  for (let i = 0; i < 40; i++) {
    for (let j = 0; j < 40; j++) {
      const [x, y, z] = planePoint(plane, ((i + 0.5) / 40 - 0.5) * 2 * L, ((j + 0.5) / 40 - 0.5) * 2 * L);
      peak = Math.max(peak, orbital(settings.n, settings.l, settings.m, x, y, z) ** 2);
    }
  }
  return peak;
}

// ----- drawing -----

function project([x, y, z]) {
  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const x1 = x * cy - y * sy;
  const y1 = x * sy + y * cy;
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  return [y1, z * cp - x1 * sp];
}

function drawCloud(th) {
  const { ctx, w, h } = prep($('cloud'));
  const cx = w / 2;
  const cy = h / 2;
  const S = (Math.min(w, h) * 0.44) / cloudScale;
  // axes
  ctx.lineWidth = 1;
  ctx.font = MONO;
  for (const [v, name] of [
    [[1, 0, 0], 'x'],
    [[0, 1, 0], 'y'],
    [[0, 0, 1], 'z'],
  ]) {
    const [a, b] = project(v.map((c) => c * cloudScale * 1.08));
    ctx.strokeStyle = withAlpha(th.muted, 0.45);
    ctx.beginPath();
    ctx.moveTo(cx - a * S, cy + b * S);
    ctx.lineTo(cx + a * S, cy - b * S);
    ctx.stroke();
    ctx.fillStyle = th.muted;
    ctx.fillText(name, cx + a * S * 1.04 + 3, cy - b * S * 1.04);
  }
  const dark = document.documentElement.dataset.theme !== 'light';
  ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
  const pos = withAlpha(th.ampPos, dark ? 0.35 : 0.5);
  const neg = withAlpha(th.ampNeg, dark ? 0.35 : 0.5);
  for (const p of cloud) {
    const [a, b] = project(p);
    ctx.fillStyle = p[3] > 0 ? pos : neg;
    ctx.fillRect(cx + a * S - 1, cy - b * S - 1, 2, 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = th.marked;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, 2 * Math.PI);
  ctx.fill();
  // scale bar
  const bar = niceLength(cloudScale / 2);
  ctx.strokeStyle = th.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, h - 14);
  ctx.lineTo(14 + bar * S, h - 14);
  ctx.stroke();
  ctx.font = FONT;
  ctx.fillStyle = th.text;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.fillText(`${bar} a₀ = ${(bar * 0.0529).toFixed(bar < 2 ? 3 : 2)} nm`, 14, h - 20);
}

function niceLength(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((k) => k * p).filter((k) => k <= v).pop() ?? p;
}

function hexOf(color) {
  const c = document.createElement('canvas').getContext('2d');
  c.fillStyle = color;
  const s = c.fillStyle;
  return s.startsWith('#') ? [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) : s.match(/\d+/g).slice(0, 3).map(Number);
}

function drawSlice(th) {
  const { ctx, w, h } = prep($('slice'));
  const size = Math.min(w, h) - 16;
  const x0 = (w - size) / 2;
  const y0 = (h - size) / 2;
  const plane = $('plane').value;
  const L = cloudScale * 1.1;
  if (!sliceImage || sliceImage.plane !== plane || sliceImage.theme !== th.ampPos) {
    const res = 200;
    const vals = new Float64Array(res * res);
    let peak = 0;
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const u = ((i + 0.5) / res - 0.5) * 2 * L;
        const v = (0.5 - (j + 0.5) / res) * 2 * L;
        const val = orbital(settings.n, settings.l, settings.m, ...planePoint(plane, u, v));
        vals[j * res + i] = val;
        peak = Math.max(peak, val * val);
      }
    }
    const img = new ImageData(res, res);
    const [pr, pg, pb] = hexOf(th.ampPos);
    const [nr, ng, nb] = hexOf(th.ampNeg);
    const [sr, sg, sb] = hexOf(th.surface || '#000');
    for (let k = 0; k < res * res; k++) {
      const v = vals[k];
      const a = peak > 0 ? ((v * v) / peak) ** 0.3 : 0; // a gentle curve, so faint outer lobes show
      const [r, g, b] = v >= 0 ? [pr, pg, pb] : [nr, ng, nb];
      img.data[4 * k] = sr + (r - sr) * a;
      img.data[4 * k + 1] = sg + (g - sg) * a;
      img.data[4 * k + 2] = sb + (b - sb) * a;
      img.data[4 * k + 3] = 255;
    }
    const off = document.createElement('canvas');
    off.width = res;
    off.height = res;
    off.getContext('2d').putImageData(img, 0, 0);
    sliceImage = { plane, canvas: off, theme: th.ampPos };
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sliceImage.canvas, x0, y0, size, size);
  ctx.strokeStyle = th.axis;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, size - 1, size - 1);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${plane[0]} →`, x0 + size - 6, y0 + size - 4);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`↑ ${plane[1]}`, x0 + 6, y0 + 6);
  ctx.textAlign = 'right';
  ctx.fillText(`±${L.toFixed(0)} a₀`, x0 + size - 6, y0 + 6);
}

function drawRadial(th) {
  const { ctx, w, h } = prep($('radial'));
  const box = { x0: 48, y0: 14, x1: w - 14, y1: h - 30 };
  const { n, l } = settings;
  const rMax = cloudScale * 1.4;
  const pts = Array.from({ length: 501 }, (_, i) => {
    const r = (i / 500) * rMax;
    return [r, r * r * radial(n, l, r) ** 2];
  });
  const peak = Math.max(...pts.map((p) => p[1]));
  const Y = yAxis(ctx, box, [0, peak * 1.12], th);
  const X = xAxis(ctx, box, [0, rMax], th);
  ctx.fillStyle = withAlpha(th.ampPos, 0.15);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(0));
  pts.forEach(([r, p]) => ctx.lineTo(X(r), Y(p)));
  ctx.lineTo(X(rMax), Y(0));
  ctx.fill();
  ctx.strokeStyle = th.ampPos;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  pts.forEach(([r, p], i) => (i ? ctx.lineTo(X(r), Y(p)) : ctx.moveTo(X(r), Y(p))));
  ctx.stroke();
  const mean = (3 * n * n - l * (l + 1)) / 2;
  const marks = [[mean, `⟨r⟩ = ${mean}`, th.marked, 'left']];
  // Bohr's orbit radius n^2 is always inside <r>, so its label goes on the left of its line.
  if (l === n - 1) marks.push([n * n, `Bohr orbit n² = ${n * n}`, th.accent, 'right']);
  marks.forEach(([r, label, color, side]) => {
    if (r > rMax) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(Math.round(X(r)) + 0.5, box.y0);
    ctx.lineTo(Math.round(X(r)) + 0.5, box.y1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = MONO;
    ctx.fillStyle = color;
    ctx.textAlign = side;
    ctx.textBaseline = 'top';
    ctx.fillText(label, X(r) + (side === 'left' ? 5 : -5), box.y0 + 2);
  });
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('distance r (Bohr radii)', (box.x0 + box.x1) / 2, h);
}

function render() {
  const th = theme();
  drawCloud(th);
  drawSlice(th);
  drawRadial(th);
  const { n, l, m } = settings;
  const name = orbitalName(n, l, m).replace(/_(.+)$/, '<sub>$1</sub>');
  $('cloud-title').innerHTML = `Electron cloud: ${name}`;
  $('orbital-name').innerHTML = `This is the <b>${name}</b> orbital.`;
  $('facts').innerHTML = `
    <dt>Energy E<sub>${n}</sub> = −13.6 eV/n²</dt><dd><b>${energyEV(n).toFixed(4)} eV</b></dd>
    <dt>Solving the radial equation numerically</dt><dd>${numeric.toFixed(4)} eV</dd>
    <dt>Nodes</dt><dd>${n - 1} in all: ${l} angular, ${n - l - 1} radial</dd>`;
  const ctx = { ...settings };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

// ----- controls -----

// Real orbitals: p_x, p_y, d_xy, ... mix +m and -m, so only |m| is a good label (m = 0 is exact).
const mLabel = (l, m) => {
  const name = orbitalName(2 + l, l, m);
  const sub = name.includes('_') ? name.split('_')[1] : '';
  return `${L_NAMES[l]}${sub}  (${m === 0 ? 'm = 0' : `|m| = ${Math.abs(m)}`})`;
};

function syncControls() {
  const { n, l, m } = settings;
  $('n').value = String(n);
  $('l').innerHTML = Array.from({ length: n }, (_, k) => `<option value="${k}">${k} (${L_NAMES[k]})</option>`).join('');
  $('l').value = String(l);
  $('m').innerHTML = Array.from({ length: 2 * l + 1 }, (_, k) => k - l)
    .map((k) => `<option value="${k}">${mLabel(l, k)}</option>`)
    .join('');
  $('m').value = String(m);
}

function changed() {
  settings.l = Math.min(settings.l, settings.n - 1);
  settings.m = Math.max(-settings.l, Math.min(settings.l, settings.m));
  syncControls();
  rebuild();
  render();
}

for (const k of ['n', 'l', 'm']) {
  $(k).addEventListener('change', () => {
    settings[k] = Number($(k).value);
    changed();
  });
}
$('plane').addEventListener('change', () => {
  sliceImage = null;
  render();
});

function setSpin(on) {
  clearInterval(spinTimer);
  spinTimer = null;
  if (on)
    spinTimer = setInterval(() => {
      if (document.hidden) return;
      view.yaw += 0.01;
      drawCloud(theme());
    }, 33);
}
$('spin').addEventListener('change', () => setSpin($('spin').checked));

// drag to turn the cloud
let drag = null;
$('cloud').addEventListener('pointerdown', (e) => {
  drag = [e.clientX, e.clientY];
  $('cloud').setPointerCapture?.(e.pointerId);
  $('cloud').style.cursor = 'grabbing';
});
$('cloud').addEventListener('pointermove', (e) => {
  if (!drag) return;
  view.yaw -= (e.clientX - drag[0]) * 0.01;
  view.pitch = Math.max(-1.4, Math.min(1.4, view.pitch + (e.clientY - drag[1]) * 0.01));
  drag = [e.clientX, e.clientY];
  drawCloud(theme());
});
const endDrag = () => {
  drag = null;
  $('cloud').style.cursor = 'grab';
};
$('cloud').addEventListener('pointerup', endDrag);
$('cloud').addEventListener('pointercancel', endDrag);

const lesson = mountLesson({ slug: 'hydrogen', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  Object.assign(settings, STEPS[i].preset);
  syncControls();
  rebuild();
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  render();
}

window.addEventListener('themechange', () => {
  sliceImage = null;
  render();
});
new ResizeObserver(() => render()).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
setSpin(true);
