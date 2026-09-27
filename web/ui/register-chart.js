// Probability of each value of a register (0, 1, 2, ...) as bars, with optional labels under
// each bar, a highlighted value and a vertical marker (for example the true answer).

import { FONT, MONO, hline, prep, yAxis } from './charts.js';

export function registerChart(canvas, { theme: th, probs, labels, highlight = -1, marker = null, markerLabel = '' }) {
  const { ctx, w, h } = prep(canvas);
  const count = probs.length;
  const box = { x0: 44, y0: 14, x1: w - 12, y1: h - (labels ? 40 : 26) };
  const Y = yAxis(ctx, box, [0, 1], th);
  const slot = (box.x1 - box.x0) / count;
  const bw = Math.max(3, Math.min(40, slot * 0.66));
  for (let v = 0; v < count; v++) {
    const cx = box.x0 + (v + 0.5) * slot;
    ctx.fillStyle = v === highlight ? th.accent2 : th.exact;
    ctx.fillRect(cx - bw / 2, Y(probs[v]), bw, box.y1 - Y(probs[v]));
    ctx.font = MONO;
    ctx.fillStyle = v === highlight ? th.accent2 : th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(v), cx, box.y1 + 5);
    if (labels) {
      ctx.fillStyle = th.muted;
      ctx.fillText(labels[v], cx, box.y1 + 20);
    }
  }
  ctx.strokeStyle = th.axis;
  hline(ctx, box.x0, box.x1, Math.round(box.y1) + 0.5);
  if (marker !== null) {
    const x = box.x0 + (marker + 0.5) * slot;
    ctx.strokeStyle = th.marked;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, box.y0);
    ctx.lineTo(x, box.y1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = FONT;
    ctx.fillStyle = th.marked;
    ctx.textAlign = x > w * 0.7 ? 'right' : 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(markerLabel, x + (x > w * 0.7 ? -6 : 6), box.y0);
  }
}
