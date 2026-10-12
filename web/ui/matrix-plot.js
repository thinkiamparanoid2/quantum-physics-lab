// A density matrix (or any complex matrix) drawn as a grid: each entry is a disc whose area is
// its size relative to the largest entry and whose colour is its phase (the site's phase wheel).
// Rows and columns are labelled with kets in reading order (qubit 0 first).

import { ket, ketOrder } from '../lib/circuit.js';
import { MONO, prep } from './charts.js';
import { phaseColor } from './dials.js';

export function drawMatrix(canvas, { theme: th, re, im, dim, n = Math.round(Math.log2(dim)), max = null }) {
  const { ctx, w, h } = prep(canvas);
  const order = ketOrder(n);
  const pad = n > 2 ? 46 : 40;
  const size = Math.min(w - pad - 8, h - pad - 8);
  const cell = size / dim;
  const x0 = pad + (w - pad - 8 - size) / 2;
  const y0 = pad;
  let top = max ?? 0;
  if (max === null) for (let i = 0; i < dim * dim; i++) top = Math.max(top, Math.hypot(re[i], im[i]));
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  order.forEach((b, i) => {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(ket(b, n), x0 - 6, y0 + (i + 0.5) * cell);
    ctx.save();
    ctx.translate(x0 + (i + 0.5) * cell, y0 - 6);
    ctx.rotate(dim > 4 ? -Math.PI / 4 : 0);
    ctx.textAlign = dim > 4 ? 'left' : 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(ket(b, n), 0, 0);
    ctx.restore();
  });
  order.forEach((a, i) => {
    order.forEach((b, j) => {
      const x = x0 + j * cell;
      const y = y0 + i * cell;
      ctx.strokeStyle = th.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      const v = Math.hypot(re[a * dim + b], im[a * dim + b]);
      if (top <= 0 || v < 1e-9) return;
      ctx.beginPath();
      ctx.arc(x + cell / 2, y + cell / 2, Math.sqrt(v / top) * cell * 0.44, 0, 2 * Math.PI);
      ctx.fillStyle = phaseColor(Math.atan2(im[a * dim + b], re[a * dim + b]), 0.9);
      ctx.fill();
    });
  });
}
