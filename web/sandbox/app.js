import { djCircuit, qftOps } from '../lib/algorithms.js';
import { blochVector } from '../lib/bloch.js';
import { probabilities, runOps, seededRandom } from '../lib/circuit.js';
import { formatState } from '../lib/format.js';
import { teleportOps } from '../lib/protocols.js';
import { ANGLE_GATES, MAX_QUBITS, cellAt, decode, encode, fromOps, setCell, toOps } from '../lib/sandbox.js';
import { BlochView } from '../ui/bloch.js';
import { theme } from '../ui/charts.js';
import { drawDials, drawPhaseWheel } from '../ui/dials.js';
import { Sampler } from '../ui/sampler.js';
import { mountShell, shareButton } from '../ui/shell.js';

mountShell();

const TOOLS = [
  ['H', 'Hadamard'],
  ['X', 'X (NOT)'],
  ['Y', 'Y'],
  ['Z', 'Z (phase flip)'],
  ['S', 'S (quarter turn about z)'],
  ['SDG', 'S† (S undone)'],
  ['T', 'T (eighth turn about z)'],
  ['TDG', 'T† (T undone)'],
  ['RX', 'Rx(θ): rotation about x'],
  ['RY', 'Ry(θ): rotation about y'],
  ['RZ', 'Rz(θ): rotation about z'],
  ['P', 'P(θ): phase gate'],
  ['C', 'Control dot: controls every other gate in its column'],
  ['W', 'Swap end: put two in one column to swap those qubits'],
  ['M', 'Measurement'],
  ['ERASE', 'Eraser: click a cell to clear it'],
];
const DESCRIBE = Object.fromEntries(TOOLS);
const DISPLAY = { SDG: 'S†', TDG: 'T†', RX: 'Rx', RY: 'Ry', RZ: 'Rz', C: '●', W: '×', ERASE: '⌫' };
const label = (g) => DISPLAY[g] ?? g;
const degrees = (a) => `${Math.round(((a * 180) / Math.PI) * 10) / 10}°`;

const H = (q) => ({ gate: 'H', target: q });
const X = (q) => ({ gate: 'X', target: q });
const CX = (c, t) => ({ gate: 'X', target: t, controls: [c] });
const CZ = (c, t) => ({ gate: 'Z', target: t, controls: [c] });
const PRESETS = [
  ['Bell pair', 2, [H(0), CX(0, 1)]],
  ['GHZ state (3 qubits)', 3, [H(0), CX(0, 1), CX(1, 2)]],
  ['Every 3-bit number at once', 3, [H(0), H(1), H(2)]],
  ['Phase kickback', 2, [X(1), H(0), H(1), CX(0, 1), H(0), H(1)]],
  ["Grover's search on 2 qubits (finds |11⟩)", 2, [H(0), H(1), CZ(0, 1), H(0), H(1), X(0), X(1), CZ(0, 1), X(0), X(1), H(0), H(1)]],
  ['Quantum Fourier transform of |001⟩', 3, [X(2), ...qftOps([0, 1, 2])]],
  ['Teleportation', 3, teleportOps((2 * Math.PI) / 3, Math.PI / 4)],
  ['Deutsch–Jozsa, balanced function', 4, djCircuit(3, 'parity', true).ops],
];

const $ = (id) => document.getElementById(id);
const grid = $('grid');
const stage = $('stage');

let model = decode(location.hash) ?? fromOps(2, PRESETS[0][2]);
let tool = null;
let selected = null;
let cursor = null;
let seed = (Math.random() * 2 ** 32) >>> 0;
const undoStack = [];
const redoStack = [];

// ----- result cards -----

stage.insertAdjacentHTML(
  'beforeend',
  `<figure class="panel card">
    <figcaption class="card-head"><h2>State</h2><span class="legend"><canvas class="phase-wheel" width="18" height="18" aria-hidden="true"></canvas> disc size = probability, colour and hand = phase</span></figcaption>
    <p class="state-formula" id="formula"></p>
    <canvas id="dials" class="chart" role="img" aria-label="Amplitude of each basis state"></canvas>
    <div class="bits" id="bits"></div>
  </figure>
  <figure class="panel card">
    <figcaption class="card-head"><h2>Each qubit on its own</h2><span class="legend">a shorter arrow means the qubit is entangled with the others</span></figcaption>
    <div class="bloch-row" id="blochs"></div>
  </figure>
  <figure class="panel card">
    <figcaption class="card-head"><h2>Measure every qubit</h2><span class="legend">samples the circuit's output</span></figcaption>
    <div id="sampler"></div>
  </figure>`,
);
const sampler = new Sampler($('sampler'));
let blochViews = [];

// ----- palette, presets -----

$('palette').innerHTML = TOOLS.map(
  ([g, title]) =>
    `<button type="button" class="sb-tool" data-tool="${g}" title="${title}" aria-label="${title}" aria-pressed="false">${label(g)}${ANGLE_GATES.has(g) ? '<small>θ</small>' : ''}</button>`,
).join('');
$('presets').innerHTML = PRESETS.map(([name], i) => `<button type="button" data-preset="${i}">${name}</button>`).join('');

const angleInput = $('angle');
const angleRad = () => (Number(angleInput.value) * Math.PI) / 180;
const showAngle = () => ($('angle-out').textContent = `${angleInput.value}°`);
angleInput.addEventListener('input', showAngle);
showAngle();

// ----- editing -----

function snapshot() {
  return encode(model);
}

function commit(mutate) {
  undoStack.push(snapshot());
  if (undoStack.length > 200) undoStack.shift();
  redoStack.length = 0;
  mutate();
  afterChange();
}

function afterChange() {
  history.replaceState(null, '', `#${encode(model)}`);
  if (selected && !cellAt(model, selected.c, selected.q)) selected = null;
  if (cursor !== null && cursor > model.cols.length) cursor = null;
  render();
}

function restore(text) {
  model = decode(`#${text}`) ?? model;
  afterChange();
}

function newCell(g) {
  return ANGLE_GATES.has(g) ? { g, a: angleRad() } : { g };
}

function place(g, c, q) {
  if (g === 'ERASE') {
    if (cellAt(model, c, q)) commit(() => setCell(model, c, q, null));
    return;
  }
  commit(() => setCell(model, c, q, newCell(g)));
  selected = { c, q };
  render();
}

function move(from, to) {
  if (from.c === to.c && from.q === to.q) return;
  const cell = cellAt(model, from.c, from.q);
  commit(() => {
    setCell(model, from.c, from.q, null);
    setCell(model, to.c, to.q, cell);
  });
  selected = { ...to };
  render();
}

function setTool(g) {
  tool = tool === g ? null : g;
  document.querySelectorAll('.sb-tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
}

// ----- rendering -----

function cellHtml(x, controlled) {
  if (!x) return '';
  if (x.g === 'C') return '<span class="sb-dot"></span>';
  if (x.g === 'X' && controlled) return '<span class="sb-oplus" aria-hidden="true"></span>';
  if (x.g === 'W') return '<span class="sb-swap">×</span>';
  if (x.g === 'M') return '<span class="sb-gate measure">M</span>';
  return `<span class="sb-gate">${label(x.g)}${ANGLE_GATES.has(x.g) ? `<small>${degrees(x.a)}</small>` : ''}</span>`;
}

function renderGrid() {
  const n = model.n;
  const C = Math.max(10, model.cols.length + 2);
  grid.style.gridTemplateColumns = `92px repeat(${C}, 54px)`;
  const parts = [];
  for (let c = 0; c < C; c++) {
    const isCursor = cursor !== null && c === cursor - 1;
    parts.push(
      `<button type="button" class="sb-colhead${isCursor ? ' cursor' : ''}" data-col="${c}" style="grid-column:${c + 2};grid-row:1"
        title="Show the state after column ${c + 1}">${c + 1}</button>`,
    );
  }
  const controlled = model.cols.map((col) => col.some((x) => x.g === 'C'));
  for (let q = 0; q < n; q++) {
    parts.push(`<div class="sb-rowlabel" style="grid-column:1;grid-row:${q + 2}">q${q} <span>|0⟩</span></div>`);
    for (let c = 0; c < C; c++) {
      const x = cellAt(model, c, q);
      const cls = ['sb-cell'];
      if (cursor !== null && c >= cursor) cls.push('future');
      if (selected && selected.c === c && selected.q === q) cls.push('selected');
      const desc = x ? `${DESCRIBE[x.g] ?? x.g}${x.a !== undefined ? ` ${degrees(x.a)}` : ''}` : 'empty';
      parts.push(
        `<button type="button" class="${cls.join(' ')}" data-c="${c}" data-q="${q}" style="grid-column:${c + 2};grid-row:${q + 2}"
          aria-label="Qubit ${q}, column ${c + 1}: ${desc}">${cellHtml(x, controlled[c])}</button>`,
      );
    }
  }
  model.cols.forEach((col, c) => {
    const controls = col.filter((x) => x.g === 'C').length;
    const swaps = col.filter((x) => x.g === 'W').length;
    const linked = (controls && col.length > controls) || swaps === 2;
    if (!linked || col.length < 2) return;
    const qs = col.map((x) => x.q);
    parts.push(`<div class="sb-link" style="grid-column:${c + 2};grid-row:${Math.min(...qs) + 2} / ${Math.max(...qs) + 3}"></div>`);
  });
  const focused = document.activeElement?.closest?.('.sb-cell');
  const refocus = focused ? { c: focused.dataset.c, q: focused.dataset.q } : null;
  grid.innerHTML = parts.join('');
  if (refocus) grid.querySelector(`.sb-cell[data-c="${refocus.c}"][data-q="${refocus.q}"]`)?.focus();
  $('count').textContent = String(n);
  $('less').disabled = n <= 1;
  $('more').disabled = n >= MAX_QUBITS;
  $('undo').disabled = undoStack.length === 0;
  $('redo').disabled = redoStack.length === 0;
}

let slideSnapshot = null;

function renderInspector() {
  const box = $('inspector');
  const x = selected && cellAt(model, selected.c, selected.q);
  if (!x) {
    box.innerHTML = '<h2>Selected</h2><p class="hint">Click a placed gate to select it, then change its angle or delete it.</p>';
    return;
  }
  const angle = ANGLE_GATES.has(x.g);
  box.innerHTML = `<h2>Selected</h2>
    <p><b>${DESCRIBE[x.g]}</b> on q${x.q}, column ${selected.c + 1}</p>
    ${
      angle
        ? `<label class="field"><span class="label">Angle <output id="sel-angle-out">${degrees(x.a)}</output></span>
            <input id="sel-angle" type="range" min="-180" max="180" step="7.5" value="${(x.a * 180) / Math.PI}"></label>`
        : ''
    }
    <div class="row" style="margin-top: 12px"><button id="delete" class="btn" type="button">Delete</button><button id="deselect" class="btn" type="button">Done</button></div>`;
  box.querySelector('#delete').addEventListener('click', () => {
    const { c, q } = selected;
    selected = null;
    commit(() => setCell(model, c, q, null));
  });
  box.querySelector('#deselect').addEventListener('click', () => {
    selected = null;
    render();
  });
  const slider = box.querySelector('#sel-angle');
  if (slider) {
    slider.addEventListener('pointerdown', () => (slideSnapshot ??= snapshot()));
    slider.addEventListener('keydown', () => (slideSnapshot ??= snapshot()));
    slider.addEventListener('input', () => {
      x.a = (Number(slider.value) * Math.PI) / 180;
      box.querySelector('#sel-angle-out').textContent = degrees(x.a);
      history.replaceState(null, '', `#${encode(model)}`);
      renderGrid();
      renderResults();
    });
    slider.addEventListener('change', () => {
      if (slideSnapshot) {
        undoStack.push(slideSnapshot);
        redoStack.length = 0;
        slideSnapshot = null;
        renderGrid();
      }
    });
  }
}

function renderResults() {
  const th = theme();
  const n = model.n;
  const { ops, colOf, warnings } = toOps(model);
  const upto = cursor === null ? ops.length : colOf.filter((c) => c < cursor).length;
  const run = runOps(n, ops, upto, seededRandom(seed));
  const probs = probabilities(run.state);
  let fs = upto;
  while (fs > 0 && ops[fs - 1].gate === 'MEASURE') fs--;
  const pre = fs < upto ? probabilities(runOps(n, ops, fs, seededRandom(seed)).state) : probs;

  $('formula').innerHTML = `<span class="label">State${cursor !== null ? ` after column ${cursor}` : ''}</span>${formatState(run.state.re, run.state.im, n)}`;
  drawDials($('dials'), { theme: th, re: run.state.re, im: run.state.im, n });
  const bits = Object.entries(run.bits);
  $('bits').innerHTML = bits.length
    ? `${bits.map(([b, v]) => `<span class="bit-chip">m${b} = <b>${v}</b></span>`).join('')}<button id="reroll" class="btn" type="button">Measure again</button>`
    : '';
  $('reroll')?.addEventListener('click', () => {
    seed = (Math.random() * 2 ** 32) >>> 0;
    renderResults();
  });

  if (blochViews.length !== n) {
    const row = $('blochs');
    row.innerHTML = '';
    blochViews = Array.from({ length: n }, (_, q) => {
      const canvas = document.createElement('canvas');
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `Bloch sphere of qubit ${q}`);
      row.append(canvas);
      return new BlochView(canvas, { title: `q${q}`, labels: n > 2 ? 'poles' : 'all' });
    });
  }
  blochViews.forEach((view, q) => {
    const v = blochVector(run.state, q);
    const len = Math.hypot(...v);
    view.vector = v;
    view.note = n > 1 ? (len < 0.02 ? 'no direction of its own' : len < 0.995 ? `arrow length ${len.toFixed(2)}` : '') : '';
    view.draw(th);
  });

  sampler.setDistribution(pre, n, `${encode(model)}|${cursor}|${seed}`);
  sampler.draw(th);

  $('warnings').innerHTML = warnings.map((w) => `<p class="sb-warn">${w}</p>`).join('');
  $('cursor-note').innerHTML =
    cursor === null
      ? 'Click a column number to see the state part-way through the circuit.'
      : `Showing the state after column ${cursor}. <a href="#" id="show-all">Show the whole circuit</a>`;
  $('show-all')?.addEventListener('click', (e) => {
    e.preventDefault();
    cursor = null;
    render();
  });
}

function render() {
  renderGrid();
  renderInspector();
  renderResults();
}

// ----- pointer: drag from the palette, drag placed gates -----

let pending = null;
let ghost = null;
let dropCell = null;
let suppressClick = false;

function cellUnder(x, y) {
  return document.elementFromPoint(x, y)?.closest?.('.sb-cell') ?? null;
}

function startDrag(text) {
  ghost = document.createElement('div');
  ghost.className = 'sb-ghost';
  ghost.textContent = text;
  document.body.append(ghost);
}

document.addEventListener('pointermove', (e) => {
  if (!pending) return;
  if (!ghost) {
    if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < 6) return;
    startDrag(pending.text);
  }
  ghost.style.left = `${e.clientX}px`;
  ghost.style.top = `${e.clientY}px`;
  const cell = cellUnder(e.clientX, e.clientY);
  if (cell !== dropCell) {
    dropCell?.classList.remove('drop');
    dropCell = cell;
    dropCell?.classList.add('drop');
  }
});

document.addEventListener('pointerup', (e) => {
  if (!pending) return;
  const drag = pending;
  pending = null;
  if (!ghost) return;
  ghost.remove();
  ghost = null;
  dropCell?.classList.remove('drop');
  dropCell = null;
  suppressClick = true;
  setTimeout(() => (suppressClick = false), 0);
  const cell = cellUnder(e.clientX, e.clientY);
  if (!cell) return;
  const to = { c: Number(cell.dataset.c), q: Number(cell.dataset.q) };
  if (drag.tool) place(drag.tool, to.c, to.q);
  else move(drag.from, to);
});

$('palette').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.sb-tool');
  if (!b || e.button !== 0) return;
  e.preventDefault();
  pending = { tool: b.dataset.tool, text: label(b.dataset.tool), x: e.clientX, y: e.clientY };
});
$('palette').addEventListener('click', (e) => {
  const b = e.target.closest('.sb-tool');
  if (!b || suppressClick) return;
  setTool(b.dataset.tool);
});

grid.addEventListener('pointerdown', (e) => {
  const cell = e.target.closest('.sb-cell');
  if (!cell || e.button !== 0) return;
  const from = { c: Number(cell.dataset.c), q: Number(cell.dataset.q) };
  const x = cellAt(model, from.c, from.q);
  if (x && !tool) pending = { from, text: label(x.g), x: e.clientX, y: e.clientY };
});

grid.addEventListener('click', (e) => {
  if (suppressClick) return;
  const head = e.target.closest('.sb-colhead');
  if (head) {
    const k = Number(head.dataset.col) + 1;
    cursor = cursor === k || k > model.cols.length ? null : k;
    render();
    return;
  }
  const cell = e.target.closest('.sb-cell');
  if (!cell) return;
  const c = Number(cell.dataset.c);
  const q = Number(cell.dataset.q);
  if (tool) {
    place(tool, c, q);
    return;
  }
  selected = cellAt(model, c, q) ? { c, q } : null;
  render();
});

// ----- keyboard -----

grid.addEventListener('keydown', (e) => {
  const cell = e.target.closest('.sb-cell');
  if (!cell) return;
  const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (!(e.key in moves)) return;
  e.preventDefault();
  const [dc, dq] = moves[e.key];
  grid.querySelector(`.sb-cell[data-c="${Number(cell.dataset.c) + dc}"][data-q="${Number(cell.dataset.q) + dq}"]`)?.focus();
});

document.addEventListener('keydown', (e) => {
  if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    $('undo').click();
  } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault();
    $('redo').click();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
    e.preventDefault();
    const { c, q } = selected;
    selected = null;
    commit(() => setCell(model, c, q, null));
  } else if (e.key === 'Escape') {
    selected = null;
    if (tool) setTool(tool);
    render();
  }
});

// ----- toolbar buttons -----

$('undo').addEventListener('click', () => {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
});
$('redo').addEventListener('click', () => {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
});
$('clear').addEventListener('click', () => commit(() => (model.cols = [])));
$('more').addEventListener('click', () => commit(() => (model.n = Math.min(MAX_QUBITS, model.n + 1))));
$('less').addEventListener('click', () =>
  commit(() => {
    model.n = Math.max(1, model.n - 1);
    model.cols = model.cols.map((col) => col.filter((x) => x.q < model.n));
    while (model.cols.length && model.cols[model.cols.length - 1].length === 0) model.cols.pop();
  }),
);
$('presets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-preset]');
  if (!b) return;
  const [, n, ops] = PRESETS[Number(b.dataset.preset)];
  selected = null;
  cursor = null;
  commit(() => (model = fromOps(n, ops)));
});
shareButton($('share'));

window.addEventListener('hashchange', () => {
  const next = decode(location.hash);
  if (next && encode(next) !== encode(model)) {
    model = next;
    render();
  }
});
window.addEventListener('themechange', () => {
  drawPhaseWheel(stage.querySelector('.phase-wheel'));
  renderResults();
});
new ResizeObserver(() => renderResults()).observe(stage);

drawPhaseWheel(stage.querySelector('.phase-wheel'));
history.replaceState(null, '', `#${encode(model)}`);
render();
