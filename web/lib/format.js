// Writing amplitudes and states the way a textbook would: 1/√2 rather than 0.7071,
// and (|00⟩ + |11⟩)/√2 rather than a list of numbers.

import { ket, ketOrder } from './circuit.js';

const EPS = 1e-9;
const NICE = [
  [1, '1'],
  [Math.SQRT1_2, '1/√2'],
  [0.5, '1/2'],
  [Math.sqrt(3) / 2, '√3/2'],
  [1 / Math.sqrt(3), '1/√3'],
  [Math.SQRT1_2 / 2, '1/(2√2)'],
  [0.25, '1/4'],
];

export function niceReal(v, digits = 3) {
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  for (const [x, s] of NICE) if (Math.abs(a - x) < EPS) return sign + s;
  return sign + a.toFixed(digits).replace(/\.?0+$/, '');
}

function niceImag(v) {
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (Math.abs(a - 1) < EPS) return `${sign}i`;
  const s = niceReal(a);
  return sign + (s.startsWith('1/') ? `i${s.slice(1)}` : `${s}i`);
}

export function formatComplex(re, im) {
  const hasRe = Math.abs(re) > EPS;
  const hasIm = Math.abs(im) > EPS;
  if (!hasRe && !hasIm) return '0';
  if (!hasIm) return niceReal(re);
  if (!hasRe) return niceImag(im);
  const imag = niceImag(Math.abs(im));
  return `(${niceReal(re)} ${im < 0 ? '−' : '+'} ${imag})`;
}

// Unit phases that read well as a prefix: 1, -1, i, -i.
function unitPhase(re, im) {
  if (Math.abs(im) < EPS && Math.abs(re - 1) < EPS) return '';
  if (Math.abs(im) < EPS && Math.abs(re + 1) < EPS) return '−';
  if (Math.abs(re) < EPS && Math.abs(im - 1) < EPS) return 'i';
  if (Math.abs(re) < EPS && Math.abs(im + 1) < EPS) return '−i';
  return null;
}

function joinTerms(terms) {
  return terms
    .map(([coef, k], i) => {
      const neg = coef.startsWith('−');
      const body = (neg ? coef.slice(1) : coef) + k;
      if (i === 0) return (neg ? '−' : '') + body;
      return `${neg ? ' − ' : ' + '}${body}`;
    })
    .join('');
}

export function formatState(re, im, n, { maxTerms = 8 } = {}) {
  const idx = ketOrder(n).filter((b) => re[b] * re[b] + im[b] * im[b] > 1e-12);
  if (idx.length === 0) return '0';
  const shown = idx.slice(0, maxTerms);
  const more = idx.length > maxTerms ? ' + …' : '';

  // Equal-size amplitudes whose phases are 1, -1, i or -i: factor out the common size.
  const mag = Math.hypot(re[idx[0]], im[idx[0]]);
  const same = idx.every((b) => Math.abs(Math.hypot(re[b], im[b]) - mag) < 1e-9);
  const phases = shown.map((b) => unitPhase(re[b] / mag, im[b] / mag));
  if (same && phases.every((p) => p !== null)) {
    const inner = joinTerms(shown.map((b, i) => [phases[i], ket(b, n)])) + more;
    if (Math.abs(mag - 1) < EPS) return inner;
    const k = Math.round(1 / (mag * mag));
    if (Math.abs(1 / (mag * mag) - k) < 1e-6) {
      const root = Math.round(Math.sqrt(k));
      return `(${inner})/${root * root === k ? root : `√${k}`}`;
    }
    return `${niceReal(mag)}(${inner})`;
  }
  return joinTerms(shown.map((b) => [formatComplex(re[b], im[b]), ket(b, n)])) + more;
}

export function percent(p) {
  if (p > 0.9995 && p < 1) return '>99.9%';
  if (p > 0 && p < 0.0005) return '<0.1%';
  const v = p * 100;
  return `${v < 10 && v % 1 !== 0 ? v.toFixed(1) : Math.round(v)}%`;
}

export function angleLabel(t) {
  const frac = t / Math.PI;
  const table = [
    [0, '0'],
    [1, 'π'],
    [-1, '−π'],
    [0.5, 'π/2'],
    [-0.5, '−π/2'],
    [0.25, 'π/4'],
    [-0.25, '−π/4'],
    [1 / 3, 'π/3'],
    [2 / 3, '2π/3'],
    [0.75, '3π/4'],
    [1 / 8, 'π/8'],
    [2, '2π'],
  ];
  for (const [f, s] of table) if (Math.abs(frac - f) < 1e-6) return s;
  return `${frac.toFixed(2)}π`;
}
