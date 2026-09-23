# engine

Shared code used by every module. The idea: almost every simulation in this repo reduces to
"encode a state → apply e^{-iHt} → measure," so that pipeline is written once here instead of
once per module.

- `evolution.py` — Trotterized time evolution circuits from a Hamiltonian (`SparsePauliOp`)
- `exact.py` — exact diagonalization and direct matrix-exponential evolution, the classical
  ground truth every module validates against
- `measurement.py` — expectation values from shot counts or statevectors
- `noise.py` — a depolarizing noise model for realistic simulation, plus zero-noise
  extrapolation (ZNE) for mitigating real-hardware error

A module builds its own Hamiltonian and state encoding, then calls into this package for the
evolution/measurement/validation plumbing.
