// Plots for 1D wave mechanics. Probability densities are filled and coloured by the phase of
// psi (the same colour wheel as the amplitude dials), so moving and standing waves look different.

import { FONT, MONO, hline, prep, xAxis, yAxis } from './charts.js';
import { withAlpha } from './bloch.js';
import { phaseColor } from './dials.js';

const index = (x, v) => {
  // Nearest grid index for coordinate v on a uniform grid.
  const dx = x[1] - x[0];
  return Math.max(0, Math.min(x.length - 1, Math.round((v - x[0]) / dx)));
};

function drawPotential(ctx, box, x, V, X, Ve, th) {
  ctx.beginPath();
  ctx.moveTo(X(x[0]), box.y1);
  for (let i = 0; i < x.length; i += Math.max(1, Math.floor(x.length / 600))) ctx.lineTo(X(x[i]), Math.max(box.y0, Ve(V[i])));
  ctx.lineTo(X(x[x.length - 1]), Math.max(box.y0, Ve(V[V.length - 1])));
  ctx.lineTo(X(x[x.length - 1]), box.y1);
  ctx.closePath();
  ctx.fillStyle = withAlpha(th.muted, 0.13);
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < x.length; i += Math.max(1, Math.floor(x.length / 600))) {
    const y = Math.max(box.y0, Ve(V[i]));
    if (i === 0) ctx.moveTo(X(x[i]), y);
    else ctx.lineTo(X(x[i]), y);
  }
  ctx.strokeStyle = th.axis;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function energyLine(ctx, box, y, color, label, dashed = true) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash(dashed ? [6, 5] : []);
  hline(ctx, box.x0, box.x1, Math.round(y) + 0.5);
  ctx.setLineDash([]);
  if (label) {
    ctx.font = FONT;
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, box.x1 - 4, y - 3);
  }
}

// Probability density |psi|^2 (filled, phase-coloured) over the potential, with optional energy
// line, extra level lines and a <x> +/- dx band.
export function drawDensity(canvas, { theme: th, x, re, im, V, vRange, yMax, xRange, energy = null, energyLabel = '', levels = [], stats = null, parts = false, overlay = null }) {
  const { ctx, w, h } = prep(canvas);
  const box = { x0: 48, y0: 12, x1: w - 14, y1: h - 28 };
  const [xa, xb] = xRange ?? [x[0], x[x.length - 1]];
  const X = xAxis(ctx, box, [xa, xb], th);
  const Y = yAxis(ctx, box, [0, yMax], th);
  const Ve = (v) => box.y1 - ((v - vRange[0]) / (vRange[1] - vRange[0])) * (box.y1 - box.y0);

  if (V) drawPotential(ctx, box, x, V, X, Ve, th);
  for (const E of levels) energyLine(ctx, box, Ve(E), withAlpha(th.muted, 0.5), '', false);

  if (stats) {
    ctx.fillStyle = withAlpha(th.accent, 0.12);
    ctx.fillRect(X(stats.mean - stats.spread), box.y0, X(stats.mean + stats.spread) - X(stats.mean - stats.spread), box.y1 - box.y0);
    ctx.strokeStyle = withAlpha(th.accent, 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(X(stats.mean)) + 0.5, box.y0);
    ctx.lineTo(Math.round(X(stats.mean)) + 0.5, box.y1);
    ctx.stroke();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  ctx.clip();
  if (parts) {
    const amp = Math.sqrt(yMax);
    const Ypart = (v) => (box.y0 + box.y1) / 2 - (v / amp) * ((box.y1 - box.y0) / 2);
    for (const [arr, color] of [
      [re, th.accent2],
      [im, th.exact],
    ]) {
      ctx.beginPath();
      for (let px = box.x0; px <= box.x1; px++) {
        const i = index(x, xa + ((px - box.x0) / (box.x1 - box.x0)) * (xb - xa));
        if (px === box.x0) ctx.moveTo(px, Ypart(arr[i]));
        else ctx.lineTo(px, Ypart(arr[i]));
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else {
    for (let px = Math.floor(box.x0); px < box.x1; px++) {
      const i = index(x, xa + ((px + 0.5 - box.x0) / (box.x1 - box.x0)) * (xb - xa));
      const d = re[i] * re[i] + im[i] * im[i];
      if (d < 1e-7 * yMax) continue;
      ctx.fillStyle = phaseColor(Math.atan2(im[i], re[i]), 0.9);
      const top = Y(Math.min(d, yMax));
      ctx.fillRect(px, top, 1.2, box.y1 - top);
    }
  }
  if (overlay) {
    ctx.beginPath();
    let pen = false;
    for (let px = Math.floor(box.x0); px <= box.x1; px++) {
      const i = index(x, xa + ((px - box.x0) / (box.x1 - box.x0)) * (xb - xa));
      const v = overlay.values[i];
      if (!Number.isFinite(v) || v <= 0) {
        pen = false;
        continue;
      }
      const y = Math.max(box.y0, Y(v));
      if (pen) ctx.lineTo(px, y);
      else ctx.moveTo(px, y);
      pen = true;
    }
    ctx.strokeStyle = overlay.color ?? th.text;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  if (energy !== null) energyLine(ctx, box, Ve(energy), th.marked, energyLabel);
}

// Energy-level diagram: each stationary state drawn around a baseline at its energy.
export function drawStates(canvas, { theme: th, x, V, states, vRange, xRange, selected = new Set(), scale = 1, density = false, firstN = 1 }) {
  const { ctx, w, h } = prep(canvas);
  const box = { x0: 48, y0: 12, x1: w - 64, y1: h - 28 };
  const [xa, xb] = xRange ?? [x[0], x[x.length - 1]];
  const X = xAxis(ctx, box, [xa, xb], th);
  const Ve = (v) => box.y1 - ((v - vRange[0]) / (vRange[1] - vRange[0])) * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('E ↑', box.x0 - 6, box.y0 + 10);
  drawPotential(ctx, box, x, V, X, Ve, th);

  const gap = states.length > 1 ? Math.abs(Ve(states[1].E) - Ve(states[0].E)) : (box.y1 - box.y0) / 4;
  const amp = Math.min(gap * 0.45 * scale, (box.y1 - box.y0) / 6);
  let peak = 0;
  for (const s of states) for (const v of s.psi) peak = Math.max(peak, density ? v * v : Math.abs(v));

  let lastLabel = Infinity;
  states.forEach(({ E, psi }, n) => {
    const y0 = Ve(E);
    if (y0 < box.y0 - 4 || y0 > box.y1 + 4) return;
    const on = selected.size === 0 || selected.has(n);
    energyLine(ctx, box, y0, withAlpha(th.muted, on ? 0.55 : 0.2), '', false);
    ctx.beginPath();
    for (let px = Math.floor(box.x0); px <= box.x1; px++) {
      const i = index(x, xa + ((px - box.x0) / (box.x1 - box.x0)) * (xb - xa));
      const v = density ? psi[i] * psi[i] : psi[i];
      const y = y0 - (v / peak) * amp;
      if (px === Math.floor(box.x0)) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.strokeStyle = on ? (selected.has(n) ? th.accent2 : th.exact) : withAlpha(th.muted, 0.25);
    ctx.lineWidth = selected.has(n) ? 2.5 : 1.6;
    ctx.stroke();
    ctx.font = MONO;
    ctx.fillStyle = on ? th.text : th.muted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    // Levels closer than a line of text (bands, near-degenerate pairs) share one label.
    if (lastLabel - y0 >= 11) {
      ctx.fillText(`n=${n + firstN}  ${E.toFixed(2)}`, box.x1 + 6, y0);
      lastLabel = y0;
    }
  });
}

// Momentum distribution |phi(k)|^2 with an optional mean +/- spread band.
export function drawMomentum(canvas, { theme: th, k, prob, kRange, stats = null }) {
  const { ctx, w, h } = prep(canvas);
  const box = { x0: 48, y0: 12, x1: w - 14, y1: h - 28 };
  let peak = 0;
  for (let i = 0; i < k.length; i++) if (k[i] >= kRange[0] && k[i] <= kRange[1]) peak = Math.max(peak, prob[i]);
  const X = xAxis(ctx, box, kRange, th);
  const Y = yAxis(ctx, box, [0, Math.max(peak * 1.1, 1e-6)], th);
  if (stats) {
    ctx.fillStyle = withAlpha(th.accent, 0.12);
    ctx.fillRect(X(stats.mean - stats.spread), box.y0, X(stats.mean + stats.spread) - X(stats.mean - stats.spread), box.y1 - box.y0);
  }
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < k.length; i++) {
    if (k[i] < kRange[0] || k[i] > kRange[1]) continue;
    if (!started) {
      ctx.moveTo(X(k[i]), box.y1);
      started = true;
    }
    ctx.lineTo(X(k[i]), Y(prob[i]));
  }
  ctx.lineTo(X(kRange[1]), box.y1);
  ctx.closePath();
  ctx.fillStyle = withAlpha(th.exact, 0.35);
  ctx.fill();
  ctx.strokeStyle = th.exact;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Space-time map of the probability density: x across, time downwards.
export function drawCarpet(canvas, { theme: th, frames, x, xRange, tMax, currentT = null }) {
  const { ctx, w, h } = prep(canvas);
  const box = { x0: 48, y0: 8, x1: w - 14, y1: h - 28 };
  const [xa, xb] = xRange ?? [x[0], x[x.length - 1]];
  xAxis(ctx, { ...box }, [xa, xb], th);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('t = 0', box.x0 - 6, box.y0);
  ctx.textBaseline = 'bottom';
  ctx.fillText(`t = ${tMax.toFixed(1)}`, box.x0 - 6, box.y1);
  if (!frames.length) return;
  const cols = Math.max(1, Math.floor(box.x1 - box.x0));
  const rows = frames.length;
  let peak = 0;
  for (const f of frames) for (const v of f) peak = Math.max(peak, v);
  const img = ctx.createImageData(cols, rows);
  const [c0, c50, c100] = th.heat;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = index(x, xa + ((c + 0.5) / cols) * (xb - xa));
      const v = Math.sqrt(frames[r][i] / peak);
      const [from, to, f] = v < 0.5 ? [c0, c50, v * 2] : [c50, c100, v * 2 - 1];
      const o = (r * cols + c) * 4;
      img.data[o] = from[0] + (to[0] - from[0]) * f;
      img.data[o + 1] = from[1] + (to[1] - from[1]) * f;
      img.data[o + 2] = from[2] + (to[2] - from[2]) * f;
      img.data[o + 3] = 255;
    }
  }
  const off = document.createElement('canvas');
  off.width = cols;
  off.height = rows;
  off.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  if (currentT !== null) {
    const y = box.y0 + (currentT / tMax) * (box.y1 - box.y0);
    ctx.strokeStyle = th.accent2;
    ctx.lineWidth = 1.5;
    hline(ctx, box.x0, box.x1, Math.round(y) + 0.5);
  }
}
