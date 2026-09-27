import { SHOR_N, classicalPeriod, modPow, registerProbs, shorCircuit, shorPostProcess } from '../lib/algorithms.js';
import { runCircuitLesson } from '../ui/circuit-lesson.js';
import { phaseColor } from '../ui/dials.js';
import { registerChart } from '../ui/register-chart.js';

const T = 4;
const COUNT = [0, 1, 2, 3];
const WORK = [4, 5, 6, 7];

function powerTable(box) {
  return {
    draw({ params }) {
      const a = Number(params.a);
      const r = classicalPeriod(a, SHOR_N);
      const values = [...new Set(Array.from({ length: r }, (_, x) => modPow(a, x, SHOR_N)))];
      const cells = Array.from({ length: 16 }, (_, x) => {
        const v = modPow(a, x, SHOR_N);
        const hue = phaseColor((2 * Math.PI * values.indexOf(v)) / values.length, 0.28);
        return `<div class="fn-cell" style="background:${hue}">x = ${x}<b>${v}</b></div>`;
      }).join('');
      box.innerHTML = `<div class="fn-table">${cells}</div>
        <p class="hint">f(x) = ${a}<sup>x</sup> mod 15. The colours repeat every <b>${r}</b> steps: that repeat length is the period r.
        Here we can just look; for a 600-digit N no computer could list enough values to see it.</p>`;
    },
  };
}

function counting(canvas, { theme, preProbs, step, bits }) {
  const reg = registerProbs(preProbs, COUNT);
  const measured = step.until === step.ops.length ? COUNT.reduce((y, q) => (y << 1) | bits[q], 0) : -1;
  registerChart(canvas, { theme, probs: reg, highlight: measured });
}

function arithmetic(box) {
  return {
    draw({ params, step, bits }) {
      if (step.until < step.ops.length) {
        box.innerHTML = '<p class="hint">The classical arithmetic runs once the counting register has been measured (last steps).</p>';
        return;
      }
      const a = Number(params.a);
      const y = COUNT.reduce((acc, q) => (acc << 1) | bits[q], 0);
      const res = shorPostProcess(y, T, a);
      const lines = [`<li>Measured <code>y = ${y}</code>, so y/16 = ${y}/16 is close to some k/r.</li>`];
      if (res.fractions?.length) {
        lines.push(`<li>Continued fractions of ${y}/16 give ${res.fractions.map((c) => `<code>${c.p}/${c.q}</code>`).join(', ')}.</li>`);
      }
      if (res.r) {
        lines.push(`<li>Smallest r with ${a}<sup>r</sup> mod 15 = 1: <code>r = ${res.r}</code>.</li>`);
      }
      if (res.half !== undefined) {
        lines.push(`<li>${a}<sup>${res.r / 2}</sup> mod 15 = <code>${res.half}</code>.</li>`);
      }
      if (res.ok) {
        lines.push(`<li>gcd(${res.half} − 1, 15) = <code>${res.f1}</code> and gcd(${res.half} + 1, 15) = <code>${res.f2}</code>.</li>`);
      }
      box.innerHTML = `<ol class="post-steps">${lines.join('')}</ol>
        <div class="verdict ${res.ok ? 'good' : 'bad'}">${res.ok ? `15 = <b>${res.f1} × ${res.f2}</b>` : res.reason}</div>`;
    },
  };
}

runCircuitLesson({
  slug: 'shor',
  n: 8,
  labels: ['x3 (8s)', 'x2 (4s)', 'x1 (2s)', 'x0 (1s)', 'w3', 'w2', 'w1', 'w0'],
  dials: false,
  sampler: { qubits: COUNT, title: 'Measure the counting register', legend: 'peaks sit at multiples of 16/r', label: (y) => `${y}` },
  params: [
    {
      id: 'a',
      label: 'Random base a (coprime to 15)',
      type: 'select',
      value: '7',
      options: [2, 4, 7, 8, 11, 13, 14].map((a) => ({ value: String(a), label: `a = ${a} (period ${classicalPeriod(a, SHOR_N)})` })),
    },
  ],
  views: [
    { title: 'f(x) = a^x mod 15', legend: 'the function whose period we need', mount: powerTable },
    { title: 'Counting register', legend: 'probability of each value 0–15', height: 220, draw: counting },
    { title: 'The classical finish', legend: 'from a measured y to the factors', mount: arithmetic },
  ],
  build: ({ a }) => {
    const { ops, at } = shorCircuit(Number(a), { t: T });
    const r = classicalPeriod(Number(a), SHOR_N);
    return [
      {
        title: 'Factoring is period finding',
        ops,
        until: 0,
        html: `<p>To factor N = 15, pick a random a with no common factor with 15; here a = ${a}. The powers a<sup>x</sup> mod 15 repeat with some period r (see the table).</p>
          <p>If r is even, gcd(a<sup>r/2</sup> ± 1, 15) are factors of 15. Everything is easy except finding r, which is hard classically for big N. The quantum computer's only job is to find r.</p>`,
      },
      {
        title: 'All inputs at once',
        ops,
        until: at.prepared,
        html: `<p>The top four qubits (the counting register, x) go into an equal superposition of 0–15. The bottom four (the work register) are set to 1.</p>`,
      },
      {
        title: 'Compute a^x mod 15 for every x',
        ops,
        until: at.exponentiated,
        html: `<p>One block multiplies the work register by a<sup>x</sup> mod 15, for all 16 values of x in superposition. The two registers are now entangled: each x is paired with its f(x).</p>
          <p>On real hardware this block is built from many gates, and it's the most expensive part. Here the simulator computes it directly.</p>`,
      },
      {
        title: 'Look at the work register',
        ops,
        until: at.workMeasured,
        html: ({ bits }) => {
          const w = [4, 5, 6, 7].reduce((acc, q) => (acc << 1) | bits[q], 0);
          return `<p>Measuring the work register gives f(x) = ${w}. The counting register collapses to only the x values with that output: a comb with spacing <b>r = ${r}</b> (see <b>Counting register</b>).</p>
            <p>The comb's position is random, so measuring x now would be useless. We need its <i>spacing</i>.</p>`;
        },
      },
      {
        title: 'The inverse QFT finds the spacing',
        ops,
        until: at.transformed,
        html: `<p>As in the QFT lesson, a periodic input becomes peaks: at multiples of 16/r = ${16 / r}, whatever the comb's position.</p>
          <p>The counting register now holds the period's fingerprint.</p>`,
      },
      {
        title: 'Measure, then do the arithmetic',
        ops,
        until: at.measured,
        html: `<p>Measure the counting register, then finish on an ordinary computer (see <b>The classical finish</b>): continued fractions turn y/16 into k/r, and a gcd gives the factors.</p>
          <p>Press <b>Measure again</b> in Try it for another run. y = 0 happens sometimes and just means "try again".</p>`,
      },
      {
        title: 'Try every a, and the real scale',
        ops,
        until: at.measured,
        html: `<p>Try other values of a. Most work; a = 14 finds r = 2 but 14<sup>1</sup> ≡ −1 (mod 15), which only gives trivial factors, so you pick another a.</p>
          <p>Factoring 15 needs 8 qubits here. Recent estimates for breaking 2048-bit RSA are around a million noisy physical qubits running for days, far beyond today's machines, which is why "post-quantum" encryption is already being rolled out.</p>`,
      },
    ];
  },
});
