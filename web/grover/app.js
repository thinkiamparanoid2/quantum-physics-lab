import { ket, ketOrder, sampleOutcome } from '../lib/circuit.js';
import {
  analyticSuccess,
  classicalExpectedQueries,
  groverAngle,
  groverSteps,
  optimalRounds,
  planeCoordinates,
} from '../lib/grover.js';
import { amplitudeBars } from '../ui/amplitude-bars.js';
import { FONT, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { circuitStrip } from '../ui/circuit-strip.js';
import { mountLesson } from '../ui/lesson.js';
import { drawPlane } from './plane.js';

const $ = (id) => document.getElementById(id);
const ui = {
  play: $('play'),
  circuit: $('circuit'),
  amps: $('amps'),
  ampTitle: $('amp-title'),
  measure: $('measure'),
  measureResult: $('measure-result'),
  qubits: $('qubits'),
  rounds: $('rounds'),
  markedList: $('marked-list'),
  facts: $('facts'),
  plane: $('plane'),
  planeCaption: $('plane-caption'),
  roundsChart: $('rounds-chart'),
};

const ANIMATION_MS = 700;
const PLAY_INTERVAL_MS = 1700;

const state = {
  n: 3,
  marked: new Set([5]),
  rounds: 2,
  roundsChosen: false,
  steps: [],
  step: 0,
  from: null,
  animStart: 0,
  playing: false,
  playTimer: null,
  tally: { hits: 0, total: 0 },
  measured: -1,
};
let hitTest = () => -1;
let circuitKey = '';

const lesson = mountLesson({
  slug: 'grover',
  onNavigate: (i) => {
    setPlaying(false);
    goTo(i);
  },
});

const N = () => 1 << state.n;
const pct = (p) => `${(p * 100).toFixed(p > 0 && p < 0.1 ? 1 : 0)}%`;
const kets = () => [...state.marked].sort((a, b) => a - b).map((b) => ket(b, state.n));

function defaultMarked(n) {
  return new Set([(1 << n) - 3]);
}

function rebuild() {
  const M = state.marked.size;
  if (!state.roundsChosen) state.rounds = optimalRounds(N(), M);
  state.steps = groverSteps(state.n, state.marked, state.rounds);
  state.step = Math.min(state.step, state.steps.length - 1);
  state.from = null;
  let lowest = -0.25;
  for (const s of state.steps) for (const a of s.amps) lowest = Math.min(lowest, a);
  state.ampFloor = Math.max(-1, Math.floor(lowest * 4) / 4);
  circuitKey = '';
  resetTally();

  const best = optimalRounds(N(), M);
  const maxRounds = Math.min(30, Math.max(8, 3 * best + 2));
  ui.rounds.textContent = '';
  for (let k = 0; k <= maxRounds; k++) ui.rounds.add(new Option(k === best ? `${k} (fewest calls)` : String(k), String(k)));
  if (state.rounds > maxRounds) ui.rounds.add(new Option(String(state.rounds), String(state.rounds)));
  ui.rounds.value = String(state.rounds);
  ui.qubits.value = String(state.n);
  ui.markedList.textContent = kets().join('  ');

  const theta = groverAngle(N(), M);
  ui.facts.innerHTML = `
    <dt>Possible answers</dt><dd>${N()} (${state.n} qubits)</dd>
    <dt>Marked answers</dt><dd>${M}</dd>
    <dt>Rotation per round</dt><dd>2θ = ${((2 * theta * 180) / Math.PI).toFixed(1)}°</dd>
    <dt>Oracle calls, Grover</dt><dd>${best} for ${pct(analyticSuccess(N(), M, best))} success</dd>
    <dt>Oracle calls, classical</dt><dd>≈ ${classicalExpectedQueries(N(), M).toFixed(1)} on average</dd>`;
  ui.planeCaption.textContent =
    `The state is always an arrow in this plane. The oracle reflects it across the horizontal axis, and diffusion reflects it across the start direction. ` +
    `Each round turns it by 2θ toward "marked". The chance of measuring a marked answer is the arrow's height squared.`;
  writeHash();
  render();
}

function describe(step) {
  const M = state.marked.size;
  const best = optimalRounds(N(), M);
  const marks = kets().join(', ');
  const which = M === 1 ? `the marked answer ${marks}` : `the ${M} marked answers (${marks})`;
  switch (step.kind) {
    case 'start':
      return [
        'Start',
        `<p>All ${state.n} qubits begin in |0⟩, so the register holds a single basis state. We're searching ${N()} possible answers for ${which}, shown with ★.</p>
         <p>The algorithm doesn't know which answer is marked. Only the oracle, a black box, can recognise it.</p>`,
      ];
    case 'superpose':
      return [
        'Equal superposition',
        `<p>A Hadamard on every qubit spreads the amplitude evenly: each of the ${N()} answers gets amplitude 1/√${N()} ≈ ${(1 / Math.sqrt(N())).toFixed(3)}.</p>
         <p>Measuring now finds a marked answer with probability ${pct(step.success)}, no better than guessing.</p>`,
      ];
    case 'oracle':
      return [
        `Oracle (round ${step.round})`,
        `<p>The oracle flips the <b>sign</b> of ${which}. Nothing else changes.</p>
         <p>Probabilities are squared amplitudes, so measuring now would still succeed only ${pct(step.success)} of the time. The information is hidden in the phase, for now.</p>`,
      ];
    case 'diffuse': {
      const overshoot =
        step.round > best
          ? `<p class="warn">This is past the best number of rounds (${best}). The extra rotation carries the state away from the answer, so more rounds are not always better.</p>`
          : '';
      return [
        `Diffusion (round ${step.round})`,
        `<p>Every amplitude is reflected about the <b>average</b> (dashed line). The marked amplitude sat far below the average, so it jumps far above it, while the others shrink a little.</p>
         <p>Chance of measuring a marked answer: <b>${pct(step.success)}</b>.</p>${overshoot}`,
      ];
    }
    default:
      return [
        'Measure',
        `<p>The bars now show measurement probabilities, the squares of the amplitudes. After ${step.round} round${step.round === 1 ? '' : 's'}, a marked answer comes out with probability <b>${pct(step.success)}</b>.</p>
         <p>Grover used ${step.round} oracle call${step.round === 1 ? '' : 's'}. A classical search checking items one by one needs about ${classicalExpectedQueries(N(), M).toFixed(1)} on average. The gap grows like √N: for a million items it's about 800 calls versus 500,000.</p>`,
      ];
  }
}

function columns() {
  const cols = [{ kind: 'gate', label: 'H', title: 'Hadamard on every qubit' }];
  for (let k = 1; k <= state.rounds; k++) {
    cols.push({ kind: 'oracle', label: 'Oracle', title: `Oracle, round ${k}`, group: `Round ${k}` });
    cols.push({ kind: 'diffuse', label: 'Diffuse', title: `Diffusion, round ${k}`, group: `Round ${k}` });
  }
  cols.push({ kind: 'measure', label: 'M', title: 'Measure every qubit' });
  return cols;
}

function displayed(now) {
  const target = state.steps[state.step];
  if (!state.from) return target.amps;
  const f = Math.min(1, (now - state.animStart) / ANIMATION_MS);
  const e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
  if (f >= 1) state.from = null;
  return target.amps.map((a, i) => state.from[i] + (a - state.from[i]) * e);
}

function render(now = performance.now()) {
  if (!state.steps.length) return;
  const th = theme();
  const step = state.steps[state.step];
  const amps = displayed(now);
  const measuring = step.kind === 'measure';

  // Bars are drawn in reading order (|000⟩, |001⟩, ...); map positions back to basis indices.
  const order = ketOrder(state.n);
  const labels = order.map((b) => ket(b, state.n));
  const marked = new Set(order.flatMap((b, i) => (state.marked.has(b) ? [i] : [])));
  const highlight = order.indexOf(state.measured);
  ui.ampTitle.textContent = measuring ? 'Measurement probabilities (amplitude squared)' : 'Amplitudes';
  let hit;
  if (measuring) {
    hit = amplitudeBars(ui.amps, { theme: th, labels, values: order.map((b) => step.probs[b]), marked, yRange: [0, 1], highlight });
  } else {
    const mean = amps.reduce((a, b) => a + b, 0) / amps.length;
    hit = amplitudeBars(ui.amps, {
      theme: th,
      labels,
      values: order.map((b) => amps[b]),
      marked,
      yRange: [state.ampFloor, 1],
      mean: step.kind === 'start' ? null : mean,
      highlight,
    });
  }
  hitTest = (x) => {
    const i = hit(x);
    return i < 0 ? -1 : order[i];
  };

  const key = `${state.n}|${state.rounds}|${state.step}|${[...state.marked].join(',')}`;
  if (key !== circuitKey) {
    circuitKey = key;
    lesson.render(
      state.steps.map((s) => {
        const [title, html] = describe(s);
        return { title, html };
      }),
      state.step,
    );
    const hadFocus = ui.circuit.contains(document.activeElement);
    circuitStrip(ui.circuit, { n: state.n, columns: columns(), position: state.step, onSelect: goTo });
    if (hadFocus) (ui.circuit.querySelector('.col.current') ?? ui.circuit.querySelector('.col'))?.focus();
  }

  const inPlane = state.step > 0 && !(state.from && state.step === 1);
  const trail = state.steps
    .slice(1, state.step)
    .filter((s) => s.kind === 'superpose' || s.kind === 'diffuse')
    .map((s) => planeCoordinates(s.amps, state.marked));
  drawPlane(ui.plane, {
    theme: th,
    point: inPlane ? planeCoordinates(amps, state.marked) : null,
    trail,
    theta: groverAngle(N(), state.marked.size),
    note: 'Apply the Hadamards first: |00…0⟩ is not in this plane yet',
  });

  drawRoundsChart(th, step);

  if (state.from) requestAnimationFrame(render);
}

function drawRoundsChart(th, step) {
  const { ctx, w, h } = prep(ui.roundsChart);
  const M = state.marked.size;
  const K = Math.max(state.rounds, optimalRounds(N(), M) + 1, 3);
  const box = { x0: 52, y0: 14, x1: w - 16, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, 1], th);
  const X = xAxis(ctx, box, [0, K], th, { integer: true });
  const best = optimalRounds(N(), M);
  const reached = step.kind === 'start' ? -1 : step.kind === 'oracle' ? step.round - 1 : step.round;

  ctx.strokeStyle = th.marked;
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(Math.round(X(best)) + 0.5, box.y0);
  ctx.lineTo(Math.round(X(best)) + 0.5, box.y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = FONT;
  ctx.fillStyle = th.marked;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('fewest calls', X(best) + 5, box.y0);

  ctx.strokeStyle = th.grid;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 200; i++) {
    const k = (K * i) / 200;
    const x = X(k);
    const y = Y(analyticSuccess(N(), M, k));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  for (let k = 0; k <= K; k++) {
    const x = X(k);
    const y = Y(analyticSuccess(N(), M, k));
    ctx.beginPath();
    ctx.arc(x, y, k === reached ? 6 : 4, 0, 2 * Math.PI);
    if (k <= reached) {
      ctx.fillStyle = th.ampPos;
      ctx.fill();
    } else {
      ctx.strokeStyle = th.muted;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('rounds', (box.x0 + box.x1) / 2, h);
}

function goTo(index, animate = true) {
  const target = Math.max(0, Math.min(state.steps.length - 1, index));
  if (target === state.step) return;
  const adjacent = Math.abs(target - state.step) === 1;
  const leavingMeasure = state.steps[state.step].kind === 'measure' || state.steps[target].kind === 'measure';
  state.from = animate && adjacent && !leavingMeasure ? displayed(performance.now()) : null;
  state.animStart = performance.now();
  state.step = target;
  resetTally();
  writeHash();
  render();
}

function setPlaying(p) {
  state.playing = p;
  clearTimeout(state.playTimer);
  ui.play.textContent = p ? 'Pause' : 'Play';
  ui.play.setAttribute('aria-pressed', String(p));
  if (!p) return;
  if (state.step === state.steps.length - 1) goTo(0, false);
  const tick = () => {
    if (!state.playing) return;
    if (state.step >= state.steps.length - 1) return setPlaying(false);
    goTo(state.step + 1);
    state.playTimer = setTimeout(tick, PLAY_INTERVAL_MS);
  };
  state.playTimer = setTimeout(tick, 350);
}

function resetTally() {
  state.tally = { hits: 0, total: 0 };
  state.measured = -1;
  ui.measureResult.textContent = '';
}

function measureOnce() {
  const step = state.steps[state.step];
  const outcome = sampleOutcome(step.probs, Math.random());
  const hit = state.marked.has(outcome);
  state.tally.total++;
  if (hit) state.tally.hits++;
  state.measured = outcome;
  ui.measureResult.innerHTML =
    `Measured <b>${ket(outcome, state.n)}</b> ${hit ? '<span class="hit">★ marked</span>' : '(not marked)'}<br>` +
    `<span class="muted">Found a marked answer in ${state.tally.hits} of ${state.tally.total} tries at this step (expected ${pct(step.success)}).</span>`;
  render();
}

function toggleMark(index) {
  const next = new Set(state.marked);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  if (next.size === 0 || next.size === N()) return;
  state.marked = next;
  state.roundsChosen = false;
  rebuild();
}

function writeHash() {
  const p = new URLSearchParams({ n: state.n, marked: [...state.marked].sort((a, b) => a - b).join(',') });
  if (state.roundsChosen) p.set('rounds', state.rounds);
  if (state.step > 0) p.set('step', state.step + 1);
  history.replaceState(null, '', `#${p.toString()}`);
}

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const n = Number(p.get('n'));
  if (!(n >= 2 && n <= 6)) return;
  state.roundsChosen = false;
  state.step = 0;
  state.n = n;
  const marked = (p.get('marked') ?? '')
    .split(',')
    .map(Number)
    .filter((b) => Number.isInteger(b) && b >= 0 && b < 1 << n);
  state.marked = marked.length && marked.length < 1 << n ? new Set(marked) : defaultMarked(n);
  const rounds = Number(p.get('rounds'));
  if (p.has('rounds') && Number.isInteger(rounds) && rounds >= 0 && rounds <= 60) {
    state.rounds = rounds;
    state.roundsChosen = true;
  }
  const step = Number(p.get('step'));
  if (Number.isInteger(step) && step >= 1) state.step = step - 1;
}

function init() {
  ui.play.addEventListener('click', () => setPlaying(!state.playing));
  ui.measure.addEventListener('click', measureOnce);
  ui.qubits.addEventListener('change', () => {
    state.n = Number(ui.qubits.value);
    state.marked = defaultMarked(state.n);
    state.roundsChosen = false;
    rebuild();
  });
  ui.rounds.addEventListener('change', () => {
    state.rounds = Number(ui.rounds.value);
    state.roundsChosen = true;
    rebuild();
  });
  ui.amps.addEventListener('click', (e) => {
    const i = hitTest(e.clientX - ui.amps.getBoundingClientRect().left);
    if (i >= 0) toggleMark(i);
  });
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, button, a')) return;
    e.preventDefault();
    setPlaying(!state.playing);
  });

  window.addEventListener('hashchange', () => {
    setPlaying(false);
    readHash();
    rebuild();
  });
  new ResizeObserver(() => render()).observe(document.querySelector('.stage'));
  window.addEventListener('themechange', () => render());

  readHash();
  rebuild();
}

init();
