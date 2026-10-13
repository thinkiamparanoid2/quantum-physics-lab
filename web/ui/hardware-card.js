// A "Measured on a real quantum computer" card: the site's own runs on IBM Quantum hardware
// (lib/hardware-data.js, generated from hardware_runs/), drawn against the ideal prediction.

import { evolveExact } from '../lib/dynamics.js';
import { HARDWARE } from '../lib/hardware-data.js';
import { zExpectations } from '../lib/manybody.js';
import { observables, schwingerModel } from '../lib/schwinger.js';
import { withAlpha } from './bloch.js';
import { FONT, MONO, prep } from './charts.js';

const H = HARDWARE;

export const hardwareTitle = `Measured on ${H.device}`;
export const hardwareLegend = `IBM Quantum, ${H.date}`;

// Mount the card's contents into an empty container once, then draw.
export function drawHardware(box, kind, th) {
  if (!box.querySelector('canvas')) {
    box.innerHTML = `<canvas class="chart" style="height: 240px" role="img" aria-label="${hardwareTitle}"></canvas><p class="hint"></p>`;
  }
  const canvas = box.querySelector('canvas');
  const hint = box.querySelector('.hint');
  ({ chsh, schwinger, rb })[kind](canvas, th, hint);
}

// static markup for lessons that build their stage by hand
export function hardwareCardHtml(id) {
  return `<figure class="panel card">
    <figcaption class="card-head"><h2>${hardwareTitle}</h2><span class="legend">${hardwareLegend}</span></figcaption>
    <div id="${id}"></div>
  </figure>`;
}

function frame(canvas, th, [x0v, x1v], [y0v, y1v], xlabel) {
  const { ctx, w, h } = prep(canvas);
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 36 };
  const X = (v) => box.x0 + ((v - x0v) / (x1v - x0v)) * (box.x1 - box.x0);
  const Y = (v) => box.y1 - ((v - y0v) / (y1v - y0v)) * (box.y1 - box.y0);
  ctx.strokeStyle = th.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(box.x0, box.y0);
  ctx.lineTo(box.x0, box.y1);
  ctx.lineTo(box.x1, box.y1);
  ctx.stroke();
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(xlabel, (box.x0 + box.x1) / 2, box.y1 + 18);
  return { ctx, box, X, Y };
}

function ticks(ctx, th, box, X, Y, xs, ys, fx = String, fy = String) {
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const x of xs) ctx.fillText(fx(x), X(x), box.y1 + 4);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const y of ys) ctx.fillText(fy(y), box.x0 - 6, Y(y));
}

function curve(ctx, X, Y, f, a, b, color, width = 2, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  for (let i = 0; i <= 200; i++) {
    const x = a + ((b - a) * i) / 200;
    (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(x), Y(f(x)));
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function dot(ctx, x, y, r, color, err = 0, Y = null) {
  if (err && Y) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, Y.hi);
    ctx.lineTo(x, Y.lo);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}

function legend(ctx, th, x, y, items) {
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  items.forEach(([text, color, kind], i) => {
    const yy = y + 17 * i;
    if (kind === 'line') {
      ctx.fillStyle = color;
      ctx.fillRect(x, yy - 1.5, 16, 3);
    } else {
      ctx.beginPath();
      ctx.arc(x + 8, yy, 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.fillStyle = th.text;
    ctx.fillText(text, x + 22, yy);
  });
}

function chsh(canvas, th, hint) {
  const c = H.chsh;
  const { ctx, box, X, Y } = frame(canvas, th, [0, 2 * Math.PI], [-1.1, 1.1], 'angle between the two measurement directions');
  ticks(ctx, th, box, X, Y, [0, Math.PI, 2 * Math.PI], [-1, 0, 1], (x) => ['0', 'π', '2π'][Math.round(x / Math.PI)]);
  curve(ctx, X, Y, Math.cos, 0, 2 * Math.PI, withAlpha(th.text, 0.6), 1.5);
  for (const [d, E] of c.sweep) {
    const x = ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    dot(ctx, X(x), Y(E), 4.5, th.accent2);
  }
  // the curve is at its minimum around a − b = π, so the legend goes above it there
  legend(ctx, th, X(Math.PI) - 110, box.y0 + 8, [
    ['quantum prediction cos(a − b)', withAlpha(th.text, 0.6), 'line'],
    [`${H.device}, qubits ${c.qubits.join(' and ')}`, th.accent2, 'dot'],
  ]);
  hint.innerHTML = `A Bell pair on two superconducting qubits, measured along 16 angle pairs and the four CHSH settings (${c.shots.toLocaleString()} shots each). Result: <b>S = ${c.S.toFixed(3)} ± ${c.S_err.toFixed(3)}</b>, above the classical limit of 2 by ${Math.round((c.S - 2) / c.S_err)} standard deviations (quantum maximum 2√2 ≈ 2.828). Job ${c.job}.`;
}

// exact particle number of the 4-site model on [0, 1.6], computed once (same Hamiltonian as the run)
let exactCache = null;
function exactSchwinger() {
  if (!exactCache) {
    const m = schwingerModel(4, { x: 1, mass: 0.5, g: 0.6 });
    const re = new Float64Array(16);
    const im = new Float64Array(16);
    re[m.vacuum] = 1;
    const vals = [0];
    for (let k = 1; k <= 160; k++) {
      evolveExact(m.op, re, im, 0.01);
      vals.push(observables(m, zExpectations(4, re, im)).total);
    }
    exactCache = (t) => vals[Math.min(160, Math.round(t * 100))];
  }
  return exactCache;
}

function schwinger(canvas, th, hint) {
  const s = H.schwinger;
  const { ctx, box, X, Y } = frame(canvas, th, [0, 1.6], [-0.1, 2.3], 'time');
  ticks(ctx, th, box, X, Y, [0, 0.5, 1, 1.5], [0, 1, 2]);
  curve(ctx, X, Y, exactSchwinger(), 0, 1.6, withAlpha(th.text, 0.6), 2);
  ctx.strokeStyle = withAlpha(th.muted, 0.5);
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(box.x0, Y(2));
  ctx.lineTo(box.x1, Y(2));
  ctx.stroke();
  ctx.setLineDash([]);
  for (const r of s.rows) {
    dot(ctx, X(r.t) - 4, Y(r.mitigated), 4, th.accent2, r.mitigated_err, { hi: Y(r.mitigated + r.mitigated_err), lo: Y(r.mitigated - r.mitigated_err) });
    dot(ctx, X(r.t) + 4, Y(r.zne), 4.5, th.ampNeg, r.zne_err, { hi: Y(r.zne + r.zne_err), lo: Y(r.zne - r.zne_err) });
  }
  legend(ctx, th, box.x1 - 250, box.y1 - 62, [
    ['exact', withAlpha(th.text, 0.6), 'line'],
    ['hardware, readout mitigated', th.accent2, 'dot'],
    ['+ zero-noise extrapolation', th.ampNeg, 'dot'],
  ]);
  hint.innerHTML = `The 4-site model (x = 1, m = 0.5, g = 0.6) from the bare vacuum, second-order Trotter steps of 0.25, on qubits ${s.qubits.join(', ')} (${s.shots.toLocaleString()} shots per circuit). Noise was amplified 2× and 3× by gate folding and extrapolated back to zero. Up to t = 1 the result matches the exact curve within its error bars; later times need up to 158 two-qubit gates, and the noise there is too strong to undo (dotted line: a fully scrambled state, 2 particles). Job ${s.job}.`;
}

function rb(canvas, th, hint) {
  const r = H.rb;
  const mmax = Math.max(...r.points.map((p) => p[0]));
  const { ctx, box, X, Y } = frame(canvas, th, [0, mmax * 1.03], [0.55, 1.01], 'sequence length (Cliffords)');
  ticks(ctx, th, box, X, Y, [0, 1000, 2000, 3000], [0.6, 0.8, 1.0], String, (v) => v.toFixed(1));
  curve(ctx, X, Y, (m) => r.A * r.f ** m + r.B, 0, mmax, th.marked, 2);
  for (const [m, y, e] of r.points) dot(ctx, X(m), Y(y), 4, th.accent2, e, { hi: Y(y + e), lo: Y(y - e) });
  legend(ctx, th, box.x1 - 230, box.y0 + 8, [
    [`qubit ${r.qubit}: mean survival`, th.accent2, 'dot'],
    ['fit A·f^m + B', th.marked, 'line'],
  ]);
  hint.innerHTML = `Eight random sequences per length on qubit ${r.qubit}, two runs combined, fitted with 0 ≤ A, B ≤ 1: <b>error per Clifford r = (${r.r.toFixed(2)} ± ${r.r_err.toFixed(2)}) × 10⁻⁴</b>, average gate fidelity ${(1 - r.r * 1e-4).toFixed(5)}. The fitted A = ${r.A.toFixed(2)} and B = ${r.B.toFixed(2)} are close to the ½, ½ of depolarizing noise.`;
}
