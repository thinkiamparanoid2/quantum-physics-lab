import { qpeCircuit, registerProbs } from '../lib/algorithms.js';
import { percent } from '../lib/format.js';
import { runCircuitLesson } from '../ui/circuit-lesson.js';
import { registerChart } from '../ui/register-chart.js';

const T = 4;
const COUNT = [0, 1, 2, 3];
const Q = 2 ** T;

function counting(canvas, { theme, preProbs, params, step }) {
  const phi = step.phi ?? params.phi;
  const reg = registerProbs(preProbs, COUNT);
  registerChart(canvas, {
    theme,
    probs: reg,
    labels: reg.map((_, y) => `${y}/16`),
    highlight: reg.indexOf(Math.max(...reg)),
    marker: phi * Q,
    markerLabel: `true φ = ${Number(phi.toFixed(4))}`,
  });
}

function estimate({ preProbs, params, step }) {
  const phi = step.phi ?? params.phi;
  const reg = registerProbs(preProbs, COUNT);
  const y = reg.indexOf(Math.max(...reg));
  return `Most likely reading: y = ${y}, so φ ≈ ${y}/16 = <b>${y / Q}</b> (true value ${Number(phi.toFixed(4))}, chance ${percent(reg[y])}).`;
}

runCircuitLesson({
  slug: 'phase-estimation',
  n: T + 1,
  labels: ['c0 (1/2)', 'c1 (1/4)', 'c2 (1/8)', 'c3 (1/16)', 'target'],
  dials: false,
  bloch: COUNT,
  sampler: { qubits: COUNT, title: 'Measure the counting register', legend: 'y, read q0 first; the estimate is y/16', label: (y) => `${y}` },
  params: [
    {
      id: 'phi',
      label: 'Hidden phase φ (in turns)',
      type: 'range',
      min: 0,
      max: 1 - 1 / 64,
      step: 1 / 64,
      value: 0.625,
      format: (v) => `${Number(v.toFixed(4))}`,
      hint: '0.625 = 10/16 is exact in 4 bits. Try 0.3 or 0.7.',
    },
  ],
  views: [
    { title: 'Counting register', legend: 'probability of each reading y', height: 240, draw: counting, caption: (ctx) => estimate(ctx) },
  ],
  build: ({ phi }) => {
    const main = qpeCircuit(T, phi);
    const off = qpeCircuit(T, 0.3);
    return [
      {
        title: 'The problem',
        ops: main.ops,
        until: 0,
        html: `<p>A gate U turns its eigenstate |1⟩ by an unknown phase: U|1⟩ = e<sup>2πiφ</sup>|1⟩. We want φ (measured in turns) to several binary digits.</p>
          <p>A phase can't be measured directly. Phase estimation turns it into a number you can read out.</p>`,
      },
      {
        title: 'Prepare',
        ops: main.ops,
        until: main.at.prepared,
        html: `<p>X prepares the target in the eigenstate |1⟩. H puts the four counting qubits on the equator of their Bloch spheres.</p>`,
      },
      {
        title: 'Phase kickback',
        ops: main.ops,
        until: main.at.kicked,
        html: `<p>Counting qubit c<sub>k</sub> controls U applied 2<sup>${T - 1}</sup>, …, 2, 1 times. The target is an eigenstate, so it doesn't change: instead each counting qubit's arrow <b>turns around its equator</b> by φ times that power.</p>
          <p>The Bloch spheres now hold φ's binary digits as rotations: c3 turned by φ, c2 by 2φ, c1 by 4φ, c0 by 8φ.</p>`,
      },
      {
        title: 'Inverse QFT',
        ops: main.ops,
        until: main.at.transformed,
        html: `<p>That pattern of turns is exactly what the QFT produces from the number φ·16. So the inverse QFT converts it back into the number.</p>
          <p>See <b>Counting register</b>: the probability piles up on y = φ·16.</p>`,
      },
      {
        title: 'Measure',
        ops: main.ops,
        until: main.at.measured,
        html: ({ preProbs }) => `<p>Measure the counting register and divide by 16. ${estimate({ preProbs, params: { phi }, step: {} })}</p>
          <p>With φ = 0.625 = 0.1010 in binary the answer is certain.</p>`,
      },
      {
        title: 'Between the ticks',
        ops: off.ops,
        until: off.at.transformed,
        phi: 0.3,
        html: `<p>With φ = 0.3, no reading y/16 is exact. The probability spreads over the nearest values, peaking at 5/16 = 0.3125.</p>
          <p>The closest estimate always has at least 4/π² ≈ 41% probability, and each extra counting qubit doubles the precision.</p>`,
      },
      {
        title: 'Why it matters',
        ops: main.ops,
        until: main.at.measured,
        html: `<p>Phase estimation is the engine of many quantum algorithms. In Shor's algorithm, U multiplies by a number mod N, its phases are fractions s/r, and reading them reveals the period r.</p>
          <p>Drag φ in <b>Try it</b> and watch the peak follow it.</p>`,
      },
    ];
  },
});
