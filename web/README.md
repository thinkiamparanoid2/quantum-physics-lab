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

## Files

- `js/parse.js`: parses Pauli sums like `0.5*Z0 Z1 + X2` or `ZZI - 0.3*XIX`, and initial states
- `js/sim.js`: statevector engine; exact evolution by Taylor series, first- and second-order Trotter
- `js/presets.js`: built-in examples, including the lattice Schwinger model
- `js/charts.js`: canvas charts that follow the page's light/dark theme
- `js/app.js`: inputs, playback, shareable links

## Conventions and limits

- Qubit 0 is written first in Pauli strings and kets (`ZXI` is Z on qubit 0, |01⟩ has qubit 1 set). Qiskit uses the opposite order.
- Up to 10 qubits, which is small enough that a laptop computes everything exactly. This is a learning tool, not a demonstration of quantum advantage.
- The Trotter circuit shown is noiseless. The CNOT count is a rough compile estimate, a CNOT ladder per Pauli rotation.
