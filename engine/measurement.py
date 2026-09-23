"""Expectation values from either shot counts (real hardware / shot-based simulators)
or a statevector (exact statevector simulators)."""

from __future__ import annotations

from qiskit.quantum_info import SparsePauliOp, Statevector


def expectation_from_statevector(hamiltonian: SparsePauliOp, state: Statevector) -> float:
    """<psi| H |psi> computed exactly from a statevector."""
    return float(state.expectation_value(hamiltonian).real)


def expectation_from_counts(counts: dict[str, int], pauli_z_string: str) -> float:
    """Expectation value of a Z-basis observable (e.g. "ZIZI") from measurement counts.

    Counts keys are bitstrings as returned by Qiskit (little-endian: qubit 0 is the
    rightmost character). Only 'Z' and 'I' are supported directly — rotate other Pauli
    terms into the Z basis with a basis-change circuit before measuring.
    """
    if len(pauli_z_string) == 0 or any(c not in "ZI" for c in pauli_z_string):
        raise ValueError("pauli_z_string must contain only 'Z' and 'I'")

    total_shots = sum(counts.values())
    if total_shots == 0:
        raise ValueError("counts is empty")

    active_qubits = [i for i, c in enumerate(reversed(pauli_z_string)) if c == "Z"]

    expectation = 0.0
    for bitstring, count in counts.items():
        parity = 1
        for qubit in active_qubits:
            if bitstring[-(qubit + 1)] == "1":
                parity *= -1
        expectation += parity * count

    return expectation / total_shots
