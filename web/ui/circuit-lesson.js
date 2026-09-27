// Generic engine for lessons built from circuits. A lesson definition supplies its steps
// (each with the circuit to show and how many of its ops have been applied) and chooses
// which views to show; this module renders the circuit, amplitude dials, state formula,
// per-qubit Bloch spheres, a measurement sampler and any custom canvas views.
//
// def = {
//   slug, n, labels?: [...qubit names],
//   params?: [{ id, label, type: 'range' | 'select', min, max, step, value, options, format }],
//   build(params) -> [{ title, html: string | (ctx) => string, ops, until, highlight? }],
//   bloch?: true | [qubits], sampler?: boolean, dials?: boolean (default true),
//   views?: [{ title, legend?, caption?, height?, draw(canvas, ctx) } | { title, legend?, mount(el) -> { draw(ctx) } }],
//   reroll?: false to hide "Measure again" when the lesson's measurements are deterministic,
// }

import { blochVector } from '../lib/bloch.js';
import { probabilities, runOps, seededRandom } from '../lib/circuit.js';
import { formatState } from '../lib/format.js';
import { BlochView } from './bloch.js';
import { theme } from './charts.js';
import { drawCircuit } from './circuit-view.js';
import { drawDials, drawPhaseWheel } from './dials.js';
import { mountLesson } from './lesson.js';
import { Sampler } from './sampler.js';

const ANIM_MS = 650;

function card(stage, title, legend = '') {
  const fig = document.createElement('figure');
  fig.className = 'panel card';
  fig.innerHTML = `<figcaption class="card-head"><h2>${title}</h2><span class="legend">${legend}</span></figcaption>`;
  stage.append(fig);
  return fig;
}

export function runCircuitLesson(def) {
  const stage = document.getElementById('stage');
  const trySlot = document.getElementById('try-slot');
  const n = def.n;
  const params = Object.fromEntries((def.params ?? []).map((p) => [p.id, p.value]));
  const hash = new URLSearchParams(location.hash.slice(1));
  for (const p of def.params ?? []) {
    if (!hash.has(p.id)) continue;
    const v = p.type === 'select' ? hash.get(p.id) : Number(hash.get(p.id));
    if (p.type === 'select' ? p.options.some((o) => String(o.value) === v) : Number.isFinite(v)) params[p.id] = v;
  }
  let seed = Number(hash.get('seed')) >>> 0 || (Math.random() * 2 ** 32) >>> 0;
  let steps = def.build(params);
  let index = Math.max(0, Math.min(steps.length - 1, (Number(hash.get('step')) || 1) - 1));
  let anim = null;
  let circuitKey = '';
  let version = 0;

  const lesson = mountLesson({ slug: def.slug, sandbox: def.sandbox, onNavigate: (i) => go(i) });

  // ----- stage -----
  const circuitCard = card(stage, 'Circuit', 'Click any gate to jump to that point');
  const circuitBox = document.createElement('div');
  circuitBox.className = 'circuit-scroll';
  circuitCard.append(circuitBox);

  let dialsCanvas = null;
  let formula = null;
  let bitsBox = null;
  if (def.dials !== false) {
    const stateCard = card(
      stage,
      'State',
      '<canvas class="phase-wheel" width="18" height="18" aria-hidden="true"></canvas> disc size = probability, colour and hand = phase',
    );
    formula = document.createElement('p');
    formula.className = 'state-formula';
    dialsCanvas = document.createElement('canvas');
    dialsCanvas.className = 'chart';
    dialsCanvas.setAttribute('role', 'img');
    dialsCanvas.setAttribute('aria-label', 'Amplitude of each basis state');
    bitsBox = document.createElement('div');
    bitsBox.className = 'bits';
    stateCard.append(formula, dialsCanvas, bitsBox);
  }

  const blochQubits = def.bloch === true ? Array.from({ length: n }, (_, q) => q) : def.bloch || [];
  const blochViews = [];
  if (blochQubits.length) {
    const c = card(stage, n === 1 ? 'Bloch sphere' : 'Each qubit on its own', n === 1 ? 'drag to turn it' : 'a shorter arrow means the qubit is entangled with the others');
    const row = document.createElement('div');
    row.className = 'bloch-row';
    c.append(row);
    for (const q of blochQubits) {
      const canvas = document.createElement('canvas');
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `Bloch sphere of qubit ${q}`);
      row.append(canvas);
      blochViews.push(new BlochView(canvas, { title: def.labels?.[q] ?? `q${q}`, labels: n > 2 ? 'poles' : 'all' }));
    }
  }

  let sampler = null;
  if (def.sampler) {
    const c = card(stage, 'Measure every qubit', 'samples the state at the current step');
    const box = document.createElement('div');
    c.append(box);
    sampler = new Sampler(box);
  }

  const customViews = (def.views ?? []).map((v) => {
    const c = card(stage, v.title, v.legend ?? '');
    if (v.mount) {
      const box = document.createElement('div');
      c.append(box);
      return { ...v, instance: v.mount(box) };
    }
    const canvas = document.createElement('canvas');
    canvas.className = 'chart';
    canvas.style.height = `${v.height ?? 240}px`;
    c.append(canvas);
    let caption = null;
    if (v.caption) {
      caption = document.createElement('p');
      caption.className = 'hint';
      c.append(caption);
    }
    return { ...v, canvas, caption };
  });

  // ----- try-it controls -----
  const hasMeasurement = () => def.reroll !== false && steps.some((s) => s.ops.some((op) => op.gate === 'MEASURE'));
  if (def.params?.length || hasMeasurement()) {
    const tc = document.createElement('div');
    tc.className = 'panel try-card';
    tc.innerHTML = '<h2>Try it</h2>';
    for (const p of def.params ?? []) {
      const group = document.createElement('div');
      group.className = 'param-group';
      if (p.type === 'select') {
        group.innerHTML = `<label class="field"><span class="label">${p.label}</span><select>${p.options
          .map((o) => `<option value="${o.value}">${o.label}</option>`)
          .join('')}</select></label>`;
        const sel = group.querySelector('select');
        sel.value = String(params[p.id]);
        sel.addEventListener('change', () => setParam(p.id, sel.value));
      } else {
        group.innerHTML = `<label class="field"><span class="label">${p.label}<output></output></span>
          <input type="range" min="${p.min}" max="${p.max}" step="${p.step}"></label>`;
        const input = group.querySelector('input');
        const out = group.querySelector('output');
        input.value = String(params[p.id]);
        out.textContent = p.format ? p.format(params[p.id]) : String(params[p.id]);
        input.addEventListener('input', () => {
          out.textContent = p.format ? p.format(Number(input.value)) : input.value;
          setParam(p.id, Number(input.value));
        });
      }
      if (p.hint) group.insertAdjacentHTML('beforeend', `<p class="hint">${p.hint}</p>`);
      tc.append(group);
    }
    if (hasMeasurement()) {
      const reroll = document.createElement('div');
      reroll.className = 'param-group';
      reroll.innerHTML = `<button type="button" class="btn">Measure again</button>
        <p class="hint">Mid-circuit measurements are random. This draws new outcomes for the whole run.</p>`;
      reroll.querySelector('button').addEventListener('click', () => {
        seed = (Math.random() * 2 ** 32) >>> 0;
        anim = null;
        circuitKey = '';
        writeHash();
        render();
      });
      tc.append(reroll);
    }
    trySlot.append(tc);
  }

  function setParam(id, value) {
    params[id] = value;
    steps = def.build(params);
    index = Math.min(index, steps.length - 1);
    anim = null;
    version++;
    circuitKey = '';
    writeHash();
    render();
  }

  function compute(i) {
    const s = steps[i];
    const run = runOps(n, s.ops, s.until, seededRandom(seed));
    return { ...run, probs: probabilities(run.state) };
  }

  function writeHash() {
    const p = new URLSearchParams();
    if (index > 0) p.set('step', index + 1);
    for (const d of def.params ?? []) if (params[d.id] !== d.value) p.set(d.id, params[d.id]);
    if (hasMeasurement()) p.set('seed', seed);
    history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  }

  function go(i) {
    const prev = index;
    index = i;
    const a = steps[prev];
    const b = steps[i];
    const measuredBetween = a.ops === b.ops && a.ops.slice(Math.min(a.until, b.until), Math.max(a.until, b.until)).some((op) => op.gate === 'MEASURE');
    anim = a.ops === b.ops && Math.abs(a.until - b.until) <= 2 && !measuredBetween ? { from: shown, start: performance.now() } : null;
    writeHash();
    render();
  }

  let shown = null;

  function displayedState(target) {
    if (!anim || !anim.from) return target.state;
    const f = Math.min(1, (performance.now() - anim.start) / ANIM_MS);
    if (f >= 1) {
      anim = null;
      return target.state;
    }
    const e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
    const { re: r0, im: i0 } = anim.from;
    const { re: r1, im: i1 } = target.state;
    const re = r1.map((v, k) => r0[k] + (v - r0[k]) * e);
    const im = i1.map((v, k) => i0[k] + (v - i0[k]) * e);
    let norm = 0;
    for (let k = 0; k < re.length; k++) norm += re[k] * re[k] + im[k] * im[k];
    if (norm < 1e-6) return target.state;
    const s = 1 / Math.sqrt(norm);
    return { n, dim: re.length, re: re.map((v) => v * s), im: im.map((v) => v * s) };
  }

  function render() {
    const th = theme();
    const step = steps[index];
    const target = compute(index);
    const state = displayedState(target);
    shown = { re: Float64Array.from(state.re), im: Float64Array.from(state.im) };
    const ctx = { state: target.state, bits: target.bits, probs: target.probs, params, step, index, n, theme: th, shownState: state };

    lesson.render(
      steps.map((s, i) => ({ title: s.title, html: i === index ? (typeof s.html === 'function' ? s.html(ctx) : s.html) : '' })),
      index,
    );

    const key = `${index}|${version}|${seed}`;
    if (key !== circuitKey) {
      circuitKey = key;
      const prev = steps[index - 1];
      const from = prev && prev.ops === step.ops ? Math.min(prev.until, step.until) : step.until;
      const current = step.highlight ?? Array.from({ length: Math.max(0, step.until - from) }, (_, k) => from + k);
      drawCircuit(circuitBox, {
        n,
        ops: step.ops,
        applied: step.until,
        current,
        labels: def.labels,
        onSelect: (op) => {
          const j = steps.findIndex((s) => s.ops === step.ops && s.until > op);
          if (j >= 0 && j !== index) go(j);
        },
      });
      if (formula) {
        formula.innerHTML = `<span class="label">State</span>${formatState(target.state.re, target.state.im, n)}`;
      }
      if (bitsBox) {
        const bits = Object.entries(target.bits);
        bitsBox.innerHTML = bits.map(([b, v]) => `<span class="bit-chip">m${b} = <b>${v}</b></span>`).join('');
      }
    }

    if (dialsCanvas) {
      drawDials(dialsCanvas, { theme: th, re: state.re, im: state.im, n });
      const wheel = stage.querySelector('.phase-wheel');
      if (wheel && !wheel.dataset.drawn) {
        drawPhaseWheel(wheel);
        wheel.dataset.drawn = '1';
      }
    }
    blochViews.forEach((view, k) => {
      const v = blochVector(state, blochQubits[k]);
      view.vector = v;
      const len = Math.hypot(...v);
      view.note = n > 1 ? (len < 0.02 ? 'no direction of its own' : len < 0.995 ? `arrow length ${len.toFixed(2)}` : '') : '';
      view.draw(th);
    });
    if (sampler) {
      sampler.setDistribution(target.probs, n, `${index}|${version}|${seed}`);
      sampler.draw(th);
    }
    for (const v of customViews) {
      if (v.instance) {
        v.instance.draw(ctx);
        continue;
      }
      v.draw(v.canvas, ctx);
      if (v.caption) v.caption.innerHTML = typeof v.caption === 'function' ? v.caption(ctx) : v.caption;
    }
    if (anim) requestAnimationFrame(render);
  }

  window.addEventListener('themechange', () => {
    const wheel = stage.querySelector('.phase-wheel');
    if (wheel) delete wheel.dataset.drawn;
    render();
  });
  new ResizeObserver(() => render()).observe(stage);
  render();
  return { params, render };
}
