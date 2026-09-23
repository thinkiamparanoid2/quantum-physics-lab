"""Trotterized time evolution: build a circuit that approximates e^{-iHt} for a Hamiltonian given as a sum of Pauli terms.

Every module (spin chains, Schwinger model, neutrino oscillations, ...) reduces to the same
pattern: encode a state, apply e^{-iHt} in small steps, measure. This module is the "apply
e^{-iHt}" part, shared across all of them.
"""

from __future__ import annotations

from qiskit.circuit import QuantumCircuit
from qiskit.circuit.library import PauliEvolutionGate
from qiskit.quantum_info import SparsePauliOp
from qiskit.synthesis import LieTrotter, SuzukiTrotter


def trotter_circuit(
    hamiltonian: SparsePauliOp,
    time: float,
    steps: int,
    order: int = 1,
) -> QuantumCircuit:
    """Build a circuit approximating e^{-i * hamiltonian * time} via Trotterization.

    Args:
        hamiltonian: the Hamiltonian as a sum of Pauli terms.
        time: total evolution time.
        steps: number of Trotter steps. More steps -> more accurate, deeper circuit.
        order: 1 for Lie-Trotter, 2 for a second-order Suzuki formula (more accurate
            per step, roughly double the gates per step).

    Returns:
        A QuantumCircuit implementing the approximate evolution, to be appended to a
        state-preparation circuit.
    """
    if steps < 1:
        raise ValueError("steps must be >= 1")

    synthesis = LieTrotter(reps=steps) if order == 1 else SuzukiTrotter(order=order, reps=steps)
    evolution_gate = PauliEvolutionGate(hamiltonian, time=time, synthesis=synthesis)

    circuit = QuantumCircuit(hamiltonian.num_qubits)
    circuit.append(evolution_gate, range(hamiltonian.num_qubits))
    return circuit


def trotter_steps_circuit(
    hamiltonian: SparsePauliOp,
    total_time: float,
    steps: int,
    order: int = 1,
) -> list[QuantumCircuit]:
    """Same as trotter_circuit, but returns the circuit after each intermediate step.

    Useful for plotting an observable as a function of time without re-simulating from
    scratch for every time point.
    """
    dt = total_time / steps
    single_step = trotter_circuit(hamiltonian, dt, steps=1, order=order)

    circuits = []
    running = QuantumCircuit(hamiltonian.num_qubits)
    for _ in range(steps):
        running = running.compose(single_step)
        circuits.append(running.copy())
    return circuits
