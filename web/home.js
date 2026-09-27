import { rotateVector, rotationOf } from './lib/bloch.js';
import { SECTIONS, TOPICS } from './lib/catalog.js';
import { GATES, rx, ry } from './lib/circuit.js';
import { BlochView } from './ui/bloch.js';
import { href, mountShell } from './ui/shell.js';

mountShell();

function topicCard(t, index) {
  const live = t.status === 'live';
  const tag = live ? '' : '<span class="tag">Coming soon</span>';
  const minutes = t.minutes ? `<span>${t.minutes} min</span>` : '';
  const body = `
    <span class="topic-num">${String(index + 1).padStart(2, '0')}</span>
    <svg class="topic-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="${t.icon}"/></svg>
    <h4>${t.title}</h4>
    <p>${t.summary}</p>
    <div class="meta"><span class="tag${live ? ' live' : ''}">${t.level}</span>${minutes}${tag}</div>`;
  return live
    ? `<a class="topic-card" href="${href(t.slug)}">${body}</a>`
    : `<div class="topic-card soon" aria-disabled="true">${body}</div>`;
}

function renderPath() {
  document.getElementById('path-list').innerHTML = SECTIONS.map((s) => {
    const cards = TOPICS.filter((t) => t.section === s.id).map(topicCard).join('');
    return `<div class="path-section">
      <div class="path-head"><span class="ket">${s.ket}</span><h3>${s.title}</h3><p>${s.blurb}</p></div>
      <div class="topic-grid">${cards}</div>
    </div>`;
  }).join('');
  const live = TOPICS.filter((t) => t.status === 'live');
  document.getElementById('live-count').textContent = String(live.length);
  const first = live.find((t) => t.section !== 'tools') ?? live[0];
  if (first) document.getElementById('start').href = href(first.slug);
}

const AXIS_NAMES = [
  [[1, 0, 0], 'x'],
  [[0, 1, 0], 'y'],
  [[0, 0, 1], 'z'],
  [[Math.SQRT1_2, 0, Math.SQRT1_2], 'x+z'],
];

function describeRotation({ axis, angle }) {
  const named = AXIS_NAMES.find(([a]) => Math.abs(a[0] * axis[0] + a[1] * axis[1] + a[2] * axis[2]) > 0.999);
  const deg = Math.round((angle * 180) / Math.PI);
  return `turns the arrow ${deg}° about ${named ? `the ${named[1]} axis` : 'a tilted axis'}`;
}

function animateHero() {
  const canvas = document.getElementById('hero-bloch');
  const label = document.getElementById('hero-gate');
  const view = new BlochView(canvas, { yaw: -0.7, pitch: 0.32 });
  const sequence = [
    ['H', GATES.H],
    ['S', GATES.S],
    ['H', GATES.H],
    ['T', GATES.T],
    ['Rx(π/3)', rx(Math.PI / 3)],
    ['Y', GATES.Y],
    ['Ry(π/2)', ry(Math.PI / 2)],
    ['H', GATES.H],
  ].map(([name, g]) => ({ name, ...rotationOf(g) }));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    view.vector = rotateVector([1, 0, 0], [0, 0, 1], Math.PI / 4);
    label.innerHTML = 'The state <b>(|0⟩ + e<sup>iπ/4</sup>|1⟩)/√2</b>';
    view.draw();
    window.addEventListener('themechange', () => view.draw());
    new ResizeObserver(() => view.draw()).observe(canvas);
    return;
  }

  const TURN_MS = 1700;
  const PAUSE_MS = 900;
  let index = 0;
  let start = null;
  let from = [0, 0, 1];
  let visible = true;
  let last = null;

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(canvas);

  const frame = (now) => {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) {
      last = null;
      return;
    }
    if (last !== null) view.yaw += ((now - last) / 1000) * 0.12;
    last = now;
    if (start === null) {
      start = now;
      const g = sequence[index];
      label.innerHTML = `Applying <b>${g.name}</b>: ${describeRotation(g)}`;
      view.axis = g.axis;
      view.axisLabel = g.name;
    }
    const g = sequence[index];
    const t = Math.min(1, (now - start) / TURN_MS);
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    view.vector = rotateVector(from, g.axis, g.angle * eased);
    view.trail.push(view.vector);
    if (view.trail.length > 90) view.trail.shift();
    if (now - start > TURN_MS) view.axis = null;
    if (now - start > TURN_MS + PAUSE_MS) {
      from = rotateVector(from, g.axis, g.angle);
      index = (index + 1) % sequence.length;
      start = null;
    }
    view.draw();
  };
  requestAnimationFrame(frame);
}

renderPath();
animateHero();
