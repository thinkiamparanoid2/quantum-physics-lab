# Quantum Physics Lab

A growing collection of physics simulations whose core dynamics are computed by quantum circuits. Each module tackles a system that's genuinely hard classically (or is a well-known benchmark for near-term quantum hardware), and each one is validated three ways: against the exact classical answer, on an ideal quantum simulator, and on real quantum hardware with error mitigation.

## Why this exists

Anyone can run a Bell state. The goal here is to build simulations with a real physics story — "I simulated matter being created from the vacuum," "I watched a spin excitation spread in a light cone," "I calculated what holds an atomic nucleus together on a real quantum computer" — and to be honest about what's actually happening: at the qubit counts used here, a laptop can do these faster and more exactly than a quantum computer. What's being demonstrated is the *method* that becomes powerful at scale, plus an honest look at what happens on today's noisy hardware.

## Hamiltonian Playground (in the browser)

[`web/`](web/README.md) is an interactive, zero-install front end: type any Hamiltonian as a
sum of Pauli strings, pick a starting state, and watch it evolve in real time, exact dynamics
next to the Trotterized circuit a quantum computer would run, with the error between them and
the circuit's CNOT cost. Presets include the Schwinger model from `modules/`, a spin-wave
light cone, an Ising quench and a Rabi oscillation. It runs entirely in the visitor's
browser, so it can be hosted for free as a static site (see `web/README.md` for Vercel).

## Structure

```
quantum-physics-lab/
├── engine/          # shared code: Trotter evolution, measurement, noise models
├── modules/         # one folder per simulation, each self-contained
├── hardware_runs/   # results from real IBM devices + error mitigation
├── web/             # Hamiltonian Playground: browser front end, static site
└── tests/           # correctness tests (simulator vs. exact classical answer)
```

## Modules

| Module | Status | Physics | Qubits |
|---|---|---|---|
| [Schwinger model](modules/schwinger_model/README.md) | simulator done, hardware run pending | pair production from the vacuum (lattice QED) | 4 |

Each module directory contains:
- A `README.md` explaining the physics in plain language, the Hamiltonian, and how it maps onto qubits
- Code that builds the circuit and runs it
- A comparison plot: simulator result vs. exact classical diagonalization
- A `hardware/` note with the real-device run and any error mitigation applied
- A "limitations" section — what breaks at what circuit depth, and why

## Setup

```bash
pip install -r requirements.txt
```

Uses [Qiskit](https://qiskit.org/) for circuit construction and IBM Quantum's free hardware tier for real-device runs. GPU-accelerated statevector simulation via `qiskit-aer-gpu` is used for anything beyond ~20 qubits, where the CPU simulator gets slow.

## Status

Just getting started — see `modules/` for what's built so far.
