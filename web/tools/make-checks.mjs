// Writes web/checks/index.html: every automated check, grouped by the file it lives in, so anyone
// can see what "checked" means on this site. Test names are read straight from the test files, and
// web/tests/pages.test.js fails if the page is out of date. Run: node web/tools/make-checks.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO = 'https://github.com/thinkiamparanoid2/quantum-physics-lab/blob/main';
const web = new URL('../', import.meta.url);
const root = new URL('../../', import.meta.url);

// What each test file covers, in the order shown.
const GROUPS = [
  ['circuit.test.js', 'Statevector engine', 'Gates, measurement and collapse, classical control, textbook formatting.'],
  ['bloch.test.js', 'Bloch-sphere geometry', 'Every single-qubit gate as a rotation of the Bloch arrow.'],
  ['dynamics.test.js', 'Hamiltonian dynamics', 'Exact evolution and Trotter circuits against numpy, scipy and the Qiskit Schwinger Hamiltonian.'],
  ['algorithms.test.js', 'Algorithms', 'Deutsch–Jozsa, Bernstein–Vazirani, the QFT, phase estimation and Shor.'],
  ['grover.test.js', 'Grover’s search', 'The circuit against the closed-form rotation picture.'],
  ['protocols.test.js', 'Protocols', 'Teleportation, superdense coding and BB84.'],
  ['sandbox.test.js', 'Circuit sandbox', 'Link format and every lesson circuit surviving the trip into the sandbox.'],
  ['wave.test.js', 'Wave mechanics', 'Eigenstates, split-operator evolution, shooting and transmission against exact results.'],
  ['expr.test.js', 'Formula parser', 'The safe V(x) parser, including rejected input.'],
  ['atoms.test.js', 'Spin and atoms', 'Stern–Gerlach, magnetic resonance and hydrogen.'],
  ['experiments.test.js', 'The founding experiments', 'Photoelectric effect, double slit, Mach–Zehnder, bomb tester and Compton scattering.'],
  ['noise.test.js', 'Nonlocality, noise and error correction', 'CHSH, density matrices, decoherence and the repetition and Shor codes.'],
  ['approx.test.js', 'Many particles and approximations', 'Bands, identical particles, perturbation theory, the variational method and WKB.'],
  ['linalg.test.js', 'Linear algebra', 'The Hermitian eigensolver and the SVD behind the new lessons.'],
  ['entanglement.test.js', 'Entanglement measures', 'Entropy, concurrence and negativity against exact values and numpy.'],
  ['channels.test.js', 'Quantum channels', 'Kraus operators, Bloch-ball maps and Stinespring circuits checked against each other.'],
  ['discrimination.test.js', 'State discrimination', 'Helstrom, unambiguous discrimination and the Neumark dilation.'],
  ['cloning.test.js', 'No-cloning and monogamy', 'The copiers’ fidelities and the CKW inequality.'],
  ['walk.test.js', 'Quantum walks', 'Ballistic spreading and the classical limit under noise.'],
  ['current.test.js', 'Probability current', 'Plane waves, packets and the continuity equation.'],
  ['delta.test.js', 'Delta potentials', 'Bound states and transmission against the grid solvers.'],
  ['ring.test.js', 'Particle on a ring', 'Revivals and flux-shifted levels.'],
  ['angular.test.js', 'Angular momentum', 'Commutators, Wigner rotations and Clebsch–Gordan coefficients, two ways.'],
  ['decay.test.js', 'Fermi’s golden rule', 'First-order theory, exponential decay, recurrences and the Lorentzian line shape.'],
  ['adiabatic.test.js', 'Adiabatic evolution', 'Landau–Zener transitions and Berry’s phase.'],
  ['statistics.test.js', 'Quantum statistics', 'Chemical potentials, the Sommerfeld expansion and Bose–Einstein condensation.'],
  ['stabilizer.test.js', 'Stabilizer simulator', 'The tableau simulator against the statevector engine on random Clifford circuits.'],
  ['qec.test.js', 'Surface code and decoders', 'Matching weights and logical error rates against PyMatching, with perfect and with noisy measurements; threshold behaviour.'],
  ['steane.test.js', 'Steane’s code', 'Every single-qubit error on every position corrected by the full circuit.'],
  ['fields.test.js', 'Fields on a lattice', 'Chain modes against diagonalisation; two coupled quantum oscillators in a Fock basis against the phonon formula.'],
  ['fock.test.js', 'Fock space and Jordan–Wigner', 'Commutation and anticommutation on every basis state; Jordan–Wigner matrix elements; qubit chain spectrum and dynamics against free fermions.'],
  ['schwinger.test.js', 'Schwinger model', 'Library against the playground preset; flux-free bare vacuum; Lanczos against dense diagonalisation; string-breaking energies against an independent numpy build.'],
  ['ising.test.js', 'Transverse-field Ising', 'Free-fermion energies and gap against dense diagonalisation and Lanczos; the Kibble–Zurek ramp against the statevector and the τ^(−1/2) law; entanglement scaling.'],
  ['mps.test.js', 'Matrix product states', 'Complex SVD; MPS round trip and truncation bound; TEBD second-order convergence to exact evolution; area law and Page’s value.'],
  ['fields-hardware.test.js', 'Fields on hardware', 'Schwinger CNOT count against a hand count; Trotter infidelity slopes of orders 1 and 2.'],
  ['qml.test.js', 'Quantum machine learning', 'Classifier values and parameter-shift gradients, Fourier coefficients, ZZ kernel, H₂ VQE and QAOA against PennyLane; amplitude encoding.'],
  ['estimation.test.js', 'Amplitude estimation', 'Outcome distribution against the Brassard–Høyer–Mosca–Tapp formula; their error bound; 1/calls against 1/√calls.'],
  ['simon.test.js', 'Simon’s algorithm', 'Two-to-one oracle; outcome distribution uniform on y·s = 0 for every s; GF(2) recovery of s.'],
  ['hamsim.test.js', 'Trotter and qDRIFT', 'Exact qDRIFT channel against 4000 sampled sequences and Campbell’s bound; convergence orders 1/N², 1/N⁴ and 1/N.'],
  ['aqc.test.js', 'Adiabatic quantum computing', 'Spectrum end points; sudden limit 1/2ⁿ; success on a large-gap instance and a small-gap one against 1/Δ².'],
  ['toric.test.js', 'Toric code and anyons', 'Checks, ground state and the −1 braiding phase, on the tableau and on an 18-qubit statevector.'],
  ['magic.test.js', 'Magic states', 'Distillation’s weight enumerator against MacWilliams, transversal T on the Reed–Muller code, 35p³ against Monte Carlo, and T injection.'],
  ['pages.test.js', 'Site structure', 'Lesson pages, teaching notes and this page itself.'],
];

function testNames(src, python = false) {
  if (python) return [...src.matchAll(/^def (test_\w+)/gm)].map((m) => m[1].replace(/^test_/, '').replace(/_/g, ' '));
  // A test declared in a loop has a template name; show it once, as a family of cases.
  return [...src.matchAll(/^\s*test\(\s*(['"`])((?:\\.|(?!\1).)*)\1/gm)].map((m) =>
    m[2].replace(/\\(.)/g, '$1').replace(/\$\{[^}]*\}/g, '(each reference case)'),
  );
}

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function checksHtml() {
  const testsDir = new URL('tests/', web);
  const files = readdirSync(testsDir).filter((f) => f.endsWith('.test.js'));
  const known = new Set(GROUPS.map(([f]) => f));
  const extra = files.filter((f) => !known.has(f)).sort();
  const groups = [...GROUPS.filter(([f]) => files.includes(f)), ...extra.map((f) => [f, f.replace('.test.js', ''), ''])];
  let total = 0;
  const sections = groups.map(([file, title, blurb]) => {
    const names = testNames(readFileSync(new URL(file, testsDir), 'utf8'));
    total += names.length;
    return { title, blurb, link: `${REPO}/web/tests/${file}`, file: `web/tests/${file}`, names };
  });
  const pyDir = new URL('tests/', root);
  for (const file of readdirSync(pyDir).filter((f) => f.endsWith('.py') && f.startsWith('test_')).sort()) {
    const names = testNames(readFileSync(new URL(file, pyDir), 'utf8'), true);
    total += names.length;
    sections.push({ title: `Python lab: ${file.replace(/^test_|\.py$/g, '').replace(/_/g, ' ')}`, blurb: 'Qiskit and PennyLane, against exact diagonalization.', link: `${REPO}/tests/${file}`, file: `tests/${file}`, names });
  }
  const body = sections
    .map(
      (s) => `      <section class="panel check-group">
        <h2>${escape(s.title)} <span class="muted">${s.names.length}</span></h2>
        ${s.blurb ? `<p class="muted">${escape(s.blurb)}</p>` : ''}
        <ul>
${s.names.map((n) => `          <li>${escape(n)}</li>`).join('\n')}
        </ul>
        <p class="check-source"><a href="${s.link}">${s.file}</a></p>
      </section>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en" data-root="../" data-page="checks">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>How it is checked: Quantum Physics Lab</title>
  <meta name="description" content="Every automated check behind Quantum Physics Lab's simulations: ${total} checks against exact formulas, second methods, numpy, Qiskit and PennyLane.">
  <script>document.documentElement.classList.add('is-loading');try{document.documentElement.dataset.theme=localStorage.getItem('theme')||'dark'}catch(e){document.documentElement.dataset.theme='dark'}</script>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%238b7bff'/%3E%3Ctext x='16' y='21' font-family='monospace' font-size='13' font-weight='700' text-anchor='middle' fill='%23080915'%3E%7C%CF%88%E2%9F%A9%3C/text%3E%3C/svg%3E">
  <link rel="stylesheet" href="../styles/site.css">
</head>
<body>
  <main>
    <div class="container lesson-head">
      <div>
        <p class="eyebrow">Is it right?</p>
        <h1>How it is checked</h1>
        <p class="lede">Every simulation is exact or checked against an independent method: a textbook formula, a second
          numerical method, or numpy, Qiskit and PennyLane in the Python lab. These ${total} automated checks (some run once per reference case) run on every change.</p>
      </div>
    </div>
    <div class="container checks-grid">
${body}
    </div>
  </main>
  <script type="module">import { mountShell } from '../ui/shell.js'; mountShell();</script>
</body>
</html>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL('checks/index.html', web), checksHtml());
  console.log('wrote checks/index.html');
}
