# Hamiltonian Playground

Type a Hamiltonian, pick a starting state, and watch it evolve in real time: exact quantum
dynamics side by side with the Trotterized circuit a quantum computer would run, plus the
error between them and the circuit's CNOT cost.

Everything runs in the visitor's browser (plain HTML/CSS/JavaScript, no build step, no
server), so it can be hosted anywhere static files can.

## Run locally

Browsers won't load JavaScript modules from `file://`, so serve the folder:

```bash
python -m http.server 8765 --directory web
```

Then open http://localhost:8765.

## Tests

The engine is checked against independent Python references: dense numpy/scipy matrices
for generic Hamiltonians, and the repo's validated Qiskit Hamiltonian for the Schwinger model.

```bash
python web/tests/make_reference.py   # regenerate tests/reference.json (needs the repo's .venv)
cd web && npm test                   # Node 20+; no dependencies
```

## Deploy on Vercel (free Hobby plan)

1. Push this repository to GitHub.
2. On vercel.com: **Add New → Project**, import the repository.
3. Set **Root Directory** to `web`, leave **Framework Preset** as "Other" and the build command empty.
4. Deploy. Every later push to the main branch redeploys automatically.

Or from this folder with the CLI: `npx vercel` (first time) and `npx vercel --prod`.

## Layout

```
web/
├── index.html, home.js   landing page (hero Bloch sphere, primer, learning path, teachers)
├── styles/site.css       design system: dark "quantum" theme + light theme, all components
├── lib/                  pure logic, no DOM, tested in Node
│   ├── catalog.js          every topic: title, section, status (live/soon), icon
│   ├── circuit.js          statevector engine: gates, rotations, measurement, classical control
│   ├── bloch.js            Bloch vectors, gate -> rotation axis/angle, partial rotations
│   ├── format.js           textbook formatting: (|00⟩ + |11⟩)/√2, 1/√2, π/4
│   ├── grover.js           Grover's search from real gates + closed-form results
│   ├── protocols.js        teleportation, superdense coding, BB84 (every photon a real qubit)
│   ├── algorithms.js       Deutsch-Jozsa, Bernstein-Vazirani, QFT, phase estimation, Shor
│   ├── sandbox.js          sandbox grid model, URL format (n=2&c=H0/C0_X1), lesson import
│   ├── pauli.js            parses Pauli sums like 0.5*Z0 Z1 + X2
│   ├── dynamics.js         Hamiltonian dynamics: exact evolution and Trotter circuits
│   ├── wave.js             1D wave mechanics (ħ = m = 1): eigenstates, split-operator evolution,
│   │                       shooting (Numerov), transmission through any potential
│   ├── fft.js              radix-2 FFT
│   ├── spin.js             spin-1/2: measurement on any axis, Stern-Gerlach chains, exact
│   │                       magnetic resonance (rotating frame), spin-echo ensembles
│   ├── hydrogen.js         hydrogen orbitals (R_nl, real Y_lm), energies, Rydberg lines,
│   │                       wavelength colours, electron-cloud sampling
│   └── expr.js             safe formula parser for V(x), no eval
├── ui/                   browser components
│   ├── shell.js            nav with topics menu, Dark/Light switch, footer, Present mode
│   ├── lesson.js           lesson frame: steps, progress, keyboard/clicker navigation
│   ├── circuit-lesson.js   engine for circuit lessons (circuit, dials, Bloch, sampler, views)
│   ├── circuit-view.js     gate-level circuit diagram (SVG)
│   ├── dials.js            amplitude dials: size = probability, colour/hand = phase
│   ├── bloch.js            draggable 3D Bloch sphere
│   ├── sampler.js          repeated measurement vs predicted probabilities
│   ├── wave-plot.js        phase-coloured |ψ|², level diagrams, momentum, quantum carpets
│   ├── player.js           play/pause/scrub bar for the wave lessons
│   └── charts.js, amplitude-bars.js, circuit-strip.js
├── <topic>/              one folder per lesson: app.js (+ index.html)
├── sandbox/              circuit sandbox: drag gates, live state, presets, shareable links
├── schrodinger/          Schrödinger playground: type or draw V(x), levels, packets
├── tools/make-pages.mjs  writes each lesson's index.html from the catalog
└── tests/                Node tests + Python reference generator
```

### Adding a lesson

1. Add or update its entry in `lib/catalog.js` (set `status: 'live'` when it's ready).
2. Write `web/<slug>/app.js`. Circuit-based lessons call `runCircuitLesson({...})` from
   `ui/circuit-lesson.js` with their steps; custom lessons use `mountLesson` directly.
3. Run `node web/tools/make-pages.mjs` to generate `web/<slug>/index.html`.
4. Add tests for any new physics in `web/tests/`.

## Conventions and limits

- Qubit 0 is written first in Pauli strings and kets (`ZXI` is Z on qubit 0, |01⟩ has qubit 1 set). Qiskit uses the opposite order.
- Up to 10 qubits, which is small enough that a laptop computes everything exactly. This is a learning tool, not a demonstration of quantum advantage.
- The Trotter circuit shown is noiseless. The CNOT count is a rough compile estimate, a CNOT ladder per Pauli rotation.
