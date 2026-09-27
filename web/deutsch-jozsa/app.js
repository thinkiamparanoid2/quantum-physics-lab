import { DJ_ORACLES, djCircuit, registerProbs } from '../lib/algorithms.js';
import { percent } from '../lib/format.js';
import { runCircuitLesson } from '../ui/circuit-lesson.js';

const N_IN = 3;
const INPUTS = [0, 1, 2];
const bin = (x) => x.toString(2).padStart(N_IN, '0');
const p000 = (probs) => registerProbs(probs, INPUTS)[0];

function functionTable(box) {
  return {
    draw({ params, step }) {
      const { f, kind } = djCircuit(N_IN, params.oracle, true);
      const cells = Array.from({ length: 1 << N_IN }, (_, x) => {
        const v = f(x, N_IN);
        return `<div class="fn-cell${v ? ' one' : ''}">x = ${bin(x)}<b>${v}</b></div>`;
      }).join('');
      const done = step.until === step.ops.length;
      box.innerHTML = `<div class="fn-table">${cells}</div>
        <p class="hint">The algorithm never sees this table. ${
          done ? `This function is <b>${kind}</b>.` : 'It only gets to ask the oracle once.'
        }</p>`;
    },
  };
}

function verdict(box) {
  return {
    draw({ probs, step }) {
      if (step.until < step.ops.length - N_IN) {
        box.innerHTML = '<p class="hint">The answer appears after the final Hadamards and measurement.</p>';
        return;
      }
      const p = p000(probs);
      const constant = p > 0.5;
      box.innerHTML = `<div class="verdict ${constant ? 'good' : 'bad'}">
        Chance of measuring 000 on the inputs: <b>${percent(p)}</b>. So f is <b>${constant ? 'constant' : 'balanced'}</b>, decided with one query.</div>`;
    },
  };
}

runCircuitLesson({
  slug: 'deutsch-jozsa',
  n: N_IN + 1,
  labels: ['x0', 'x1', 'x2', 'answer'],
  sampler: { qubits: INPUTS, title: 'Measure the input qubits', legend: 'the answer qubit is left alone' },
  params: [
    {
      id: 'oracle',
      label: 'The hidden function',
      type: 'select',
      value: 'first',
      options: Object.entries(DJ_ORACLES).map(([value, o]) => ({ value, label: o.label })),
    },
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
  views: [
    { title: 'What f does', legend: 'f(x) for every input', mount: functionTable },
    { title: 'Verdict', mount: verdict },
  ],
  build: ({ oracle, reveal }) => {
    const { ops, at } = djCircuit(N_IN, oracle, reveal === 'shown');
    return [
      {
        title: 'The puzzle',
        ops,
        until: 0,
        html: `<p>A black-box function f takes 3 bits and returns 0 or 1. You are promised it is either <b>constant</b> (the same answer for all 8 inputs) or <b>balanced</b> (0 for exactly half of them).</p>
          <p>Which is it? A classical computer must, in the worst case, check 5 of the 8 inputs to be certain. Deutsch–Jozsa asks once.</p>`,
      },
      {
        title: 'Prepare',
        ops,
        until: at.prepared,
        html: `<p>X then H puts the answer qubit in |−⟩. H on each input spreads the amplitude evenly over all 8 inputs at once.</p>
          <p>In the <b>State</b> panel, each input appears twice (answer qubit 0 and 1) with opposite signs: that's the |−⟩ factor.</p>`,
      },
      {
        title: 'One query',
        ops,
        until: at.queried,
        html: `<p>The oracle adds f(x) to the answer qubit. Because that qubit is |−⟩, adding 1 just flips its sign, and the sign <b>kicks back</b> onto the input.</p>
          <p>Every input with f(x) = 1 now has flipped amplitudes (compare the dial colours with <b>What f does</b>). One query has written all 8 answers into phases.</p>`,
      },
      {
        title: 'Interfere',
        ops,
        until: at.interfered,
        html: ({ probs }) => `<p>H on the inputs again. If f is constant, every sign was the same and all the amplitude flows back to |000⟩.
          If f is balanced, |000⟩ gets half + and half − contributions, and they cancel <b>exactly</b>.</p>
          <p>Right now |000⟩ has probability <b>${percent(p000(probs))}</b>.</p>`,
      },
      {
        title: 'Measure',
        ops,
        until: at.measured,
        html: `<p>Measure the three inputs. All zeros means constant; anything else means balanced. No luck involved: the answer is certain.</p>
          <p>Press <b>×100</b> to check, then pick a different function in <b>Try it</b>.</p>`,
      },
      {
        title: 'Open the box',
        ops,
        until: at.measured,
        html: `<p>Set <b>Oracle</b> to "Show the gates inside". Each oracle here is a few CNOTs (plus an X for the NOT versions): f(x) is a sum of some input bits, mod 2.</p>
          <p>Try every function: the verdict is right every time, with one query.</p>`,
      },
      {
        title: 'The honest caveat',
        ops,
        until: at.measured,
        html: `<p>The speedup is exponential over a classical algorithm that must be <i>certain</i>. A classical algorithm allowed a small chance of error needs only a handful of random queries.</p>
          <p>Its real importance: it was one of the first proofs that quantum queries can beat classical ones, and it introduced the pattern every algorithm here uses: <b>prepare, query, interfere, measure</b>.</p>`,
      },
    ];
  },
});
