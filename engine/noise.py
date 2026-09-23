"""Noise models for realistic simulation, and zero-noise extrapolation (ZNE) for error
mitigation on real hardware results.

Every module should show three numbers: ideal simulator, noisy simulator, real hardware.
This is what makes the "honest about scale" story credible instead of just a claim.
"""

from __future__ import annotations

from qiskit.circuit import QuantumCircuit
from qiskit_aer.noise import NoiseModel, depolarizing_error


def depolarizing_noise_model(
    single_qubit_error: float = 0.001,
    two_qubit_error: float = 0.01,
) -> NoiseModel:
    """A simple, uniform depolarizing noise model as a stand-in for a real device's error rates.

    Defaults are roughly in line with current superconducting hardware (single-qubit gates
    are about 10x cleaner than two-qubit gates). Replace with a real backend's noise model
    (`NoiseModel.from_backend(backend)`) once you have IBM Quantum access, for a much more
    realistic comparison.
    """
    model = NoiseModel()

    single_qubit_gates = ["id", "sx", "x", "rz"]
    two_qubit_gates = ["cx", "ecr", "cz"]

    error_1q = depolarizing_error(single_qubit_error, 1)
    error_2q = depolarizing_error(two_qubit_error, 2)

    model.add_all_qubit_quantum_error(error_1q, single_qubit_gates)
    model.add_all_qubit_quantum_error(error_2q, two_qubit_gates)

    return model


def zne_fold(circuit: QuantumCircuit, scale_factor: int) -> QuantumCircuit:
    """Unitary folding for zero-noise extrapolation: replace each two-qubit gate G with
    G (G^dagger G)^n so the circuit's noise scales up by (2n+1) while the ideal unitary
    is unchanged.

    scale_factor must be an odd integer (1, 3, 5, ...). Run the same circuit at several
    scale factors, measure the observable at each, and extrapolate back to scale_factor=0
    (linear or polynomial fit) to estimate the zero-noise result.
    """
    if scale_factor < 1 or scale_factor % 2 == 0:
        raise ValueError("scale_factor must be an odd integer >= 1")

    if scale_factor == 1:
        return circuit.copy()

    n_extra_pairs = (scale_factor - 1) // 2
    folded = QuantumCircuit(*circuit.qregs, *circuit.cregs)

    for instruction in circuit.data:
        folded.append(instruction.operation, instruction.qubits, instruction.clbits)
        if instruction.operation.num_qubits == 2:
            for _ in range(n_extra_pairs):
                folded.append(instruction.operation.inverse(), instruction.qubits, instruction.clbits)
                folded.append(instruction.operation, instruction.qubits, instruction.clbits)

    return folded
