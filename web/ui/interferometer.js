// A Mach-Zehnder interferometer drawn on an optical table: source, two beam splitters, two
// mirrors, a phase shifter and optional shutter, polarisation tag or bomb in the arms, and two
// detectors. Amplitudes are drawn as small dials (size = probability, hand = phase), and a photon
// in flight is drawn as a glow in both arms at once, with brightness set by its probability.
//
// Layout: the photon enters from the left into splitter 1 (bottom left). Arm a goes straight on
// (right), hits a mirror and goes up into splitter 2. Arm b is reflected up, hits a mirror and goes
// right into splitter 2. D1 is to the right of splitter 2, D2 above it.

import { withAlpha } from './bloch.js';
import { FONT, MONO, prep } from './charts.js';
import { phaseColor } from './dials.js';

export function layout(w, h) {
  const x1 = Math.max(120, w * 0.26);
  const x2 = Math.min(w - 150, w * 0.66);
  const y1 = h - 70;
  const y2 = 110;
  return { x0: 30, x1, x2, y1, y2, d1: [x2 + 110, y2], d2: [x2, y2 - 72] };
}

function dial(ctx, x, y, [re, im], th, label) {
  const p = re * re + im * im;
  const R = 15;
  ctx.fillStyle = withAlpha(th.surface || '#000', 0.85);
  ctx.strokeStyle = withAlpha(th.muted, 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
  if (p > 1e-9) {
    const ph = Math.atan2(im, re);
    ctx.fillStyle = phaseColor(ph, 0.85);
    ctx.beginPath();
    ctx.arc(x, y, R * Math.sqrt(p), 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = th.text;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + R * Math.cos(ph), y - R * Math.sin(ph));
    ctx.stroke();
  }
  if (label) {
    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x, y + R + 3);
  }
}

// state: { amps: { a, b, out1, out2 } as [re, im] (out1/out2 null when not coherent),
//   pD1, pD2, pBlocked, phi, block, markDeg, secondSplitter, bomb: null | 'live' | 'dud' | 'unknown',
//   packet: null | t in [0, 1], outcome: null | 'D1' | 'D2' | 'blocked', counts: { D1, D2, blocked } }
export function drawInterferometer(canvas, th, s) {
  const { ctx, w, h } = prep(canvas);
  const L = layout(w, h);
  const pa = s.amps.a[0] ** 2 + s.amps.a[1] ** 2;
  const pb = s.amps.b[0] ** 2 + s.amps.b[1] ** 2;
  const blockedA = s.block === 'a';
  const blockedB = s.block === 'b';
  const stopA = [(L.x1 + L.x2) / 2, L.y1];
  const stopB = [L.x1, (L.y1 + L.y2) / 2];

  // beams: width by probability
  const beam = (pts, p) => {
    if (p < 1e-9) return;
    ctx.strokeStyle = withAlpha(th.marked, 0.18 + 0.5 * p);
    ctx.lineWidth = 1.5 + 8 * p;
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  beam([[L.x0, L.y1], [L.x1, L.y1]], 1);
  if (s.hideAmps) {
    // Don't give the answer away: draw both arms alike and no outputs.
    beam([[L.x1, L.y1], [L.x2, L.y1], [L.x2, L.y2]], 0.5);
    beam([[L.x1, L.y1], [L.x1, L.y2], [L.x2, L.y2]], 0.5);
  } else {
  // the incoming amplitude on a blocked arm is still drawn up to the block (or bomb)
  const pa0 = blockedA ? pBefore(s, 'a') : pa;
  const pb0 = blockedB ? pBefore(s, 'b') : pb;
  beam(blockedA ? [[L.x1, L.y1], stopA] : [[L.x1, L.y1], [L.x2, L.y1], [L.x2, L.y2]], pa0);
  beam(blockedB ? [[L.x1, L.y1], stopB] : [[L.x1, L.y1], [L.x1, L.y2], [L.x2, L.y2]], pb0);
  if (s.secondSplitter) {
    beam([[L.x2, L.y2], L.d1], s.pD1);
    beam([[L.x2, L.y2], L.d2], s.pD2);
  } else {
    if (!blockedB) beam([[L.x2, L.y2], L.d1], s.pD1);
    if (!blockedA) beam([[L.x2, L.y2], L.d2], s.pD2);
  }
  }
  ctx.lineCap = 'butt';

  // optics
  const splitter = (x, y, on = true) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = on ? withAlpha(th.accent2, 0.45) : 'transparent';
    ctx.strokeStyle = on ? th.accent2 : withAlpha(th.muted, 0.6);
    ctx.setLineDash(on ? [] : [3, 3]);
    ctx.lineWidth = 1.5;
    ctx.fillRect(-20, -3, 40, 6);
    ctx.strokeRect(-20, -3, 40, 6);
    ctx.restore();
    ctx.setLineDash([]);
  };
  const mirror = (x, y) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = th.text;
    ctx.fillRect(-20, -3, 40, 6);
    ctx.restore();
  };
  splitter(L.x1, L.y1);
  splitter(L.x2, L.y2, s.secondSplitter);
  mirror(L.x2, L.y1);
  mirror(L.x1, L.y2);
  // source
  ctx.fillStyle = th.marked;
  ctx.beginPath();
  ctx.roundRect(L.x0 - 22, L.y1 - 14, 26, 28, 5);
  ctx.fill();
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('single photons', L.x0 - 22, L.y1 + 18);
  // phase shifter on arm b
  if (s.phi !== undefined) {
    const py = (L.y2 + stopB[1]) / 2;
    ctx.fillStyle = withAlpha(th.accent, 0.35);
    ctx.strokeStyle = th.accent;
    ctx.lineWidth = 1.5;
    ctx.fillRect(L.x1 - 16, py - 10, 32, 20);
    ctx.strokeRect(L.x1 - 16, py - 10, 32, 20);
    ctx.fillStyle = th.text;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`phase φ = ${Math.round((s.phi * 180) / Math.PI)}°`, L.x1 - 22, py);
  }
  // polarisation tag on arm b
  if (s.markDeg) {
    const tx = (L.x1 + L.x2) / 2 - 40;
    ctx.strokeStyle = th.marked;
    ctx.lineWidth = 2;
    ctx.strokeRect(tx - 10, L.y2 - 12, 20, 24);
    ctx.font = MONO;
    ctx.fillStyle = th.marked;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`tag ${s.markDeg}°`, tx, L.y2 - 16);
  }
  // shutter
  const shutter = ([x, y]) => {
    ctx.fillStyle = th.ampNeg;
    ctx.fillRect(x - 6, y - 14, 12, 28);
  };
  if (blockedA && !s.bomb) shutter(stopA);
  if (blockedB && !s.bomb) shutter(stopB);
  // bomb on arm b
  if (s.bomb) drawBomb(ctx, stopB, s.bomb, s.outcome === 'blocked' && s.packet === null ? 'boom' : null, th);

  // detectors
  const det = ([x, y], name, count, lit) => {
    ctx.fillStyle = lit ? th.marked : withAlpha(th.muted, 0.25);
    ctx.strokeStyle = th.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.font = `600 13px Inter, system-ui, sans-serif`;
    ctx.fillStyle = lit ? '#05060d' : th.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x, y);
    ctx.font = MONO;
    ctx.fillStyle = th.text;
    ctx.textAlign = 'left';
    ctx.fillText(`${count} clicks`, x + 24, y);
  };
  det(L.d1, 'D1', s.counts.D1, s.packet === null && s.outcome === 'D1');
  det(L.d2, 'D2', s.counts.D2, s.packet === null && s.outcome === 'D2');

  // amplitude dials
  if (s.hideAmps) {
    // nothing to show
  } else if (!blockedA) dial(ctx, L.x2 + 34, (L.y1 + L.y2) / 2 + 30, s.amps.a, th, 'arm a');
  else dial(ctx, stopA[0] - 50, L.y1 - 34, s.amps.a0 ?? [0, 0], th, 'arm a');
  if (s.hideAmps) {
    // nothing to show
  } else if (!blockedB) dial(ctx, (L.x1 + L.x2) / 2 + 30, L.y2 + 34, s.amps.b, th, 'arm b');
  else dial(ctx, L.x1 + 34, stopB[1] + 48, s.amps.b0 ?? [0, 0], th, 'arm b');
  if (s.amps.out1 && !s.hideAmps) dial(ctx, (L.x2 + L.d1[0]) / 2, L.y2 + 32, s.amps.out1, th, 'to D1');
  if (s.amps.out2 && !s.hideAmps) dial(ctx, L.x2 - 34, (L.y2 + L.d2[1]) / 2, s.amps.out2, th, 'to D2');

  // photon in flight: a glow in every place it could be, by probability
  if (s.packet !== null && s.packet !== undefined) {
    const t = s.packet;
    const glow = (x, y, p) => {
      if (p < 1e-6) return;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
      g.addColorStop(0, withAlpha(th.text, Math.min(1, 0.25 + p)));
      g.addColorStop(1, withAlpha(th.marked, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, 2 * Math.PI);
      ctx.fill();
    };
    const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    if (t < 0.2) glow(...lerp([L.x0, L.y1], [L.x1, L.y1], t / 0.2), 1);
    else if (t < 0.75) {
      const u = (t - 0.2) / 0.55;
      const pA = s.hideAmps ? 0.5 : blockedA ? pBefore(s, 'a') : pa;
      const pB = s.hideAmps ? 0.5 : blockedB ? pBefore(s, 'b') : pb;
      const along = (pts, stop) => {
        // position u along a polyline; null once past a stop
        const segs = pts.slice(1).map((p, i) => [pts[i], p, Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])]);
        const len = segs.reduce((q, sg) => q + sg[2], 0);
        let dist = u * len;
        for (const [a, b, l] of segs) {
          if (dist <= l) {
            const pt = lerp(a, b, dist / l);
            if (stop && Math.hypot(pt[0] - L.x1, pt[1] - L.y1) > Math.hypot(stop[0] - L.x1, stop[1] - L.y1)) return null;
            return pt;
          }
          dist -= l;
        }
        return pts[pts.length - 1];
      };
      const ptA = along([[L.x1, L.y1], [L.x2, L.y1], [L.x2, L.y2]], blockedA && !s.hideAmps ? stopA : null);
      const ptB = along([[L.x1, L.y1], [L.x1, L.y2], [L.x2, L.y2]], blockedB && !s.hideAmps ? stopB : null);
      if (ptA) glow(...ptA, pA);
      if (ptB) glow(...ptB, pB);
    } else if (!s.hideAmps) {
      const u = (t - 0.75) / 0.25;
      glow(...lerp([L.x2, L.y2], L.d1, u), s.pD1);
      glow(...lerp([L.x2, L.y2], L.d2, u), s.pD2);
    }
  }
}

// Probability that reaches a blocked arm (before the block absorbs it).
function pBefore(s, arm) {
  const amp = arm === 'a' ? s.amps.a0 : s.amps.b0;
  return amp ? amp[0] ** 2 + amp[1] ** 2 : 0.5;
}

function drawBomb(ctx, [x, y], kind, state, th) {
  ctx.save();
  if (state === 'boom') {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 2 * Math.PI;
      ctx.strokeStyle = k % 2 ? th.ampNeg : th.marked;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 10 * Math.cos(a), y + 10 * Math.sin(a));
      ctx.lineTo(x + 30 * Math.cos(a), y + 30 * Math.sin(a));
      ctx.stroke();
    }
    ctx.font = '700 14px Inter, system-ui, sans-serif';
    ctx.fillStyle = th.ampNeg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('BOOM', x + 34, y);
    ctx.restore();
    return;
  }
  ctx.fillStyle = th.text;
  ctx.beginPath();
  ctx.arc(x, y + 4, 13, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = th.marked;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 7, y - 6);
  ctx.quadraticCurveTo(x + 14, y - 18, x + 22, y - 14);
  ctx.stroke();
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(kind === 'unknown' ? 'bomb: live or dud?' : kind === 'live' ? 'live bomb' : 'dud', x - 20, y + 4);
  ctx.restore();
}
