// Signed bars for real amplitudes (or probabilities), with an optional dashed average line
// and highlighted "marked" basis states. Returns a hit test mapping an x coordinate
// (CSS pixels, relative to the canvas) to a bar index, or -1.

import { MONO, hline, prep, yAxis } from './charts.js';

export function amplitudeBars(canvas, { theme: th, labels, values, marked, yRange, mean = null, highlight = -1 }) {
  const { ctx, w, h } = prep(canvas);
  const count = values.length;
  const x0 = 52;
  const right = 14;
  const slot = (w - x0 - right) / count;

  ctx.font = MONO;
  const labelW = ctx.measureText(`★${labels[0]}`).width;
  const rotate = labelW + 6 > slot;
  const every = rotate ? Math.max(1, Math.ceil(13 / slot)) : 1;
  const bottom = rotate ? Math.min(96, labelW * 0.72 + 24) : 30;
  const box = { x0, y0: 16, x1: w - right, y1: h - bottom };
  const Y = yAxis(ctx, box, yRange, th);
  const zero = Math.round(Y(0)) + 0.5;

  if (highlight >= 0) {
    ctx.fillStyle = th.grid;
    ctx.fillRect(box.x0 + highlight * slot, box.y0, slot, box.y1 - box.y0);
  }

  const bw = Math.max(2, Math.min(56, slot * 0.66));
  for (let i = 0; i < count; i++) {
    const cx = box.x0 + (i + 0.5) * slot;
    const top = Math.min(zero, Y(values[i]));
    const height = Math.max(values[i] === 0 ? 0 : 1, Math.abs(Y(values[i]) - zero));
    ctx.fillStyle = values[i] >= 0 ? th.ampPos : th.ampNeg;
    ctx.fillRect(cx - bw / 2, top, bw, height);
    if (marked.has(i)) {
      ctx.strokeStyle = th.marked;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(cx - bw / 2 - 2.5, top - 2.5, bw + 5, height + 5);
    }
  }

  ctx.strokeStyle = th.axis;
  ctx.lineWidth = 1.25;
  hline(ctx, box.x0, box.x1, zero);

  if (mean !== null) {
    const y = Math.round(Y(mean)) + 0.5;
    ctx.strokeStyle = th.text;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    hline(ctx, box.x0, box.x1, y);
    ctx.setLineDash([]);
    ctx.font = MONO;
    ctx.fillStyle = th.text;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('average', box.x1, y - 3);
  }

  for (let i = 0; i < count; i += every) {
    const cx = box.x0 + (i + 0.5) * slot;
    const isMarked = marked.has(i);
    const text = isMarked ? `★${labels[i]}` : labels[i];
    ctx.font = isMarked ? `bold ${MONO}` : MONO;
    ctx.fillStyle = isMarked ? th.marked : th.muted;
    if (rotate) {
      ctx.save();
      ctx.translate(cx, box.y1 + 6);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    } else {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(text, cx, box.y1 + 8);
    }
  }

  return (x) => {
    const i = Math.floor((x - box.x0) / slot);
    return i >= 0 && i < count ? i : -1;
  };
}
