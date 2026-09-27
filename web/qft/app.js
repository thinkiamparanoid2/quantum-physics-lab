import { basisPrep, qftOps } from '../lib/algorithms.js';
import { runCircuitLesson } from '../ui/circuit-lesson.js';

const REG = [0, 1, 2];
const H = (q) => ({ gate: 'H', target: q });
const X = (q) => ({ gate: 'X', target: q });

// Periodic inputs, written as the gates that prepare them (q0 is the most significant bit).
const PERIODIC = {
  per2: { label: 'Every 2nd number: 0, 2, 4, 6', ops: [H(0), H(1)], period: 2 },
  per2s: { label: 'Every 2nd number, shifted: 1, 3, 5, 7', ops: [H(0), H(1), X(2)], period: 2 },
  per4: { label: 'Every 4th number: 0, 4', ops: [H(0)], period: 4 },
};

const INPUTS = [
  ...Array.from({ length: 8 }, (_, x) => ({ value: `x${x}`, label: `The number ${x}: |${x.toString(2).padStart(3, '0')}⟩` })),
  ...Object.entries(PERIODIC).map(([value, p]) => ({ value, label: p.label })),
];

function prepFor(input) {
  if (PERIODIC[input]) return PERIODIC[input].ops;
  return basisPrep(Number(input.slice(1)), REG);
}

const turns = (x, d) => {
  const f = (x / d) % 1;
  return f === 0 ? 'no turn' : `${Number(f.toFixed(3))} of a turn`;
};

runCircuitLesson({
  slug: 'qft',
  n: 3,
  labels: ['q0 (4s)', 'q1 (2s)', 'q2 (1s)'],
  bloch: true,
  sampler: { qubits: REG, title: 'Measure the output', legend: 'read as a number, q0 first' },
  params: [{ id: 'input', label: 'Input', type: 'select', value: 'x1', options: INPUTS, hint: 'Used from step 1 to step 5 and in the last step.' }],
  build: ({ input }) => {
    const prep = prepFor(input);
    const ops = [...prep, ...qftOps(REG)];
    const p = prep.length;
    const x = PERIODIC[input] ? null : Number(input.slice(1));
    const period = (key) => {
      const pOps = PERIODIC[key].ops;
      return { ops: [...pOps, ...qftOps(REG)], until: pOps.length + qftOps(REG).length };
    };
    return [
      {
        title: 'Numbers as states',
        ops,
        until: p,
        html: `<p>Three qubits can hold a number from 0 to 7 in binary, most significant bit on top. |101⟩ means 5.</p>
          <p>${x === null ? 'This input is a superposition of several numbers.' : `The input is ${x}. Change it in <b>Try it</b>.`} The quantum Fourier transform (QFT) will turn it into a pattern of phases.</p>`,
      },
      {
        title: 'Top qubit: H and two phase kicks',
        ops,
        until: p + 3,
        html: `<p>H puts the top qubit into superposition. Then two controlled phase gates turn it a little more, by a quarter turn if q1 is 1 and an eighth of a turn if q2 is 1.</p>
          <p>The amount the top qubit turns now depends on the whole number.</p>`,
      },
      {
        title: 'Middle qubit',
        ops,
        until: p + 5,
        html: `<p>The same recipe, one qubit down: H, then a quarter-turn controlled by q2.</p>`,
      },
      {
        title: 'Bottom qubit',
        ops,
        until: p + 6,
        html: `<p>The last qubit only needs an H.</p>`,
      },
      {
        title: 'Swap, and read the clock hands',
        ops,
        until: ops.length,
        html:
          x === null
            ? `<p>A final SWAP puts the qubits in the textbook order. Pick a single number as the input in <b>Try it</b> to see the clock-hand pattern clearly.</p>`
            : `<p>A final SWAP puts the qubits in the textbook order. Now every output has the same size, and the hands step around the circle: output y is turned by ${x}·y/8 of a turn.</p>
              <p>The input number has become a <b>rotation speed</b>. On the Bloch spheres each qubit sits on the equator turned by ${turns(x, 2)}, ${turns(x, 4)} and ${turns(x, 8)}.</p>`,
      },
      {
        title: 'Periodic in, peaks out',
        ...period('per2'),
        html: `<p>The QFT's superpower: a <b>periodic</b> input becomes sharp <b>peaks</b>. Here the input is 0, 2, 4, 6 (period 2), and the output is only 0 or 4: multiples of 8/2.</p>
          <p>Press ×100 under <b>Measure the output</b> to see it.</p>`,
      },
      {
        title: 'A different period',
        ...period('per4'),
        html: `<p>Period 4 (the input is 0 and 4) gives peaks at multiples of 8/4 = 2: outputs 0, 2, 4 and 6.</p>
          <p>Measure the peak spacing and you know the period. That is exactly the step Shor's algorithm needs.</p>`,
      },
      {
        title: 'Your turn',
        ops,
        until: ops.length,
        html: `<p>Try every input in <b>Try it</b>. Shifting a periodic input (1, 3, 5, 7) changes the phases but not where the peaks are: the QFT finds the period wherever the pattern starts.</p>`,
      },
    ];
  },
});
