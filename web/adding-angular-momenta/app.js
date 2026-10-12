import { clebsch, coupledByDiagonalising, dimOf, mOf, totalJ } from '../lib/angular.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// Coupling two angular momenta j1 and j2: the product basis |m1, m2⟩, the coupled basis |J, M⟩ and
// the Clebsch–Gordan coefficients between them. lib/angular.js computes the coefficients with
// Racah's formula; the lesson also diagonalises J² directly and shows the two agree.

const half = (v) => (Number.isInteger(v) ? String(v) : `${Math.round(v * 2)}/2`).replace('-', '−');
const arrow = (j, m) => (j === 0.5 ? (m > 0 ? '↑' : '↓') : half(m));

function compute(s) {
  const Js = totalJ(s.j1, s.j2);
  const products = [];
  for (let k1 = 0; k1 < dimOf(s.j1); k1++) for (let k2 = 0; k2 < dimOf(s.j2); k2++) products.push({ m1: mOf(s.j1, k1), m2: mOf(s.j2, k2) });
  products.sort((a, b) => b.m1 + b.m2 - (a.m1 + a.m2) || b.m1 - a.m1);
  const coupled = [];
  for (const J of [...Js].reverse()) for (let M = J; M >= -J - 1e-9; M--) coupled.push({ J, M });
  const J = Js.includes(s.J) ? s.J : Js[Js.length - 1];
  // M must differ from J by a whole number; snap the slider to the nearest allowed value.
  const M = Math.max(-J, Math.min(J, J - Math.round(J - s.M)));
  // the same state from diagonalising J²
  const diag = coupledByDiagonalising(s.j1, s.j2).states.find((st) => st.J === J && Math.abs(st.M - M) < 1e-9);
  return { Js, products, coupled, J, M, diag };
}

function drawTable(api) {
  const { ctx, w, h } = prep(api.canvas('cg'));
  const th = api.theme;
  const { j1, j2 } = api.settings;
  const { products, coupled, J, M } = api.model;
  const left = 74;
  const topPad = 70;
  const cell = Math.min((w - left - 10) / coupled.length, (h - topPad - 8) / products.length, 46);
  ctx.font = MONO;
  ctx.textBaseline = 'middle';
  coupled.forEach((c, i) => {
    const x = left + (i + 0.5) * cell;
    const on = c.J === J && Math.abs(c.M - M) < 1e-9;
    ctx.fillStyle = on ? th.accent2 : th.muted;
    ctx.save();
    ctx.translate(x, topPad - 6);
    ctx.rotate(-Math.PI / 4);
    ctx.textAlign = 'left';
    ctx.fillText(`${half(c.J)},${half(c.M)}`, 0, 0);
    ctx.restore();
  });
  products.forEach((p, r) => {
    const y = topPad + (r + 0.5) * cell;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'right';
    ctx.fillText(`${arrow(j1, p.m1)} ${arrow(j2, p.m2)}`, left - 8, y);
    coupled.forEach((c, i) => {
      const x = left + i * cell;
      ctx.strokeStyle = th.grid;
      ctx.strokeRect(x + 0.5, topPad + r * cell + 0.5, cell - 1, cell - 1);
      const v = clebsch(j1, p.m1, j2, p.m2, c.J, c.M);
      if (Math.abs(v) < 1e-12) return;
      ctx.fillStyle = v > 0 ? th.ampPos : th.ampNeg;
      ctx.beginPath();
      ctx.arc(x + cell / 2, topPad + (r + 0.5) * cell, Math.abs(v) * cell * 0.44, 0, 2 * Math.PI);
      ctx.fill();
    });
  });
  // highlight the chosen column
  const i = coupled.findIndex((c) => c.J === J && Math.abs(c.M - M) < 1e-9);
  ctx.strokeStyle = th.accent2;
  ctx.lineWidth = 2;
  ctx.strokeRect(left + i * cell + 1, topPad + 1, cell - 2, products.length * cell - 2);
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('columns: |J, M⟩', 8, 2);
  ctx.fillText('rows: |m₁ m₂⟩', 8, 18);
}

function drawCounting(api) {
  const { ctx, w, h } = prep(api.canvas('count'));
  const th = api.theme;
  const { j1, j2 } = api.settings;
  const { Js } = api.model;
  const Ms = [];
  for (let M = j1 + j2; M >= -j1 - j2 - 1e-9; M--) Ms.push(M);
  const colW = Math.min(42, (w - 90) / Ms.length);
  const x0 = 70;
  const rowH = Math.min(22, (h - 40) / (Js.length + 1));
  ctx.font = MONO;
  ctx.textBaseline = 'middle';
  Ms.forEach((M, i) => {
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.fillText(half(M), x0 + (i + 0.5) * colW, 12);
  });
  ctx.textAlign = 'right';
  ctx.fillText('M =', x0 - 6, 12);
  [...Js].reverse().forEach((J, r) => {
    const y = 30 + r * rowH;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'right';
    ctx.fillText(`J = ${half(J)}`, x0 - 6, y + rowH / 2);
    Ms.forEach((M, i) => {
      if (Math.abs(M) > J + 1e-9) return;
      ctx.fillStyle = withAlpha(J === api.model.J ? th.accent2 : th.exact, 0.8);
      ctx.fillRect(x0 + i * colW + 3, y + 3, colW - 6, rowH - 6);
    });
  });
  const total = dimOf(j1) * dimOf(j2);
  ctx.font = FONT;
  ctx.fillStyle = th.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${dimOf(j1)} × ${dimOf(j2)} = ${total} = ${[...Js].reverse().map((J) => dimOf(J)).join(' + ')}`, x0, 30 + Js.length * rowH + 6);
}

function stateText(api) {
  const { j1, j2 } = api.settings;
  const { products, J, M, diag } = api.model;
  const d2 = dimOf(j2);
  const terms = products
    .map((p) => ({ p, c: clebsch(j1, p.m1, j2, p.m2, J, M) }))
    .filter((t) => Math.abs(t.c) > 1e-12)
    .map((t, i) => {
      const sign = t.c < 0 ? ' − ' : i ? ' + ' : '';
      return `${sign}${fmt(Math.abs(t.c), 3)} |${arrow(j1, t.p.m1)} ${arrow(j2, t.p.m2)}⟩`;
    })
    .join('');
  let worst = 0;
  if (diag) {
    for (let i = 0; i < diag.vector.re.length; i++) {
      const m1 = mOf(j1, Math.floor(i / d2));
      const m2 = mOf(j2, i % d2);
      worst = Math.max(worst, Math.abs(Math.hypot(diag.vector.re[i], diag.vector.im[i]) - Math.abs(clebsch(j1, m1, j2, m2, J, M))));
    }
  }
  api.el('coupled').innerHTML = `<p class="state-formula"><span class="label">|J = ${half(J)}, M = ${half(M)}⟩ =</span>${terms}</p>
    <p class="hint">Found two ways: the Clebsch–Gordan formula, and by diagonalising the
    ${dimOf(j1) * dimOf(j2)} × ${dimOf(j1) * dimOf(j2)} matrix J² = (J₁ + J₂)² directly. They agree to ${worst < 1e-9 ? 'better than 10⁻⁹' : worst.toExponential(1)} (up to the overall sign of each state, a convention).</p>`;
}

function drawFine(api) {
  const { ctx, w, h } = prep(api.canvas('fine'));
  const th = api.theme;
  // p electron: l = 1, s = 1/2. Spin-orbit energy ∝ [J(J+1) − l(l+1) − s(s+1)]/2.
  const levels = [
    { J: 1.5, E: (3.75 - 2 - 0.75) / 2 },
    { J: 0.5, E: (0.75 - 2 - 0.75) / 2 },
  ];
  const Y = (E) => h / 2 - E * (h * 0.28);
  const xa = w * 0.15;
  const xb = w * 0.38;
  const xc = w * 0.55;
  const xd = w * 0.8;
  ctx.strokeStyle = th.muted;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(xa, Y(0));
  ctx.lineTo(xb, Y(0));
  ctx.stroke();
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('p level, no spin–orbit', (xa + xb) / 2, Y(0) - 6);
  ctx.textBaseline = 'top';
  ctx.fillText('6 states', (xa + xb) / 2, Y(0) + 6);
  for (const lv of levels) {
    ctx.strokeStyle = withAlpha(th.muted, 0.5);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xb, Y(0));
    ctx.lineTo(xc, Y(lv.E));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = lv.J === 1.5 ? th.accent2 : th.marked;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(xc, Y(lv.E));
    ctx.lineTo(xd, Y(lv.E));
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`J = ${half(lv.J)}: ${dimOf(lv.J)} states, shift ${fmt(lv.E)} × ξ`, xd + 8, Y(lv.E));
  }
}

const STEPS = [
  {
    title: 'Two spins, four states',
    preset: { j1: 0.5, j2: 0.5, J: 1, M: 1 },
    focus: ['Clebsch–Gordan table', 'The chosen state'],
    html: `<p>Two spin-½ particles have four product states: ↑↑, ↑↓, ↓↑ and ↓↓. Each has a definite total M = m₁ + m₂, but not all have a definite total angular momentum J.</p>
      <p>The table re-expresses them in the <b>coupled</b> basis |J, M⟩: columns are coupled states, rows are product states, and each disc is a coefficient (blue positive, pink negative).</p>`,
  },
  {
    title: 'Triplet and singlet',
    preset: { j1: 0.5, j2: 0.5, J: 0, M: 0 },
    focus: ['Clebsch–Gordan table', 'The chosen state', 'Counting states'],
    html: `<p>The four states regroup into a <b>triplet</b> J = 1 (↑↑, (↑↓ + ↓↑)/√2, ↓↓) and a <b>singlet</b> J = 0, (↑↓ − ↓↑)/√2. The singlet is the Bell state that changes sign when the spins swap.</p>
      <p>That symmetry decides chemistry: two electrons in the same orbital must form the singlet.</p>`,
    predict: {
      q: 'How many coupled states does spin 1 ⊗ spin ½ have, and with which J?',
      options: ['6: J = 3/2 (4 states) and J = 1/2 (2 states)', '6: J = 1 and J = 0', '4: J = 3/2 only', '3: J = 1/2 only'],
      answer: 0,
      why: '3 × 2 = 6 states, and J runs from |1 − ½| = ½ to 1 + ½ = 3/2: 4 + 2 = 6.',
    },
  },
  {
    title: 'Clebsch–Gordan coefficients',
    preset: { j1: 1, j2: 0.5, J: 0.5, M: 0.5 },
    focus: ['Clebsch–Gordan table', 'The chosen state', 'Counting states'],
    html: `<p>For j₁ = 1 and j₂ = ½ the coupled states are J = 3/2 and J = ½. The coefficients ⟨m₁ m₂|J M⟩ are the <b>Clebsch–Gordan coefficients</b>. Here |½, ½⟩ = √(2/3)|1, ↓⟩ − √(1/3)|0, ↑⟩.</p>
      <p>Each row and column of the table is a unit vector: the change of basis is orthogonal.</p>`,
    math: `<span class="eq">|J, M⟩ = Σ ⟨j₁ m₁; j₂ m₂ | J M⟩ |j₁ m₁⟩|j₂ m₂⟩,  with m₁ + m₂ = M</span>
      The coefficients follow from J₋ = J₁₋ + J₂₋ applied down from |j₁ + j₂, j₁ + j₂⟩ = |j₁, j₁⟩|j₂, j₂⟩, plus orthogonality; Racah's formula gives them in closed form.`,
  },
  {
    title: 'Counting states',
    preset: { j1: 2, j2: 1, J: 2, M: 0 },
    focus: ['Counting states', 'Clebsch–Gordan table'],
    html: `<p>J runs from |j₁ − j₂| to j₁ + j₂ in whole steps (the triangle rule), and the counts always add up: (2j₁ + 1)(2j₂ + 1) = Σ (2J + 1). Here 5 × 3 = 15 = 7 + 5 + 3.</p>
      <p>Each column of the grid is a value of M; each row a multiplet J.</p>`,
  },
  {
    title: 'Spin–orbit splitting',
    preset: { j1: 1, j2: 0.5, J: 1.5, M: 1.5 },
    focus: ['Spin–orbit splitting', 'Counting states'],
    html: `<p>An electron in a p orbital (l = 1) has spin ½. The spin–orbit interaction ξ L·S = ξ[J² − L² − S²]/2 depends on how the two couple, so the six states split into J = 3/2 (four states) and J = ½ (two).</p>
      <p>This is the <b>fine structure</b> behind sodium's yellow doublet at 589.0 and 589.6 nm.</p>`,
    math: `<span class="eq">L·S = ½[J(J+1) − l(l+1) − s(s+1)]ħ²</span>
      For l = 1, s = ½: J = 3/2 gives +½, J = ½ gives −1 (times ξħ²). The weighted average, 4 × ½ + 2 × (−1) = 0, is unchanged: the splitting conserves the centre of gravity.`,
  },
  {
    title: 'Your turn',
    preset: { j1: 1.5, j2: 1, J: 1.5, M: 0.5 },
    html: `<p>Choose j₁, j₂, and any coupled state |J, M⟩ to see how it is built from product states, and check it against the direct diagonalisation.</p>`,
  },
];

runLesson({
  slug: 'adding-angular-momenta',
  settings: { j1: 0.5, j2: 0.5, J: 1, M: 1 },
  controls: [
    { id: 'j1', label: 'j₁', type: 'choice', options: [[0.5, '½'], [1, '1'], [1.5, '3/2'], [2, '2']] },
    { id: 'j2', label: 'j₂', type: 'choice', options: [[0.5, '½'], [1, '1']] },
    { id: 'J', label: 'Total J', type: 'range', min: 0, max: 3, step: 0.5, format: (v, s) => half(totalJ(s.j1, s.j2).includes(v) ? v : totalJ(s.j1, s.j2).at(-1)), hint: 'Only |j₁ − j₂| … j₁ + j₂ are allowed; other values jump to the largest.' },
    { id: 'M', label: 'M', type: 'range', min: -3, max: 3, step: 0.5, format: (v) => half(v) },
  ],
  cards: [
    { id: 'cg', title: 'Clebsch–Gordan table', legend: 'disc size = |coefficient|, blue + / pink −', height: 340 },
    { id: 'coupled', title: 'The chosen state', kind: 'html' },
    { id: 'count', title: 'Counting states', legend: 'every multiplet J, by M', height: 170 },
    { id: 'fine', title: 'Spin–orbit splitting', legend: 'a p electron (l = 1, s = ½)', height: 200, folded: true },
  ],
  steps: STEPS,
  compute,
  draw(api) {
    drawTable(api);
    stateText(api);
    drawCounting(api);
    drawFine(api);
  },
});
