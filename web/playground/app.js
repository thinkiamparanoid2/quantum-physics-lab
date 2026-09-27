import { ParseError, parsePauliSum, parseState, qubitCount, toPauliTerms } from '../lib/pauli.js';
import { PRESETS } from './presets.js';
import { MAX_QUBITS, circuitCost, makeOperator, productState, simulate } from '../lib/dynamics.js';
import { barChart, heatmap, lineChart, theme } from '../ui/charts.js';

const $ = (id) => document.getElementById(id);
const ui = {
  preset: $('preset'),
  presetDesc: $('preset-desc'),
  h: $('hamiltonian'),
  state: $('state'),
  obs: $('observable'),
  time: $('time'),
  steps: $('steps'),
  stepsOut: $('steps-out'),
  order: $('order'),
  stats: $('stats'),
  play: $('play'),
  scrub: $('scrub'),
  clock: $('clock'),
  speed: $('speed'),
  heatSource: $('heat-source'),
  obsTitle: $('obs-title'),
  barsTitle: $('bars-title'),
  share: $('share'),
  heatCanvas: $('heatmap'),
};
const fields = {
  h: [ui.h, $('h-error')],
  state: [ui.state, $('state-error')],
  obs: [ui.obs, $('obs-error')],
  time: [ui.time, $('time-error')],
};
const canvases = { obs: $('obs-chart'), heat: ui.heatCanvas, bars: $('bars'), error: $('error-chart') };

let result = null;
let tNow = 0;
let playing = false;
let lastTs = null;
let observableName = '';

function setError(field, message) {
  const [input, box] = fields[field];
  box.textContent = message;
  box.hidden = !message;
  input.classList.toggle('invalid', Boolean(message));
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function fail(field, err) {
  if (!(err instanceof ParseError)) throw err;
  setError(field, err.message);
  return false;
}

function ket(b, n) {
  let s = '';
  for (let q = 0; q < n; q++) s += (b >> q) & 1;
  return `|${s}⟩`;
}

function compute() {
  for (const f of Object.keys(fields)) setError(f, '');

  let H;
  let n;
  try {
    const parsed = parsePauliSum(ui.h.value);
    n = qubitCount(parsed);
    if (n === 0) throw new ParseError('The Hamiltonian needs at least one X, Y or Z operator');
    if (n > MAX_QUBITS) {
      throw new ParseError(`That's ${n} qubits. This in-browser simulator handles up to ${MAX_QUBITS}`);
    }
    H = makeOperator(toPauliTerms(parsed, n), n);
  } catch (e) {
    return fail('h', e);
  }

  let chars;
  try {
    chars = parseState(ui.state.value, n);
  } catch (e) {
    return fail('state', e);
  }

  let O;
  let label;
  const obsText = ui.obs.value.trim();
  try {
    if (obsText.toUpperCase() === 'H') {
      O = H;
      label = 'Energy ⟨H⟩';
    } else {
      const text = obsText === '' ? 'Z0' : obsText;
      O = makeOperator(toPauliTerms(parsePauliSum(text), n), n);
      const compact = text.replace(/\s+/g, ' ');
      label = `⟨${compact.length > 48 ? `${compact.slice(0, 45)}…` : compact}⟩`;
    }
  } catch (e) {
    return fail('obs', e);
  }

  const totalTime = Number(ui.time.value);
  if (!(totalTime > 0 && totalTime <= 200)) {
    return fail('time', new ParseError('Total time must be between 0 and 200'));
  }

  const steps = Number(ui.steps.value);
  const order = Number(ui.order.value);
  const started = performance.now();
  result = simulate({ H, O, psi0: productState(chars), totalTime, steps, order });
  const ms = performance.now() - started;
  for (const s of [result.exact, result.trotter]) s.p1 = s.z.map((z) => (1 - z) / 2);

  const cost = circuitCost(H.terms, order);
  ui.stats.innerHTML = `
    <div><b>${n}</b> qubit${n === 1 ? '' : 's'} · <b>${H.terms.length}</b> Pauli terms · <b>${H.dim.toLocaleString()}</b> amplitudes</div>
    <div>One Trotter step: <b>${cost.rotations}</b> rotations, ≈<b>${cost.cnots}</b> CNOTs</div>
    <div>Full circuit (${steps} steps): ≈<b>${(cost.cnots * steps).toLocaleString()}</b> CNOTs</div>
    <div class="muted">Simulated in ${ms < 1 ? '<1' : Math.round(ms)} ms</div>`;

  ui.obsTitle.textContent = observableName
    ? observableName[0].toUpperCase() + observableName.slice(1)
    : label;
  ui.obsTitle.title = label;
  ui.heatCanvas.style.height = `${Math.max(120, Math.min(300, n * 24 + 40))}px`;
  tNow = Math.min(tNow, totalTime);
  writeHash();
  render();
  return true;
}

function render() {
  if (!result) return;
  const r = result;
  const T = r.totalTime;
  const th = theme();
  ui.clock.textContent = `t = ${tNow.toFixed(2)} / ${T.toFixed(2)}`;
  ui.scrub.value = String(Math.round((tNow / T) * 1000));

  lineChart(canvases.obs, {
    theme: th,
    tMax: T,
    reveal: tNow,
    series: [
      { t: r.exact.times, v: r.exact.obs, color: th.exact, width: 2.25 },
      { t: r.trotter.times, v: r.trotter.obs, color: th.trotter, width: 1.5, dash: [5, 4], dots: true },
    ],
  });

  const source = ui.heatSource.value === 'trotter' ? r.trotter : r.exact;
  heatmap(canvases.heat, { theme: th, times: source.times, values: source.p1, n: r.n, tMax: T, reveal: tNow });

  const je = Math.min(r.frames, Math.round((tNow / T) * r.frames));
  const jt = Math.min(r.steps, Math.floor(tNow / r.dt + 1e-9));
  const pe = r.exact.probs.subarray(je * r.dim, (je + 1) * r.dim);
  const pt = r.trotter.probs.subarray(jt * r.dim, (jt + 1) * r.dim);
  let idx = Array.from({ length: r.dim }, (_, b) => b);
  if (r.dim > 32) {
    idx.sort((a, b) => pe[b] - pe[a]);
    idx = idx.slice(0, 16).sort((a, b) => a - b);
    ui.barsTitle.textContent = `Most likely measurement outcomes (top 16 of ${r.dim.toLocaleString()})`;
  } else {
    ui.barsTitle.textContent = 'Measurement probabilities';
  }
  barChart(canvases.bars, {
    theme: th,
    labels: idx.map((b) => ket(b, r.n)),
    exact: idx.map((b) => pe[b]),
    trotter: idx.map((b) => pt[b]),
    yMax: Math.min(1, Math.max(0.05, r.maxProb * 1.05)),
  });

  lineChart(canvases.error, {
    theme: th,
    tMax: T,
    reveal: tNow,
    yMin: 0,
    series: [{ t: r.trotter.times, v: r.trotter.infidelity, color: th.trotter, width: 1.75, dots: true }],
  });
}

function setPlaying(p) {
  playing = p;
  if (p && result && tNow >= result.totalTime) tNow = 0;
  ui.play.textContent = p ? 'Pause' : 'Play';
  ui.play.setAttribute('aria-pressed', String(p));
}

function loop(ts) {
  if (playing && result) {
    if (lastTs !== null) {
      tNow += ((ts - lastTs) / (Number(ui.speed.value) * 1000)) * result.totalTime;
      if (tNow >= result.totalTime) {
        tNow = result.totalTime;
        setPlaying(false);
      }
    }
    lastTs = ts;
    render();
  } else {
    lastTs = null;
  }
  requestAnimationFrame(loop);
}

function applyValues(v) {
  ui.h.value = v.hamiltonian;
  ui.state.value = v.state;
  ui.obs.value = v.observable;
  ui.time.value = String(v.time);
  ui.steps.value = String(v.steps);
  ui.order.value = String(v.order);
  ui.stepsOut.textContent = ui.steps.value;
}

function applyPreset(id) {
  const preset = PRESETS.find((p) => p.id === id);
  ui.preset.value = id;
  ui.presetDesc.textContent = preset.description;
  observableName = preset.observableName;
  applyValues(preset.build());
  tNow = 0;
  if (compute()) setPlaying(true);
}

function markCustom() {
  if (ui.preset.value !== 'custom') {
    ui.preset.value = 'custom';
    ui.presetDesc.textContent = 'Your own Hamiltonian. Copy the link to share exactly this setup.';
    observableName = '';
  }
}

function writeHash() {
  const p = new URLSearchParams();
  if (ui.preset.value !== 'custom') {
    p.set('preset', ui.preset.value);
  } else {
    p.set('h', ui.h.value);
    p.set('psi', ui.state.value);
    p.set('obs', ui.obs.value);
    p.set('T', ui.time.value);
  }
  p.set('steps', ui.steps.value);
  p.set('order', ui.order.value);
  history.replaceState(null, '', `#${p.toString()}`);
}

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const preset = PRESETS.find((x) => x.id === p.get('preset'));
  if (preset) {
    ui.preset.value = preset.id;
    ui.presetDesc.textContent = preset.description;
    observableName = preset.observableName;
    applyValues(preset.build());
  } else if (p.has('h')) {
    markCustom();
    applyValues({
      hamiltonian: p.get('h'),
      state: p.get('psi') ?? '',
      observable: p.get('obs') ?? '',
      time: p.get('T') ?? 5,
      steps: 40,
      order: 1,
    });
  } else {
    return false;
  }
  const steps = Number(p.get('steps'));
  if (steps >= 1 && steps <= 200) ui.steps.value = String(Math.round(steps));
  if (p.get('order') === '1' || p.get('order') === '2') ui.order.value = p.get('order');
  ui.stepsOut.textContent = ui.steps.value;
  return true;
}

function debounce(fn, ms) {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

function init() {
  for (const p of PRESETS) ui.preset.add(new Option(p.name, p.id));
  ui.preset.add(new Option('Custom', 'custom'));

  const recomputeSoon = debounce(compute, 300);
  for (const el of [ui.h, ui.state, ui.obs, ui.time]) {
    el.addEventListener('input', () => {
      markCustom();
      recomputeSoon();
    });
  }
  const recomputeSteps = debounce(compute, 30);
  ui.steps.addEventListener('input', () => {
    ui.stepsOut.textContent = ui.steps.value;
    recomputeSteps();
  });
  ui.order.addEventListener('change', compute);
  ui.preset.addEventListener('change', () => {
    if (ui.preset.value === 'custom') markCustom();
    else applyPreset(ui.preset.value);
  });

  ui.play.addEventListener('click', () => setPlaying(!playing));
  ui.scrub.addEventListener('input', () => {
    if (!result) return;
    setPlaying(false);
    tNow = (Number(ui.scrub.value) / 1000) * result.totalTime;
    render();
  });
  ui.heatSource.addEventListener('change', render);
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || (e.target instanceof Element && e.target.closest('input, textarea, select, button'))) return;
    e.preventDefault();
    setPlaying(!playing);
  });

  ui.share.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      ui.share.textContent = 'Link copied';
    } catch {
      ui.share.textContent = 'Copy the address bar';
    }
    setTimeout(() => (ui.share.textContent = 'Copy link'), 1800);
  });

  window.addEventListener('hashchange', () => {
    tNow = 0;
    if (readHash() && compute()) setPlaying(true);
  });
  new ResizeObserver(() => render()).observe(document.querySelector('.viz'));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);

  if (readHash()) {
    if (compute()) setPlaying(true);
  } else {
    applyPreset(PRESETS[0].id);
  }
  requestAnimationFrame(loop);
}

init();
