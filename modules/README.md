# modules

One folder per simulation. Each is self-contained and should be finished (code, plots,
hardware run, write-up) before the next one starts.

## Convention for a new module

```
modules/<name>/
├── README.md        # physics in plain language, Hamiltonian, qubit encoding, limitations
├── hamiltonian.py    # builds the Hamiltonian as a SparsePauliOp
├── run.py            # builds circuits (via engine.evolution), runs sim + hardware, plots
├── hardware/          # real-device results + error mitigation notes
└── plots/             # generated figures
```

Each module's `README.md` should cover:
1. The physics, in plain language
2. The Hamiltonian and how it maps onto qubits
3. Simulator result vs. exact classical answer (proves correctness)
4. A real-hardware run, however small, plus error mitigation
5. Limitations — where it breaks and why
