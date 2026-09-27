// Gate-level circuit diagram (SVG) for the op lists in lib/circuit.js. Gates on different
// qubits share a column where possible, like a textbook drawing. Ops before `applied` are
// drawn normally, later ones faded; ops in `current` are highlighted. Clicking an op calls
// onSelect(opIndex).

import { angleLabel } from '../lib/format.js';

const NS = 'http://www.w3.org/2000/svg';
const WIRE_GAP = 46;
const TOP = 30;
const COL_W = 56;
const BOX = 34;

function el(tag, attrs, parent, text) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node);
  return node;
}

function qubitsOf(op, n) {
  if (op.gate === 'BARRIER') return Array.from({ length: n }, (_, q) => q);
  return [...(op.targets ?? [op.target]), ...(op.controls ?? [])];
}

const LABELS = { SDG: 'S†', TDG: 'T†', RX: 'Rx', RY: 'Ry', RZ: 'Rz', P: 'P' };

// Assign every op a column: the first one after everything already placed on the wires it
// spans (and after the measurement it is conditioned on).
export function layoutColumns(ops, n) {
  const next = new Array(n).fill(0);
  const bitReady = {};
  let cols = 0;
  const placed = ops.map((op) => {
    const qs = qubitsOf(op, n);
    const lo = Math.min(...qs);
    const hi = Math.max(...qs);
    let col = 0;
    for (let q = lo; q <= hi; q++) col = Math.max(col, next[q]);
    if (op.if) col = Math.max(col, bitReady[op.if.bit] ?? 0);
    for (let q = lo; q <= hi; q++) next[q] = col + 1;
    if (op.gate === 'MEASURE') bitReady[op.bit ?? op.target] = col + 1;
    cols = Math.max(cols, col + 1);
    return { col, lo, hi };
  });
  return { placed, cols };
}

export function drawCircuit(container, { n, ops, applied, current = [], labels = [], onSelect }) {
  container.textContent = '';
  const { placed, cols } = layoutColumns(ops, n);
  const left = Math.max(64, 14 + Math.max(0, ...labels.map((l) => l.length)) * 7.2 + 34);
  const width = left + Math.max(cols, 1) * COL_W + 24;
  const bottom = TOP + (n - 1) * WIRE_GAP;
  const height = bottom + 34;
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width, height, class: 'circuit', role: 'img', 'aria-label': 'Quantum circuit' }, container);
  const X = (col) => left + col * COL_W + COL_W / 2;
  const Y = (q) => TOP + q * WIRE_GAP;

  const currentSet = new Set(current);
  if (current.length) {
    const cs = current.map((i) => placed[i].col);
    const c0 = Math.min(...cs);
    const c1 = Math.max(...cs);
    el('rect', { x: X(c0) - COL_W / 2 + 3, y: 4, width: (c1 - c0 + 1) * COL_W - 6, height: height - 8, rx: 10, class: 'step-band' }, svg);
  }

  for (let q = 0; q < n; q++) {
    el('line', { x1: left - 22, y1: Y(q), x2: width - 10, y2: Y(q), class: 'wire' }, svg);
    el('text', { x: 6, y: Y(q) + 4, class: 'wire-label' }, svg, labels[q] ?? `q${q}`);
    el('text', { x: left - 20, y: Y(q) + 4, class: 'wire-label', 'text-anchor': 'end' }, svg, '|0⟩');
  }

  ops.forEach((op, i) => {
    if (op.gate === 'BARRIER') return;
    const { col, lo, hi } = placed[i];
    const x = X(col);
    const status = i < applied ? 'done' : 'todo';
    const g = el('g', { class: `op ${status}${currentSet.has(i) ? ' current' : ''}${op.if ? ' conditional' : ''}`, tabindex: '0', role: 'button', 'aria-label': describe(op) }, svg);
    const box = (q, label, sub) => {
      el('rect', { x: x - BOX / 2, y: Y(q) - BOX / 2, width: BOX, height: BOX, rx: 7, class: 'gate' }, g);
      el('text', { x, y: Y(q) + (sub ? 0 : 5), class: 'gate-label' }, g, label);
      if (sub) el('text', { x, y: Y(q) + 12, class: 'gate-sub' }, g, sub);
    };

    if (op.controls?.length || op.gate === 'SWAP') {
      el('line', { x1: x, y1: Y(lo), x2: x, y2: Y(hi), class: 'link' }, g);
    }
    for (const c of op.controls ?? []) el('circle', { cx: x, cy: Y(c), r: 5.5, class: 'ctrl' }, g);

    if (op.gate === 'SWAP') {
      for (const t of op.targets) {
        const y = Y(t);
        el('path', { d: `M${x - 7} ${y - 7} L${x + 7} ${y + 7} M${x + 7} ${y - 7} L${x - 7} ${y + 7}`, class: 'link' }, g);
      }
    } else if (op.gate === 'MEASURE') {
      const y = Y(op.target);
      el('rect', { x: x - BOX / 2, y: y - BOX / 2, width: BOX, height: BOX, rx: 7, class: 'gate' }, g);
      el('path', { d: `M${x - 10} ${y + 6} A 11 11 0 0 1 ${x + 10} ${y + 6}`, class: 'meter' }, g);
      el('line', { x1: x, y1: y + 6, x2: x + 7, y2: y - 6, class: 'meter' }, g);
      el('text', { x, y: y + BOX / 2 + 13, class: 'gate-sub' }, g, `m${op.bit ?? op.target}`);
    } else if (op.gate === 'BLOCK') {
      const tl = Math.min(...op.targets);
      const th = Math.max(...op.targets);
      el('rect', { x: x - BOX / 2 - 4, y: Y(tl) - BOX / 2, width: BOX + 8, height: Y(th) - Y(tl) + BOX, rx: 8, class: 'gate block' }, g);
      el('text', { x, y: (Y(tl) + Y(th)) / 2 + 4, class: 'gate-label small' }, g, op.label);
    } else if (op.gate === 'X' && op.controls?.length) {
      const y = Y(op.target);
      el('circle', { cx: x, cy: y, r: 13, class: 'target' }, g);
      el('path', { d: `M${x - 13} ${y} H${x + 13} M${x} ${y - 13} V${y + 13}`, class: 'target-plus' }, g);
    } else if (op.gate === 'Z' && op.controls?.length) {
      el('circle', { cx: x, cy: Y(op.target), r: 5.5, class: 'ctrl' }, g);
    } else {
      const name = op.label ?? LABELS[op.gate] ?? op.gate;
      box(op.target, name, op.angle !== undefined ? angleLabel(op.angle) : undefined);
    }

    if (op.if) {
      el('text', { x, y: Y(op.target) - BOX / 2 - 6, class: 'gate-sub cond' }, g, `if m${op.if.bit}=${op.if.value}`);
    }

    const select = () => onSelect?.(i);
    g.addEventListener('click', select);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select();
      }
    });
  });

  if (current.length) {
    const cx = X(placed[Math.min(...current)].col);
    container.scrollLeft = Math.max(0, cx - container.clientWidth / 2);
  }
}

function describe(op) {
  const name = op.label ?? LABELS[op.gate] ?? op.gate;
  if (op.gate === 'MEASURE') return `Measure qubit ${op.target}`;
  if (op.gate === 'SWAP') return `Swap qubits ${op.targets.join(' and ')}`;
  if (op.gate === 'BLOCK') return `${op.label} on qubits ${op.targets.join(', ')}`;
  const ctrl = op.controls?.length ? `controlled by qubit ${op.controls.join(', ')}, ` : '';
  return `${name} gate, ${ctrl}on qubit ${op.target}`;
}
