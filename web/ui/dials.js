// Amplitude dials: one per basis state. The filled disc's area is the probability, and its
// colour and hand show the phase, so complex amplitudes become something you can see.

import { ket, ketOrder } from '../lib/circuit.js';
import { percent } from '../lib/format.js';
import { MONO, prep } from './charts.js';

const isLight = () => document.documentElement.dataset.theme === 'light';

// Phase 0 is cyan, then around the colour wheel: pi/2 violet, pi red, -pi/2 green.
export function phaseColor(phi, alpha = 1) {
  const hue = (((187 + (phi * 180) / Math.PI) % 360) + 360) % 360;
  return `hsla(${hue.toFixed(1)}, 85%, ${isLight() ? 45 : 62}%, ${alpha})`;
}

export function drawDials(canvas, { theme: th, re, im, n, highlight = -1, maxWidth = 118 }) {
  const dim = re.length;
  const width = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
  const minCell = dim > 16 ? 60 : 86;
  const cols = Math.max(1, Math.min(dim, Math.floor(width / minCell)));
  const cellW = Math.min(maxWidth, width / cols);
  const r = Math.min(cellW * 0.36, 44);
  const cellH = 2 * r + 46;
  const rows = Math.ceil(dim / cols);
  const height = rows * cellH + 4;
  if (canvas.style.height !== `${height}px`) canvas.style.height = `${height}px`;
  const { ctx } = prep(canvas);
  const offset = (width - cols * cellW) / 2;

  ketOrder(n).forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = offset + (col + 0.5) * cellW;
    const cy = row * cellH + r + 8;
    const mag = Math.hypot(re[b], im[b]);
    const phi = Math.atan2(im[b], re[b]);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fillStyle = th.empty;
    ctx.fill();
    ctx.lineWidth = b === highlight ? 3 : 1.25;
    ctx.strokeStyle = b === highlight ? th.accent2 : th.axis;
    ctx.stroke();

    if (mag > 1e-4) {
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.5, r * mag), 0, 2 * Math.PI);
      ctx.fillStyle = phaseColor(phi, 0.9);
      ctx.fill();
      ctx.save();
      ctx.strokeStyle = th.text;
      ctx.globalAlpha = Math.min(1, 0.35 + mag);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(phi), cy - r * Math.sin(phi));
      ctx.stroke();
      ctx.restore();
    }

    ctx.font = `600 ${MONO}`;
    ctx.fillStyle = mag > 1e-4 ? th.text : th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(ket(b, n), cx, cy + r + 7);
    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    ctx.fillText(percent(mag * mag), cx, cy + r + 22);
  });
}

// A small colour wheel for the legend: which colour means which phase.
export function drawPhaseWheel(canvas) {
  const { ctx, w, h } = prep(canvas);
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2 - 1;
  for (let a = 0; a < 360; a += 3) {
    const t0 = (a * Math.PI) / 180;
    const t1 = ((a + 4) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -t1, -t0);
    ctx.closePath();
    ctx.fillStyle = phaseColor(t0);
    ctx.fill();
  }
}
