// Repeated measurement: draw outcomes from a probability vector and compare the observed
// frequencies with the predicted probabilities.

import { ket, ketOrder, sampleOutcome } from '../lib/circuit.js';
import { percent } from '../lib/format.js';
import { MONO, hline, prep, yAxis } from './charts.js';

export class Sampler {
  // numeric: outcomes are register values (most significant bit first), listed 0, 1, 2, ...
  constructor(container, { labelFor, numeric = false } = {}) {
    this.labelFor = labelFor;
    this.numeric = numeric;
    container.innerHTML = `
      <div class="sampler-controls">
        <button type="button" class="btn btn-primary" data-shots="1">Measure</button>
        <button type="button" class="btn" data-shots="100">×100</button>
        <button type="button" class="btn" data-shots="1000">×1000</button>
        <button type="button" class="btn" data-clear>Clear</button>
        <span class="readout" aria-live="polite"></span>
      </div>
      <canvas class="chart" role="img" aria-label="Measured counts compared with predicted probabilities"></canvas>
      <p class="hint"><span class="key block"></span> measured frequency <span class="key outline"></span> predicted probability</p>`;
    this.canvas = container.querySelector('canvas');
    this.readout = container.querySelector('.readout');
    this.counts = new Map();
    this.total = 0;
    this.last = -1;
    this.probs = null;
    this.n = 1;
    this.key = '';
    container.querySelectorAll('[data-shots]').forEach((b) =>
      b.addEventListener('click', () => this.measure(Number(b.dataset.shots))),
    );
    container.querySelector('[data-clear]').addEventListener('click', () => this.clear());
  }

  setDistribution(probs, n, key) {
    this.probs = probs;
    this.n = n;
    if (key !== this.key) {
      this.key = key;
      this.clear(false);
    }
  }

  clear(redraw = true) {
    this.counts = new Map();
    this.total = 0;
    this.last = -1;
    if (redraw) this.draw();
  }

  measure(shots) {
    for (let i = 0; i < shots; i++) {
      const b = sampleOutcome(this.probs, Math.random());
      this.counts.set(b, (this.counts.get(b) ?? 0) + 1);
      this.total++;
      this.last = b;
    }
    this.draw();
  }

  label(b) {
    if (this.labelFor) return this.labelFor(b);
    return this.numeric ? `|${b.toString(2).padStart(this.n, '0')}⟩` : ket(b, this.n);
  }

  draw(th) {
    if (!this.probs) return;
    th ??= this.lastTheme;
    this.lastTheme = th;
    const all = this.numeric ? Array.from({ length: this.probs.length }, (_, b) => b) : ketOrder(this.n);
    const order = all.filter((b) => this.probs[b] > 1e-9 || this.counts.has(b));
    this.readout.innerHTML = this.total
      ? `Last result: <b>${this.label(this.last)}</b> · ${this.total.toLocaleString()} measurement${this.total === 1 ? '' : 's'}`
      : 'Press Measure to sample outcomes';

    const { ctx, w, h } = prep(this.canvas);
    const box = { x0: 44, y0: 12, x1: w - 10, y1: h - 30 };
    const Y = yAxis(ctx, box, [0, 1], th);
    const slot = (box.x1 - box.x0) / Math.max(1, order.length);
    const bw = Math.max(6, Math.min(64, slot * 0.6));
    order.forEach((b, i) => {
      const cx = box.x0 + (i + 0.5) * slot;
      const freq = this.total ? (this.counts.get(b) ?? 0) / this.total : 0;
      ctx.fillStyle = b === this.last ? th.accent2 : th.exact;
      ctx.fillRect(cx - bw / 2, Y(freq), bw, box.y1 - Y(freq));
      ctx.strokeStyle = th.trotter;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - bw / 2 - 3, Y(this.probs[b]), bw + 6, box.y1 - Y(this.probs[b]));
      ctx.font = MONO;
      ctx.fillStyle = th.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(this.label(b), cx, box.y1 + 6);
      if (this.total) {
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = th.text;
        ctx.fillText(percent(freq), cx, Math.min(Y(freq), Y(this.probs[b])) - 3);
      }
    });
    ctx.strokeStyle = th.axis;
    hline(ctx, box.x0, box.x1, Math.round(box.y1) + 0.5);
  }
}
