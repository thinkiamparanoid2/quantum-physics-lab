import { superdenseOps } from '../lib/protocols.js';
import { runCircuitLesson } from '../ui/circuit-lesson.js';

const GATE_FOR = { '00': 'nothing', '01': 'X', '10': 'Z', '11': 'X then Z' };
const BELL_FOR = {
  '00': '(|00⟩ + |11⟩)/√2',
  '01': '(|01⟩ + |10⟩)/√2',
  '10': '(|00⟩ − |11⟩)/√2',
  '11': '(|01⟩ − |10⟩)/√2',
};

runCircuitLesson({
  slug: 'superdense-coding',
  n: 2,
  labels: ['Alice', 'Bob'],
  bloch: true,
  sampler: true,
  reroll: false,
  params: [
    {
      id: 'message',
      label: 'Two bits to send',
      type: 'select',
      value: '10',
      options: ['00', '01', '10', '11'].map((m) => ({ value: m, label: `${m}  (Alice applies ${GATE_FOR[m]})` })),
    },
  ],
  build: ({ message }) => {
    const { ops, paired, encoded, decoded, measured } = superdenseOps(message);
    return [
      {
        title: 'Share a Bell pair',
        ops,
        until: paired,
        html: `<p>Alice and Bob share a Bell pair made earlier: H then CNOT. Alice keeps the top qubit and Bob takes the bottom one away.</p>
          <p>Alice wants to send Bob two classical bits, <b>${message}</b>, but she is only allowed to send him one qubit.</p>`,
      },
      {
        title: 'Alice encodes two bits in one qubit',
        ops,
        until: encoded,
        html: `<p>Depending on the two bits, Alice applies nothing, X, Z, or X then Z to <b>her qubit only</b>. For ${message} she applies ${GATE_FOR[message]}.</p>
          <p>The pair is now in the Bell state ${BELL_FOR[message]}. The four possible messages give the four Bell states, and those four states are perfectly distinguishable.</p>`,
      },
      {
        title: 'She sends her one qubit',
        ops,
        until: encoded,
        html: `<p>Alice sends her qubit to Bob. Anyone who intercepts it learns nothing: on its own, its Bloch arrow has no direction whatever the message is.</p>
          <p>Only together with Bob's half does it carry the two bits.</p>`,
      },
      {
        title: 'Bob decodes: CNOT, then H',
        ops,
        until: decoded,
        html: `<p>Bob now holds both qubits. A CNOT and a Hadamard undo the Bell-pair construction and turn each of the four Bell states into a different basis state.</p>
          <p>The state is now exactly |${message}⟩: no randomness left.</p>`,
      },
      {
        title: 'Bob measures: two bits',
        ops,
        until: measured,
        html: `<p>Measuring both qubits gives <b>${message}</b> every time. Press ×100 in <b>Measure every qubit</b> to check.</p>
          <p>One qubit sent, two bits received. Choose another message in <b>Try it</b>.</p>`,
      },
      {
        title: 'Why this is not free',
        ops,
        until: measured,
        html: `<p>A single qubit on its own can never carry more than one bit (Holevo's theorem). The second bit rode on the Bell pair shared beforehand.</p>
          <p>Superdense coding is teleportation in reverse. Teleportation: one Bell pair + two bits sends one qubit. Superdense coding: one Bell pair + one qubit sends two bits.</p>`,
      },
    ];
  },
});
