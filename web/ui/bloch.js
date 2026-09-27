// A Bloch sphere drawn on a canvas in simple 3D (orthographic projection). Drag to turn it,
// double-click to reset the view. The caller sets the arrow and redraws.

import { FONT, MONO, prep, theme as readTheme } from './charts.js';

const LABELS = [
  [[0, 0, 1], '|0⟩'],
  [[0, 0, -1], '|1⟩'],
  [[1, 0, 0], '|+⟩'],
  [[-1, 0, 0], '|−⟩'],
  [[0, 1, 0], '|+i⟩'],
  [[0, -1, 0], '|−i⟩'],
];

export class BlochView {
  constructor(canvas, { yaw = -0.62, pitch = 0.3, labels = 'all', names = null, title = '', interactive = true } = {}) {
    this.canvas = canvas;
    this.home = { yaw, pitch };
    this.yaw = yaw;
    this.pitch = pitch;
    this.labels = labels;
    // Optional replacement text for the six axis labels, in the order of LABELS.
    this.names = names;
    this.title = title;
    this.vector = [0, 0, 1];
    this.trail = [];
    // Extra thin arrows, e.g. the individual spins of an ensemble.
    this.others = [];
    this.axis = null;
    this.axisLabel = '';
    this.note = '';
    if (interactive) this.enableDrag();
  }

  enableDrag() {
    let last = null;
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.style.cursor = 'grab';
    c.addEventListener('pointerdown', (e) => {
      last = [e.clientX, e.clientY];
      c.setPointerCapture(e.pointerId);
      c.style.cursor = 'grabbing';
    });
    c.addEventListener('pointermove', (e) => {
      if (!last) return;
      this.yaw -= (e.clientX - last[0]) * 0.01;
      this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch + (e.clientY - last[1]) * 0.01));
      last = [e.clientX, e.clientY];
      this.draw();
    });
    const end = () => {
      last = null;
      c.style.cursor = 'grab';
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('dblclick', () => {
      this.yaw = this.home.yaw;
      this.pitch = this.home.pitch;
      this.draw();
    });
  }

  // Screen position and depth (positive = towards the viewer) of a point on or in the sphere.
  project([x, y, z], cx, cy, R) {
    const cyaw = Math.cos(this.yaw);
    const syaw = Math.sin(this.yaw);
    const x1 = x * cyaw - y * syaw;
    const y1 = x * syaw + y * cyaw;
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    return { sx: cx + R * y1, sy: cy - R * (z * cp - x1 * sp), depth: x1 * cp + z * sp };
  }

  draw(th = readTheme()) {
    const { ctx, w, h } = prep(this.canvas);
    const small = Math.min(w, h) < 200;
    const margin = this.labels === 'none' ? 10 : small ? 22 : 34;
    const R = Math.max(20, Math.min(w, h) / 2 - margin);
    const cx = w / 2;
    const cy = h / 2 + (this.title ? 6 : 0);
    const P = (v) => this.project(v, cx, cy, R);

    const glow = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    glow.addColorStop(0, withAlpha(th.accent2, 0.16));
    glow.addColorStop(1, withAlpha(th.exact, 0.04));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = th.axis;
    ctx.lineWidth = 1.25;
    ctx.stroke();

    const circle = (fn, alphaBack, alphaFront) => {
      let prev = null;
      for (let i = 0; i <= 96; i++) {
        const p = P(fn((i / 96) * 2 * Math.PI));
        if (prev) {
          ctx.strokeStyle = withAlpha(th.muted, p.depth < 0 ? alphaBack : alphaFront);
          ctx.setLineDash(p.depth < 0 ? [3, 4] : []);
          ctx.beginPath();
          ctx.moveTo(prev.sx, prev.sy);
          ctx.lineTo(p.sx, p.sy);
          ctx.stroke();
        }
        prev = p;
      }
      ctx.setLineDash([]);
    };
    ctx.lineWidth = 1;
    circle((t) => [Math.cos(t), Math.sin(t), 0], 0.25, 0.6);
    circle((t) => [Math.cos(t), 0, Math.sin(t)], 0.12, 0.25);
    circle((t) => [0, Math.cos(t), Math.sin(t)], 0.12, 0.25);

    for (const [v] of LABELS) {
      const a = P(v);
      ctx.strokeStyle = withAlpha(th.muted, 0.35);
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(a.sx, a.sy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (this.labels !== 'none') {
      ctx.font = small ? `10px ${MONO_FAMILY}` : MONO;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      LABELS.forEach(([v, ket], i) => {
        const label = this.names?.[i] ?? ket;
        if (this.labels === 'poles' && v[2] === 0) return;
        const p = P(v.map((c) => c * (small ? 1.2 : 1.17)));
        ctx.fillStyle = p.depth < -0.3 ? withAlpha(th.muted, 0.5) : th.muted;
        ctx.fillText(label, p.sx, p.sy);
      });
    }

    if (this.axis) {
      const a = P(this.axis.map((c) => c * 1.2));
      const b = P(this.axis.map((c) => -c * 1.2));
      ctx.strokeStyle = th.marked;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(b.sx, b.sy);
      ctx.lineTo(a.sx, a.sy);
      ctx.stroke();
      ctx.setLineDash([]);
      if (this.axisLabel) {
        ctx.font = FONT;
        ctx.fillStyle = th.marked;
        ctx.textAlign = 'left';
        ctx.fillText(this.axisLabel, a.sx + 6, a.sy);
      }
    }

    if (this.trail.length > 1) {
      ctx.lineWidth = 2;
      for (let i = 1; i < this.trail.length; i++) {
        const p0 = P(this.trail[i - 1]);
        const p1 = P(this.trail[i]);
        ctx.strokeStyle = withAlpha(th.accent2, 0.15 + 0.5 * (i / this.trail.length));
        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        ctx.lineTo(p1.sx, p1.sy);
        ctx.stroke();
      }
    }

    if (this.others.length) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = withAlpha(th.exact, 0.55);
      for (const v of this.others) {
        const p = P(v);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(p.sx, p.sy);
        ctx.stroke();
      }
    }

    const [x, y, z] = this.vector;
    const len = Math.hypot(x, y, z);
    const tip = P(this.vector);
    const foot = P([x, y, 0]);
    ctx.strokeStyle = withAlpha(th.accent2, 0.45);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(tip.sx, tip.sy);
    ctx.lineTo(foot.sx, foot.sy);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    if (len > 0.03) {
      ctx.save();
      ctx.shadowColor = th.accent2;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = th.accent2;
      ctx.lineWidth = small ? 2.5 : 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tip.sx, tip.sy);
      ctx.stroke();
      ctx.fillStyle = th.accent2;
      ctx.beginPath();
      ctx.arc(tip.sx, tip.sy, small ? 4 : 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = th.accent2;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.fillStyle = th.text;
    ctx.font = small ? `600 12px ${SANS_FAMILY}` : `600 13px ${SANS_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    if (this.title) ctx.fillText(this.title, 4, 2);
    if (this.note) {
      ctx.font = small ? `11px ${SANS_FAMILY}` : FONT;
      ctx.fillStyle = th.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(this.note, cx, h - 2);
    }
    this.lastTheme = th;
  }
}

const MONO_FAMILY = '"JetBrains Mono", ui-monospace, Consolas, monospace';
const SANS_FAMILY = 'Inter, system-ui, sans-serif';

// Accepts #rgb/#rrggbb or rgb()/rgba() colors from CSS custom properties.
export function withAlpha(color, alpha) {
  const c = color.trim();
  if (c.startsWith('#')) {
    let hex = c.slice(1);
    if (hex.length === 3) hex = [...hex].map((ch) => ch + ch).join('');
    const v = parseInt(hex.slice(0, 6), 16);
    return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`;
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(',').map((s) => parseFloat(s));
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return c;
}
