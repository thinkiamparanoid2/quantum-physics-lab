import { blochVector } from '../lib/bloch.js';
import { angleLabel, percent } from '../lib/format.js';
import { TELEPORT, messageVector, teleportOps } from '../lib/protocols.js';
import { BlochView } from '../ui/bloch.js';
import { runCircuitLesson } from '../ui/circuit-lesson.js';

// Side by side: the message Alice started with, and Bob's qubit now, with their fidelity.
function comparison(box) {
  box.innerHTML = `<div class="bloch-row"><canvas role="img" aria-label="The message Alice wants to send"></canvas>
    <canvas role="img" aria-label="Bob's qubit"></canvas></div><p class="hint" aria-live="polite"></p>`;
  const [a, b] = box.querySelectorAll('canvas');
  const message = new BlochView(a, { title: 'The message Alice started with', labels: 'poles' });
  const bob = new BlochView(b, { title: "Bob's qubit now", labels: 'poles' });
  const note = box.querySelector('p');
  return {
    draw({ params, shownState, step, theme }) {
      const m = messageVector(params.theta, params.phi);
      const v = blochVector(shownState, 2);
      message.vector = m;
      bob.vector = v;
      message.draw(theme);
      bob.draw(theme);
      const fidelity = (1 + m[0] * v[0] + m[1] * v[1] + m[2] * v[2]) / 2;
      note.innerHTML =
        step.until >= TELEPORT.corrected
          ? `Fidelity <b>${percent(fidelity)}</b>: Bob now holds exactly the state Alice started with.`
          : `Fidelity ${percent(fidelity)}. ${Math.hypot(...v) < 0.02 ? "Bob's qubit on its own has no direction at all yet." : 'Not the message yet.'}`;
    },
  };
}

const outcome = (bits) => `m0 = ${bits[0]}, m1 = ${bits[1]}`;
const fix = (bits) => {
  const parts = [];
  if (bits[1]) parts.push('X');
  if (bits[0]) parts.push('Z');
  return parts.length ? parts.join(' then ') : 'nothing';
};

runCircuitLesson({
  slug: 'teleportation',
  n: 3,
  labels: ['Alice: message', 'Alice: pair', 'Bob: pair'],
  bloch: true,
  params: [
    {
      id: 'theta',
      label: 'Message tilt θ',
      type: 'range',
      min: 0,
      max: Math.PI,
      step: Math.PI / 24,
      value: (2 * Math.PI) / 3,
      format: (v) => `${Math.round((v * 180) / Math.PI)}°`,
    },
    {
      id: 'phi',
      label: 'Message phase φ',
      type: 'range',
      min: 0,
      max: 2 * Math.PI,
      step: Math.PI / 12,
      value: Math.PI / 4,
      format: angleLabel,
      hint: 'Choose any message: it arrives intact every time.',
    },
  ],
  views: [{ title: 'Did it arrive?', legend: 'compare the arrows', mount: comparison }],
  build: ({ theta, phi }) => {
    const ops = teleportOps(theta, phi);
    return [
      {
        title: 'The message',
        ops,
        until: TELEPORT.prepared,
        html: `<p>Alice holds a qubit in some state |ψ⟩ (top wire), and wants Bob to have it. The first two gates just prepare the example message. Change it in <b>Try it</b>.</p>
          <p>She can't just measure it and phone the result: measuring destroys the superposition. And no device can copy an unknown qubit (the <b>no-cloning</b> theorem).</p>`,
      },
      {
        title: 'Share a Bell pair',
        ops,
        until: TELEPORT.paired,
        html: `<p>Earlier, Alice and Bob made a Bell pair: H then CNOT on the bottom two wires. Alice kept one half and Bob took the other, anywhere in the world.</p>
          <p>Bob's qubit on its own has no direction at all (its Bloch arrow has shrunk to a dot). All its information is in the correlation with Alice's half.</p>`,
      },
      {
        title: 'Alice links the message to her half',
        ops,
        until: TELEPORT.entangled,
        html: `<p>Alice applies a CNOT from her message qubit to her half of the pair. Now all three qubits share one entangled state.</p>`,
      },
      {
        title: '... and applies H',
        ops,
        until: TELEPORT.hadamard,
        html: `<p>A Hadamard on the message qubit. The algebra now says: for each of Alice's four possible measurement results, Bob's qubit is the message with a known twist, either untouched, flipped (X), phase-flipped (Z) or both.</p>
          <p>Nothing has travelled to Bob yet. His qubit alone still has no direction.</p>`,
      },
      {
        title: 'Alice measures',
        ops,
        until: TELEPORT.measured,
        html: ({ bits }) => `<p>Alice measures her two qubits and gets <b>${outcome(bits)}</b>. Each of the four results is equally likely, so they tell her nothing about the message.</p>
          <p>Her message qubit has collapsed: the original is gone from her side. Press <b>Measure again</b> in Try it for a different outcome.</p>`,
      },
      {
        title: 'Two ordinary bits travel to Bob',
        ops,
        until: TELEPORT.measured,
        html: ({ bits }) => `<p>Alice sends Bob her two bits (${outcome(bits)}) by any normal channel: a phone call, a message. That is limited by the speed of light.</p>
          <p>Until the bits arrive, Bob can't do anything useful: averaged over the four possibilities his qubit is completely random. That's why teleportation can't send information faster than light.</p>`,
      },
      {
        title: 'Bob fixes his qubit',
        ops,
        until: TELEPORT.corrected,
        html: ({ bits }) => `<p>The bits tell Bob which twist to undo: here he applies <b>${fix(bits)}</b>. His qubit is now exactly Alice's original message. Compare the arrows in <b>Did it arrive?</b></p>
          <p>The state was moved, not copied: Alice's original was destroyed when she measured. No-cloning is safe.</p>`,
      },
      {
        title: 'It always works',
        ops,
        until: TELEPORT.corrected,
        html: `<p>Try any message with θ and φ, and press <b>Measure again</b> to get other outcomes. The fidelity is always 100%.</p>
          <p>The cost: one Bell pair and two classical bits per qubit sent. Real experiments have teleported qubits between islands and from the ground to a satellite.</p>`,
      },
    ];
  },
});
