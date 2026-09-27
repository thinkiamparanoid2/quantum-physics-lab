import { bvCircuit, registerProbs } from '../lib/algorithms.js';
import { percent } from '../lib/format.js';
import { runCircuitLesson } from '../ui/circuit-lesson.js';

const INPUTS = [0, 1, 2, 3];

function readout(box) {
  return {
    draw({ params, probs, step, bits }) {
      const reg = registerProbs(probs, INPUTS);
      const best = reg.indexOf(Math.max(...reg));
      const guess = best.toString(2).padStart(4, '0');
      const measured = step.until === step.ops.length ? INPUTS.map((q) => bits[q]).join('') : null;
      box.innerHTML = `<div class="verdict ${measured === params.s ? 'good' : ''}">
        Hidden string: <b class="mono">${params.s}</b> ·
        ${measured ? `measured: <b class="mono">${measured}</b> after 1 query` : `most likely outcome now: <span class="mono">${guess}</span> (${percent(reg[best])})`}
      </div>`;
    },
  };
}

runCircuitLesson({
  slug: 'bernstein-vazirani',
  n: 5,
  labels: ['x0', 'x1', 'x2', 'x3', 'answer'],
  sampler: { qubits: INPUTS, title: 'Measure the input qubits', legend: 'the answer qubit is left alone' },
  dials: true,
  params: [
    { id: 's', label: 'Hidden string s (click to change)', type: 'bits', value: '1011' },
    {
      id: 'reveal',
      label: 'Oracle',
      type: 'select',
      value: 'hidden',
      options: [
        { value: 'hidden', label: 'Black box' },
        { value: 'shown', label: 'Show the gates inside' },
      ],
    },
  ],
  views: [{ title: 'Result', mount: readout }],
  build: ({ s: secret, reveal }) => {
    const { ops, at } = bvCircuit(secret, reveal === 'shown');
    return [
      {
        title: 'The puzzle',
        ops,
        until: 0,
        html: `<p>The oracle hides a string of 4 bits, s. Asked about an input x, it answers s·x: the number of positions where both x and s have a 1, mod 2.</p>
          <p>Classically each answer reveals at most one bit of s, so you need 4 queries (x = 1000, 0100, 0010, 0001). Bernstein–Vazirani needs one.</p>`,
      },
      {
        title: 'Prepare',
        ops,
        until: at.prepared,
        html: `<p>Exactly as in Deutsch–Jozsa: the answer qubit goes to |−⟩, and the inputs into an equal superposition of all 16 strings.</p>`,
      },
      {
        title: 'One query',
        ops,
        until: at.queried,
        html: `<p>Phase kickback again: every input x picks up the sign (−1)<sup>s·x</sup>. The pattern of signs across all 16 inputs is a fingerprint of s.</p>`,
      },
      {
        title: 'Interfere',
        ops,
        until: at.interfered,
        html: `<p>That sign pattern is exactly what Hadamards produce from the state |s⟩. So applying H again runs the process backwards: all the amplitude lands on |s⟩ = |${secret}⟩.</p>`,
      },
      {
        title: 'Measure',
        ops,
        until: at.measured,
        html: `<p>Measuring the inputs reads out <b>${secret}</b> with certainty: all four bits of the secret from a single question.</p>
          <p>Click the bits of s in <b>Try it</b> to hide a different string.</p>`,
      },
      {
        title: 'Why it matters',
        ops,
        until: at.measured,
        html: `<p>Against classical algorithms the advantage is n queries versus 1, even allowing randomness, which Deutsch–Jozsa couldn't claim.</p>
          <p>The idea underneath, reading a hidden pattern out of phases with a Hadamard transform, reappears with the quantum Fourier transform in Shor's algorithm.</p>`,
      },
    ];
  },
});
