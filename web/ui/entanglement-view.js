// Entanglement at a glance for a multi-qubit statevector: how entangled each qubit is with all
// the others (entropy, 0 to 1 bit), and how entangled each pair is on its own (concurrence).
// A pair can show zero concurrence while every qubit has a full bit of entropy: then the
// entanglement is shared by the whole group, as in a GHZ state.

import { concurrenceMatrix, entanglementEntropy } from '../lib/entanglement.js';
import { FONT, MONO, prep } from './charts.js';
import { withAlpha } from './bloch.js';

export function drawEntanglement(canvas, { theme: th, state, labels = [] }) {
  const { ctx, w, h } = prep(canvas);
  const n = state.n;
  const name = (q) => labels[q] ?? `q${q}`;
  const entropy = Array.from({ length: n }, (_, q) => entanglementEntropy(state, [q]));
  const conc = concurrenceMatrix(state);

  // Left: entropy bars.
  const split = Math.min(w * 0.5, Math.max(240, w - 260));
  const box = { x0: 70, y0: 24, x1: split - 16, y1: h - 18 };
  const row = (box.y1 - box.y0) / n;
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('entanglement with the rest (bits)', box.x0, 2);
  for (let q = 0; q < n; q++) {
    const y = box.y0 + q * row;
    const bh = Math.min(16, row * 0.6);
    ctx.fillStyle = withAlpha(th.muted, 0.15);
    ctx.fillRect(box.x0, y + (row - bh) / 2, box.x1 - box.x0, bh);
    ctx.fillStyle = th.accent2;
    ctx.fillRect(box.x0, y + (row - bh) / 2, (box.x1 - box.x0) * Math.min(1, entropy[q]), bh);
    ctx.font = MONO;
    ctx.fillStyle = th.text;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(name(q).length > 8 ? `q${q}` : name(q), box.x0 - 8, y + row / 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = entropy[q] > 0.55 ? th.surfaceSolid : th.text;
    ctx.fillText(entropy[q].toFixed(2), box.x0 + 6, y + row / 2);
  }

  // Right: pairwise concurrence grid.
  const gx = split + 34;
  const size = Math.max(40, Math.min(w - gx - 10, h - 44));
  const cell = size / n;
  const gy = 24;
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('pairs on their own (concurrence)', split + 10, 2);
  ctx.font = MONO;
  for (let a = 0; a < n; a++) {
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${a}`, gx - 6, gy + (a + 0.5) * cell);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${a}`, gx + (a + 0.5) * cell, gy + size + 14);
    for (let b = 0; b < n; b++) {
      const x = gx + b * cell;
      const y = gy + a * cell;
      if (a === b) {
        ctx.fillStyle = withAlpha(th.muted, 0.08);
        ctx.fillRect(x, y, cell, cell);
        continue;
      }
      const c = conc[a * n + b];
      ctx.fillStyle = withAlpha(th.marked, 0.08 + 0.92 * c);
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      if (cell > 26 && c > 0.005) {
        ctx.fillStyle = c > 0.5 ? th.surfaceSolid : th.text;
        ctx.textBaseline = 'middle';
        ctx.fillText(c.toFixed(2), x + cell / 2, y + cell / 2);
      }
    }
  }
  return { entropy, conc };
}
