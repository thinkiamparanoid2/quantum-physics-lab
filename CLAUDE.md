# Quantum Physics Lab

Two halves in one repo:

- **Python lab** (`engine/`, `modules/`, `tests/`): Qiskit/PennyLane simulations, validated against
  exact diagonalization, with real-hardware runs planned under `hardware_runs/`.
- **Teaching website** (`web/`): static HTML/CSS/JS (no build step, no framework) deployed on Vercel
  with Root Directory = `web`. Everything runs client-side.

## Commands

- Python env: `.venv/Scripts/python.exe` (Python 3.12). Tests: `.venv/Scripts/python.exe -m pytest tests/ -q`
- Web tests: `cd web && npm test` (Node 20+, no dependencies)
- Web reference data: `.venv/Scripts/python.exe web/tests/make_reference.py` regenerates
  `web/tests/reference.json` from numpy/Qiskit; rerun it when adding reference cases
- Local preview: serve `web/` over HTTP (`python -m http.server 8765 --directory web`); ES modules don't load from `file://`

## Conventions that have bitten us

- **Qubit ordering differs by layer.** Qiskit Pauli labels and bitstrings are little-endian
  (rightmost character = qubit 0). The website writes qubit 0 *first* in Pauli strings and kets.
  In the JS engine, qubit q is bit q of the basis index. PennyLane's `qml.matrix(wire_order=...)`
  treats the first wire as most significant.
- **`PauliEvolutionGate.to_matrix()` is exact.** Always `.decompose()` a Trotter circuit before
  simulating it, or the "Trotterized" result silently equals exact evolution (see `engine/evolution.py`).
- Every physics result needs an independent check (hand derivation, a second framework, or
  exact diagonalization). Don't claim quantum advantage anywhere: at these sizes a laptop is faster.

## Git workflow

- `main` is what's deployed. Never commit directly to it except trivial fixes.
- One branch per unit of work, merged via pull request:
  `topic/<name>` for a new teaching topic, `feature/<name>` for shared site features,
  `lab/<name>` for Python modules, `fix/<name>` for bug fixes, `docs/<name>` for documentation.
- Keep tests passing (Python + web) before opening a PR.
