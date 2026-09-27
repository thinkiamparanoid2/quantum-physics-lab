// Small canvas chart helpers: line chart, space-time heatmap, bar chart.
// Colors come from CSS custom properties so charts follow the page's light/dark theme.

export const FONT = '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const MONO = '11px ui-monospace, "Cascadia Code", Consolas, monospace';

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function theme() {
  const s = getComputedStyle(document.documentElement);
  const v = (k) => s.getPropertyValue(k).trim();
  return {
    text: v('--text'),
    muted: v('--muted'),
    grid: v('--grid'),
    axis: v('--axis'),
    surface: v('--surface'),
    exact: v('--exact'),
    trotter: v('--trotter'),
    cursor: v('--cursor'),
    ampPos: v('--amp-pos'),
    ampNeg: v('--amp-neg'),
    marked: v('--marked'),
    empty: v('--heat-empty'),
    heat: [hexToRgb(v('--heat-0')), hexToRgb(v('--heat-50')), hexToRgb(v('--heat-100'))],
  };
}

export function prep(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function ticks(min, max, count) {
  const raw = (max - min) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const values = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) {
    values.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return { values, step };
}

function fmt(v, step) {
  if (v === 0) return '0';
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return decimals > 4 ? v.toExponential(0) : v.toFixed(decimals);
}

export function hline(ctx, x0, x1, y) {
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}

export function yAxis(ctx, box, yr, th) {
  const Y = (v) => box.y1 - ((v - yr[0]) / (yr[1] - yr[0])) * (box.y1 - box.y0);
  const yt = ticks(yr[0], yr[1], Math.max(2, Math.floor((box.y1 - box.y0) / 42)));
  ctx.font = FONT;
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of yt.values) {
    const y = Math.round(Y(v)) + 0.5;
    ctx.strokeStyle = th.grid;
    hline(ctx, box.x0, box.x1, y);
    ctx.fillStyle = th.muted;
    ctx.fillText(fmt(v, yt.step), box.x0 - 6, y);
  }
  return Y;
}

function timeAxis(ctx, box, tMax, th) {
  return xAxis(ctx, box, [0, tMax], th);
}

export function xAxis(ctx, box, [lo, hi], th, { integer = false } = {}) {
  const X = (t) => box.x0 + ((t - lo) / (hi - lo)) * (box.x1 - box.x0);
  const xt = ticks(lo, hi, Math.max(2, Math.floor((box.x1 - box.x0) / 80)));
  if (integer && xt.step < 1) {
    xt.step = 1;
    xt.values = [];
    for (let v = Math.ceil(lo); v <= hi; v++) xt.values.push(v);
  }
  ctx.font = FONT;
  ctx.strokeStyle = th.axis;
  ctx.lineWidth = 1;
  hline(ctx, box.x0, box.x1, Math.round(box.y1) + 0.5);
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const v of xt.values) {
    const x = Math.round(X(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, box.y1);
    ctx.lineTo(x, box.y1 + 4);
    ctx.stroke();
    ctx.fillText(fmt(v, xt.step), x, box.y1 + 7);
  }
  return X;
}

function cursorLine(ctx, box, x, th) {
  ctx.strokeStyle = th.cursor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(x) + 0.5, box.y0);
  ctx.lineTo(Math.round(x) + 0.5, box.y1);
  ctx.stroke();
}

function range(series, yMin, yMax) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of series) {
    for (const v of s.v) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (yMin !== undefined) lo = Math.min(lo, yMin);
  if (!(hi - lo > 1e-9)) {
    if (yMin !== undefined) return [yMin, yMin + 0.01];
    return [lo - 0.5, hi + 0.5];
  }
  const pad = (hi - lo) * 0.08;
  return [yMin !== undefined ? yMin : lo - pad, hi + pad];
}

export function lineChart(canvas, { theme: th, series, tMax, reveal, yMin }) {
  const { ctx, w, h } = prep(canvas);
  const box = { x0: 52, y0: 10, x1: w - 14, y1: h - 26 };
  const Y = yAxis(ctx, box, range(series, yMin), th);
  const X = timeAxis(ctx, box, tMax, th);

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x0 - 5, box.y0 - 5, box.x1 - box.x0 + 10, box.y1 - box.y0 + 10);
  ctx.clip();
  for (const s of series) {
    let last = -1;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width ?? 2;
    ctx.lineJoin = 'round';
    ctx.setLineDash(s.dash ?? []);
    ctx.beginPath();
    for (let i = 0; i < s.t.length && s.t[i] <= reveal + 1e-9; i++) {
      if (i === 0) ctx.moveTo(X(s.t[i]), Y(s.v[i]));
      else ctx.lineTo(X(s.t[i]), Y(s.v[i]));
      last = i;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = s.color;
    if (s.dots && s.t.length <= 121) {
      for (let i = 0; i <= last; i++) {
        ctx.beginPath();
        ctx.arc(X(s.t[i]), Y(s.v[i]), 2.5, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    if (last >= 0) {
      ctx.beginPath();
      ctx.arc(X(s.t[last]), Y(s.v[last]), 4.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = th.surface;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.restore();
  cursorLine(ctx, box, X(reveal), th);
}

function heatColor(v, [c0, c50, c100]) {
  const a = Math.max(0, Math.min(1, v));
  const [from, to, f] = a < 0.5 ? [c0, c50, a * 2] : [c50, c100, a * 2 - 1];
  const c = (i) => Math.round(from[i] + (to[i] - from[i]) * f);
  return `rgb(${c(0)},${c(1)},${c(2)})`;
}

// Values in [0, 1]. Rows are qubits (qubit 0 on top), columns are time; each sample holds
// until the next one.
export function heatmap(canvas, { theme: th, times, values, n, tMax, reveal }) {
  const { ctx, w, h } = prep(canvas);
  const box = { x0: 52, y0: 6, x1: w - 14, y1: h - 26 };
  const X = (t) => box.x0 + (t / tMax) * (box.x1 - box.x0);
  const rowH = (box.y1 - box.y0) / n;

  ctx.fillStyle = th.empty;
  ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  for (let j = 0; j < times.length && times[j] <= reveal + 1e-9; j++) {
    const right = Math.min(j + 1 < times.length ? times[j + 1] : tMax, reveal);
    const xa = Math.floor(X(times[j]));
    const xb = Math.ceil(X(right));
    if (xb <= xa) continue;
    for (let q = 0; q < n; q++) {
      ctx.fillStyle = heatColor(values[j * n + q], th.heat);
      ctx.fillRect(xa, box.y0 + q * rowH, xb - xa + 1, rowH + 0.5);
    }
  }

  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const every = Math.max(1, Math.ceil(14 / rowH));
  for (let q = 0; q < n; q += every) ctx.fillText(`q${q}`, box.x0 - 8, box.y0 + (q + 0.5) * rowH);
  timeAxis(ctx, box, tMax, th);
  cursorLine(ctx, box, X(reveal), th);
}

export function barChart(canvas, { theme: th, labels, exact, trotter, yMax }) {
  const { ctx, w, h } = prep(canvas);
  ctx.font = MONO;
  const labelW = Math.max(...labels.map((l) => ctx.measureText(l).width));
  const slotGuess = (w - 66) / labels.length;
  const rotate = labelW + 8 > slotGuess;
  const bottom = rotate ? Math.min(110, labelW * 0.72 + 18) : 26;
  const box = { x0: 52, y0: 10, x1: w - 14, y1: h - bottom };
  const Y = yAxis(ctx, box, [0, yMax], th);

  const slot = (box.x1 - box.x0) / labels.length;
  const bw = Math.max(2, Math.min(44, slot * 0.62));
  labels.forEach((label, i) => {
    const cx = box.x0 + (i + 0.5) * slot;
    ctx.fillStyle = th.exact;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(cx - bw / 2, Y(exact[i]), bw, box.y1 - Y(exact[i]));
    ctx.globalAlpha = 1;
    ctx.strokeStyle = th.trotter;
    ctx.lineWidth = 2;
    const yt = Y(trotter[i]);
    ctx.strokeRect(cx - bw / 2 - 3, yt, bw + 6, box.y1 - yt);

    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    if (rotate) {
      ctx.save();
      ctx.translate(cx, box.y1 + 6);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    } else {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, cx, box.y1 + 7);
    }
  });
  ctx.strokeStyle = th.axis;
  ctx.lineWidth = 1;
  hline(ctx, box.x0, box.x1, Math.round(box.y1) + 0.5);
}
