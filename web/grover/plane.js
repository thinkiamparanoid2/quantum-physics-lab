// The two-dimensional picture of Grover's search: the state is a unit vector in the plane
// spanned by "unmarked" (right) and "marked" (up). The oracle reflects it across the
// horizontal axis; diffusion reflects it across the starting direction |s>.

import { FONT, MONO, prep } from '../ui/charts.js';

function arrow(ctx, x0, y0, x1, y1, color, width) {
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const head = 7 + width * 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - Math.cos(angle) * head * 0.6, y1 - Math.sin(angle) * head * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(angle - 0.4), y1 - head * Math.sin(angle - 0.4));
  ctx.lineTo(x1 - head * Math.cos(angle + 0.4), y1 - head * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
}

export function drawPlane(canvas, { theme: th, point, trail, theta, note }) {
  const { ctx, w, h } = prep(canvas);
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.max(20, Math.min(w, h) / 2 - 36);
  const P = (x, y) => [cx + r * x, cy - r * y];

  ctx.strokeStyle = th.grid;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.stroke();

  ctx.strokeStyle = th.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - r - 10, cy);
  ctx.lineTo(cx + r + 10, cy);
  ctx.moveTo(cx, cy + r + 10);
  ctx.lineTo(cx, cy - r - 10);
  ctx.stroke();

  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('unmarked', cx + r + 10, cy + 5);
  ctx.fillStyle = th.marked;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('★ marked', cx + 6, cy - r - 12);

  const [sx, sy] = P(Math.cos(theta), Math.sin(theta));
  ctx.strokeStyle = th.muted;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(cx - (sx - cx), cy - (sy - cy));
  ctx.lineTo(sx, sy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('start |s⟩', sx + 4, sy - 2);

  ctx.strokeStyle = th.muted;
  ctx.beginPath();
  ctx.arc(cx, cy, 34, -theta, 0);
  ctx.stroke();
  ctx.font = MONO;
  ctx.textBaseline = 'middle';
  ctx.fillText('θ', cx + 38, cy - 34 * Math.sin(theta / 2) - 2);

  for (const t of trail) {
    const [tx, ty] = P(t.x, t.y);
    ctx.globalAlpha = 0.3;
    arrow(ctx, cx, cy, tx, ty, th.ampPos, 1.5);
    ctx.globalAlpha = 1;
  }

  if (point) {
    const [px, py] = P(point.x, point.y);
    ctx.strokeStyle = th.marked;
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    arrow(ctx, cx, cy, px, py, th.ampPos, 3);
  } else if (note) {
    ctx.font = FONT;
    ctx.fillStyle = th.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(note, cx, cy + r / 2);
  }
}
