// A small framework for custom lessons, so each new lesson is mostly physics and drawing.
//
// runLesson({
//   slug,
//   settings: { ... },                 initial values of every control
//   controls: [                        the Try it panel, in order
//     { id, label, type: 'range', min, max, step, format?, hint? }
//     { id, label, type: 'select' | 'choice', options: [[value, label], ...], hint? }
//     { id, label, type: 'check', hint? }
//     { type: 'button', label, primary?, onClick(api) }   an action, not a setting
//     { type: 'note', html }
//   ],
//   cards: [{ id, title, legend?, kind: 'canvas' (default) | 'html', height?, cls?, folded? }],
//   Any control may add show: (settings) => boolean to appear only when it applies.
//   steps: [{ title, html, preset?, focus?, math?, predict?, play? }]   html and math may be (api) => string
//   compute?(settings, previous) -> model     rerun whenever a setting changes
//   draw(api)                                 redraw everything from api
//   player?: { duration: (api) => seconds, speed?: number }   a play/scrub bar; api.t is the time
//   onStep?(index, api)
// })
//
// api = { settings, model, index, step, t, theme, el(id), canvas(id), set(partial), redraw(), player }
// The URL keeps the step (#step=N), the time (#t=) and any setting that differs from the step's
// preset, so a shared link reopens exactly what was on screen.

import { theme as readTheme } from './charts.js';
import { mountLesson } from './lesson.js';
import { Player } from './player.js';

const same = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-12 : a === b);

function controlHtml(c) {
  const hint = c.hint ? `<p class="hint">${c.hint}</p>` : '';
  if (c.type === 'range') {
    return `<label class="field"><span class="label">${c.label} <output data-out="${c.id}"></output></span>
      <input type="range" data-id="${c.id}" min="${c.min}" max="${c.max}" step="${c.step}"></label>${hint}`;
  }
  if (c.type === 'select') {
    return `<label class="field"><span class="label">${c.label}</span><select data-id="${c.id}">${c.options
      .map(([v, l]) => `<option value="${v}">${l}</option>`)
      .join('')}</select></label>${hint}`;
  }
  if (c.type === 'choice') {
    return `<div class="field"><span class="label">${c.label}</span><div class="chip-group" role="group" aria-label="${c.label}">${c.options
      .map(([v, l]) => `<button type="button" class="chip" data-choice="${c.id}" data-value="${v}" aria-pressed="false">${l}</button>`)
      .join('')}</div></div>${hint}`;
  }
  if (c.type === 'check') {
    return `<label class="field check-field"><input type="checkbox" data-id="${c.id}"><span>${c.label}</span></label>${hint}`;
  }
  if (c.type === 'note') return `<div class="hint">${c.html}</div>`;
  return '';
}

export function runLesson(def) {
  const stage = document.getElementById('stage');
  const trySlot = document.getElementById('try-slot');
  const defaults = { ...def.settings };
  const settings = { ...def.settings };
  const controls = def.controls ?? [];
  const steps = def.steps;
  const byId = Object.fromEntries(controls.filter((c) => c.id).map((c) => [c.id, c]));
  let index = 0;
  let model = null;
  let baseline = { ...defaults };
  let drawing = false;

  // ----- stage -----
  let playerBox = null;
  if (def.player) {
    playerBox = document.createElement('div');
    stage.append(playerBox);
  }
  const els = {};
  for (const card of def.cards ?? []) {
    const fig = document.createElement('figure');
    fig.className = `panel card${card.cls ? ` ${card.cls}` : ''}`;
    if (card.folded) fig.dataset.defaultFolded = 'true';
    fig.innerHTML = `<figcaption class="card-head"><h2>${card.title}</h2><span class="legend">${card.legend ?? ''}</span></figcaption>`;
    let body;
    if (card.kind === 'html') {
      body = document.createElement('div');
      body.className = 'card-body';
    } else {
      body = document.createElement('canvas');
      body.className = 'chart';
      body.style.height = `${card.height ?? 260}px`;
      body.setAttribute('role', 'img');
      body.setAttribute('aria-label', card.title);
    }
    body.id = card.id;
    fig.append(body);
    stage.append(fig);
    els[card.id] = body;
  }

  // ----- try it -----
  const visible = controls.filter((c) => c.type !== 'hidden');
  if (visible.length) {
    const tc = document.createElement('div');
    tc.className = 'panel try-card';
    tc.innerHTML = `<h2>Try it</h2>${visible
      .map((c, i) =>
        c.type === 'button'
          ? `<button type="button" class="btn${c.primary ? ' btn-primary' : ''} kit-action" data-action="${i}">${c.label}</button>`
          : `<div class="param-group" data-ctl="${i}">${controlHtml(c)}</div>`,
      )
      .join('')}`;
    const actions = [...tc.querySelectorAll('.kit-action')];
    if (actions.length) {
      const row = document.createElement('div');
      row.className = 'row kit-actions';
      actions.forEach((b) => row.append(b));
      tc.append(row);
    }
    trySlot.append(tc);
    tc.addEventListener('input', (e) => {
      const input = e.target.closest('[data-id]');
      if (!input) return;
      const c = byId[input.dataset.id];
      let v;
      if (c.type === 'range') v = Number(input.value);
      else if (c.type === 'check') v = input.checked;
      else v = c.options.find(([o]) => String(o) === input.value)?.[0] ?? input.value;
      api.set({ [c.id]: v });
    });
    tc.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-choice]');
      if (chip) {
        const c = byId[chip.dataset.choice];
        api.set({ [c.id]: c.options.find(([o]) => String(o) === chip.dataset.value)[0] });
        return;
      }
      const action = e.target.closest('[data-action]');
      if (action) visible[Number(action.dataset.action)].onClick(api);
    });
  }

  function syncControls() {
    visible.forEach((c, i) => {
      if (!c.show) return;
      const group = trySlot.querySelector(`[data-ctl="${i}"]`);
      if (group) group.hidden = !c.show(settings);
    });
    for (const c of controls) {
      if (!c.id) continue;
      const v = settings[c.id];
      if (c.type === 'choice') {
        trySlot.querySelectorAll(`[data-choice="${c.id}"]`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === String(v))));
        continue;
      }
      const input = trySlot.querySelector(`[data-id="${c.id}"]`);
      if (!input) continue;
      if (c.type === 'check') input.checked = Boolean(v);
      else if (document.activeElement !== input || c.type !== 'range') input.value = String(v);
      const out = trySlot.querySelector(`[data-out="${c.id}"]`);
      if (out) out.textContent = c.format ? c.format(v, settings) : String(v);
    }
  }

  // ----- state, hash -----
  function writeHash() {
    const p = new URLSearchParams();
    if (index > 0) p.set('step', index + 1);
    for (const [k, v] of Object.entries(settings)) if (!same(v, baseline[k])) p.set(k, String(v));
    if (player && player.t > 0 && !player.playing) p.set('t', player.t.toFixed(2));
    history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  }

  function recompute() {
    if (def.compute) model = def.compute({ ...settings }, model);
    if (player) {
      player.setDuration(Math.max(1e-6, def.player.duration(api)));
      player.speed = def.player.speed ?? player.duration / 12;
    }
  }

  const lesson = mountLesson({ slug: def.slug, onNavigate: (i) => enterStep(i) });

  const value = (v) => (typeof v === 'function' ? v(api) : v);
  function redraw() {
    if (drawing) return;
    drawing = true;
    try {
      api.theme = readTheme();
      api.step = steps[index];
      def.draw(api);
      lesson.render(
        steps.map((s, i) =>
          i === index ? { title: s.title, html: value(s.html), focus: s.focus, math: value(s.math), predict: s.predict } : { title: s.title, html: '' },
        ),
        index,
      );
    } finally {
      drawing = false;
    }
  }

  const api = {
    settings,
    get model() {
      return model;
    },
    get index() {
      return index;
    },
    step: steps[0],
    t: 0,
    theme: null,
    player: null,
    el: (id) => els[id] ?? document.getElementById(id),
    canvas: (id) => els[id],
    set(partial, { silent = false } = {}) {
      Object.assign(settings, partial);
      syncControls();
      recompute();
      writeHash();
      if (!silent) redraw();
    },
    redraw,
  };

  const player = def.player
    ? new Player(playerBox, {
        duration: 10,
        onTime: (time) => {
          api.t = time;
          redraw();
        },
      })
    : null;
  api.player = player;

  function enterStep(i, overrides = {}) {
    index = i;
    baseline = { ...defaults, ...(steps[i].preset ?? {}) };
    Object.assign(settings, baseline, overrides);
    syncControls();
    player?.pause();
    recompute();
    def.onStep?.(i, api);
    if (player) player.seek(0);
    else redraw();
    writeHash();
    if (steps[i].play && player) player.play();
  }

  window.addEventListener('themechange', redraw);
  new ResizeObserver(() => redraw()).observe(stage);

  // Opening a link: the step, then any settings it carries, then the time.
  const hash = new URLSearchParams(location.hash.slice(1));
  const first = Math.max(0, Math.min(steps.length - 1, (Number(hash.get('step')) || 1) - 1));
  const overrides = {};
  for (const [k, raw] of hash) {
    if (!(k in defaults)) continue;
    const c = byId[k];
    const d = defaults[k];
    let v;
    if (typeof d === 'number') v = Number(raw);
    else if (typeof d === 'boolean') v = raw === 'true';
    else v = raw;
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    if (c?.type === 'range') v = Math.max(c.min, Math.min(c.max, v));
    if ((c?.type === 'select' || c?.type === 'choice') && !c.options.some(([o]) => String(o) === String(v))) continue;
    if (c?.options) v = c.options.find(([o]) => String(o) === String(v))[0];
    overrides[k] = v;
  }
  enterStep(first, overrides);
  if (player && Number(hash.get('t')) > 0) {
    player.pause();
    player.seek(Math.min(player.duration, Number(hash.get('t'))));
  }
  return api;
}

// Text helpers shared by the new lessons.
export const fmt = (v, d = 2) => (Math.abs(v) < 1e-12 ? '0' : v.toFixed(d).replace('-', '−'));
