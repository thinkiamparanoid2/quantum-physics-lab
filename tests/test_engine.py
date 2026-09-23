"""Sanity check: Trotterized circuit evolution should match exact evolution closely for a
small Hamiltonian, given enough Trotter steps. This is the correctness check every module
depends on.
"""

import numpy as np
from qiskit.quantum_info import SparsePauliOp, Statevector

from engine import exact_evolve, trotter_circuit


def test_trotter_matches_exact_for_two_qubit_ising():
    hamiltonian = SparsePauliOp.from_list([("ZZ", 1.0), ("XI", 0.5), ("IX", 0.5)])
    time = 1.0
    initial_state = Statevector.from_label("00")

    exact_final = exact_evolve(hamiltonian, time, initial_state)

    circuit = trotter_circuit(hamiltonian, time, steps=50, order=2)
    trotter_final = initial_state.evolve(circuit)

    fidelity = np.abs(exact_final.inner(trotter_final)) ** 2
    assert fidelity > 0.999, f"Trotterized evolution diverged from exact result: fidelity={fidelity}"


def test_trotter_accuracy_improves_with_more_steps():
    hamiltonian = SparsePauliOp.from_list([("ZZ", 1.0), ("XI", 0.5), ("IX", 0.5)])
    time = 2.0
    initial_state = Statevector.from_label("00")
    exact_final = exact_evolve(hamiltonian, time, initial_state)

    def infidelity(steps: int) -> float:
        circuit = trotter_circuit(hamiltonian, time, steps=steps, order=1)
        final = initial_state.evolve(circuit)
        return 1 - np.abs(exact_final.inner(final)) ** 2

    assert infidelity(20) < infidelity(2)
