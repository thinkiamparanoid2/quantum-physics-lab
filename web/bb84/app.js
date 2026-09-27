import { seededRandom } from '../lib/circuit.js';
import { percent } from '../lib/format.js';
import { eveEscapes, runBB84 } from '../lib/protocols.js';
import { FONT, MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { mountLesson } from '../ui/lesson.js';

// reveal: 1 Alice's rows, 2 + Bob, 3 + basis comparison and key, 4 + Eve.
const STEPS = [
  {
    title: 'The goal: a shared secret key',
    eve: false,
    reveal: 0,
    html: `<p>Alice and Bob want a shared random key, a string of bits only they know, to encrypt messages with. Anything sent over an ordinary channel can be copied without anyone noticing.</p>
      <p>BB84 (Bennett and Brassard, 1984) sends the key on single photons, where copying is impossible and <b>looking leaves marks</b>.</p>`,
  },
  {
    title: 'Alice picks bits and bases',
    eve: false,
    reveal: 1,
    html: `<p>For each photon Alice picks a random bit and a random <b>basis</b>. In the + basis she sends 0 as → and 1 as ↑. In the × basis she sends 0 as ↗ and 1 as ↖.</p>
      <p>In qubit terms, + is the |0⟩/|1⟩ basis and × is the |+⟩/|−⟩ basis.</p>`,
  },
  {
    title: 'Bob measures in random bases',
    eve: false,
    reveal: 2,
    html: `<p>Bob doesn't know Alice's bases, so he picks his own at random for each photon.</p>
      <p>When his basis matches hers, he reads her bit exactly. When it doesn't, quantum mechanics gives him a coin flip: 0 or 1 with equal odds, whatever Alice sent.</p>`,
  },
  {
    title: 'Compare bases, keep the matches',
    eve: false,
    reveal: 3,
    html: ({ run }) => `<p>Now Alice and Bob announce their <b>bases</b> (never the bits) in public, and keep only the photons where the bases matched: about half, here ${run.sifted} of ${run.rows.length}.</p>
      <p>Those bits are their shared key, and they agree exactly (see <b>The key</b>). Knowing the bases alone tells an outsider nothing about the bits.</p>`,
  },
  {
    title: 'Enter Eve',
    eve: true,
    reveal: 4,
    html: ({ run }) => `<p>Now an eavesdropper, Eve, intercepts every photon, measures it in her own random basis, and sends Bob a new photon matching what she saw.</p>
      <p>Half the time she guesses the wrong basis. Her measurement then randomises the photon, and Bob's bit can come out wrong even when his basis matches Alice's. In this run ${run.errors} of the ${run.sifted} key bits disagree.</p>`,
  },
  {
    title: 'Catching her',
    eve: true,
    reveal: 4,
    html: `<p>Alice and Bob publicly compare a random sample of their key bits and throw those away. Eve causes errors in about <b>25%</b> of key bits, so each compared bit has a 3/4 chance of hiding her.</p>
      <p>After comparing 20 bits, the chance she stays hidden is (3/4)<sup>20</sup> ≈ 0.3%. If the error rate is too high, they discard the key and try again. Eve can't win, and she can't hide.</p>`,
  },
  {
    title: 'Your turn',
    eve: false,
    reveal: 4,
    html: `<p>Switch Eve on and off, add channel noise, and start new runs.</p>
      <p>Real links always have some noise, so Alice and Bob can't blame every error on Eve. The protocol stays secure as long as the error rate is below about 11%, using extra classical steps (error correction and privacy amplification) to fix errors and squeeze out anything Eve might know.</p>`,
  },
];

const PHOTON = { '+': ['→', '↑'], x: ['↗', '↖'] };
const BASIS = { '+': '+', x: '×' };

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<figure class="panel card">
    <figcaption class="card-head"><h2>Photons</h2><span class="legend">+ basis: → = 0, ↑ = 1 · × basis: ↗ = 0, ↖ = 1</span></figcaption>
    <div class="table-scroll"><table class="bb84-table" id="table"></table></div>
  </figure>
  <figure class="panel card">
    <figcaption class="card-head"><h2>The key</h2><span class="legend">bits kept where the bases matched</span></figcaption>
    <div id="keys"></div>
  </figure>
  <figure class="panel card">
    <figcaption class="card-head"><h2>Is anyone listening?</h2><span class="legend">statistics over 4,000 photons with the current settings</span></figcaption>
    <div class="split">
      <dl class="facts" id="stats" style="margin-top: 0; border-top: 0; padding-top: 0"></dl>
      <canvas id="escape" class="chart" role="img" aria-label="Chance an eavesdropper stays hidden against the number of key bits compared"></canvas>
    </div>
  </figure>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field" style="display: flex; gap: 10px; align-items: center">
      <input id="eve" type="checkbox" style="width: 18px; height: 18px; accent-color: var(--accent)">
      <span>Eve intercepts every photon</span>
    </label>
    <label class="field"><span class="label">Channel noise <output id="noise-out"></output></span>
      <input id="noise" type="range" min="0" max="0.15" step="0.01" value="0"></label>
    <label class="field"><span class="label">Photons</span>
      <select id="photon-count"><option>12</option><option selected>16</option><option>24</option><option>32</option></select></label>
    <div class="row" style="margin-top: 14px"><button id="rerun" class="btn btn-primary" type="button">New run</button></div>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { eve: false, noise: 0, count: 16 };
let seed = (Math.random() * 2 ** 32) >>> 0;
let index = 0;
let run = null;

const lesson = mountLesson({ slug: 'bb84', onNavigate: (i) => enterStep(i) });

function simulate() {
  run = runBB84({ count: settings.count, eve: settings.eve, noise: settings.noise, rng: seededRandom(seed) });
}

function enterStep(i) {
  index = i;
  settings.eve = STEPS[i].eve;
  $('eve').checked = settings.eve;
  simulate();
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  render();
}

function cell(content, cls = '') {
  return `<td class="${cls}">${content}</td>`;
}

function renderTable(reveal) {
  const rows = run.rows;
  const line = (label, cells, cls = '') => `<tr class="${cls}"><th scope="row">${label}</th>${cells.join('')}</tr>`;
  const html = [line('Photon', rows.map((_, i) => `<td class="num">${i + 1}</td>`), 'head')];
  if (reveal >= 1) {
    html.push(line("Alice's bit", rows.map((r) => cell(r.aliceBit))));
    html.push(line("Alice's basis", rows.map((r) => cell(BASIS[r.aliceBasis]))));
    html.push(line('Photon sent', rows.map((r) => cell(PHOTON[r.aliceBasis][r.aliceBit], 'photon'))));
  }
  if (reveal >= 4 && settings.eve) {
    html.push(line("Eve's basis", rows.map((r) => cell(BASIS[r.eveBasis], r.eveBasis !== r.aliceBasis ? 'eve-miss' : 'eve'))));
    html.push(line('Eve resends', rows.map((r) => cell(PHOTON[r.eveBasis][r.eveBit], 'photon eve'))));
  }
  if (reveal >= 2) {
    html.push(line("Bob's basis", rows.map((r) => cell(BASIS[r.bobBasis]))));
    html.push(line("Bob's bit", rows.map((r) => cell(r.bobBit, reveal >= 3 && !r.match ? 'dim' : ''))));
  }
  if (reveal >= 3) {
    html.push(line('Bases match?', rows.map((r) => cell(r.match ? '✓' : '', r.match ? 'agree' : 'dim'))));
    html.push(
      line(
        'Key bit',
        rows.map((r) => (r.match ? cell(r.aliceBit === r.bobBit ? r.bobBit : `${r.bobBit}≠${r.aliceBit}`, r.aliceBit === r.bobBit ? 'keybit' : 'badbit') : cell('', 'dim'))),
      ),
    );
  }
  $('table').innerHTML = html.join('');
}

function renderKeys(reveal) {
  if (reveal < 3) {
    $('keys').innerHTML = '<p class="hint">The key appears once Alice and Bob compare bases (step 4).</p>';
    return;
  }
  const kept = run.rows.filter((r) => r.match);
  const bits = (who) =>
    kept.map((r) => `<span class="${r.aliceBit !== r.bobBit ? 'bit-error' : ''}">${who === 'alice' ? r.aliceBit : r.bobBit}</span>`).join('');
  $('keys').innerHTML = `
    <p class="key-line"><span class="label">Alice</span><span class="key-bits">${bits('alice')}</span></p>
    <p class="key-line"><span class="label">Bob</span><span class="key-bits">${bits('bob')}</span></p>
    <p class="hint">${kept.length} key bits; ${run.errors} disagree (${percent(run.qber)}).
      ${run.errors === 0 ? 'Identical keys.' : 'Mismatches are shown in red.'}</p>`;
}

function renderStats(th) {
  const big = runBB84({ count: 4000, eve: settings.eve, noise: settings.noise, rng: seededRandom(seed ^ 0x5bd1e995) });
  const verdict =
    big.qber > 0.11
      ? '<span class="hit">Too many errors: abort and try again</span>'
      : big.qber > 0
        ? 'Errors within the safe limit: correct them, then shrink the key'
        : 'No errors: the channel is clean';
  $('stats').innerHTML = `
    <dt>Eve listening</dt><dd>${settings.eve ? 'yes, every photon' : 'no'}</dd>
    <dt>Channel noise</dt><dd>${percent(settings.noise)}</dd>
    <dt>Photons kept</dt><dd>${percent(big.sifted / 4000)} (bases matched)</dd>
    <dt>Key error rate</dt><dd><b>${percent(big.qber)}</b></dd>
    <dt>Verdict</dt><dd>${verdict}</dd>`;

  const { ctx, w, h } = prep($('escape'));
  const box = { x0: 46, y0: 12, x1: w - 12, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, 1], th);
  const X = xAxis(ctx, box, [0, 40], th, { integer: true });
  ctx.strokeStyle = th.ampNeg;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let k = 0; k <= 40; k++) {
    if (k === 0) ctx.moveTo(X(k), Y(eveEscapes(k)));
    else ctx.lineTo(X(k), Y(eveEscapes(k)));
  }
  ctx.stroke();
  ctx.fillStyle = th.ampNeg;
  ctx.beginPath();
  ctx.arc(X(20), Y(eveEscapes(20)), 5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.font = FONT;
  ctx.fillStyle = th.text;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('Chance Eve stays hidden', box.x1, box.y0 + 4);
  ctx.fillStyle = th.muted;
  ctx.fillText(`after 20 bits: ${percent(eveEscapes(20))}`, box.x1, box.y0 + 22);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('key bits compared', (box.x0 + box.x1) / 2, h);
}

function render() {
  const step = STEPS[index];
  const reveal = step.reveal;
  renderTable(reveal);
  renderKeys(reveal);
  renderStats(theme());
  $('noise-out').textContent = percent(settings.noise);
  lesson.render(
    STEPS.map((s, i) => ({ title: s.title, html: i === index ? (typeof s.html === 'function' ? s.html({ run }) : s.html) : '' })),
    index,
  );
}

$('eve').addEventListener('change', () => {
  settings.eve = $('eve').checked;
  simulate();
  render();
});
$('noise').addEventListener('input', () => {
  settings.noise = Number($('noise').value);
  simulate();
  render();
});
$('photon-count').addEventListener('change', () => {
  settings.count = Number($('photon-count').value);
  simulate();
  render();
});
$('rerun').addEventListener('click', () => {
  seed = (Math.random() * 2 ** 32) >>> 0;
  simulate();
  render();
});
window.addEventListener('themechange', () => render());
new ResizeObserver(() => renderStats(theme())).observe($('escape'));

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
