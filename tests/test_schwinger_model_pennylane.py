"""Cross-validation: the PennyLane Hamiltonian and the Qiskit Hamiltonian are built from
independent framework-specific assembly code (only the pure-Python combinatorics are
shared). If they don't agree, one of the two has a real bug.
"""

import sys
from pathlib import Path

import numpy as np
import pennylane as qml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from modules.schwinger_model.hamiltonian import schwinger_hamiltonian
from modules.schwinger_model.hamiltonian_pennylane import schwinger_hamiltonian_pennylane


def test_pennylane_matches_qiskit_up_to_identity_shift():
    for num_sites in (2, 3, 4, 5):
        x, mass, coupling = 1.1, 0.4, 0.7

        qiskit_matrix = schwinger_hamiltonian(num_sites, x=x, mass=mass, coupling=coupling).to_matrix()

        # PennyLane's qml.matrix treats wire_order[0] as the most-significant qubit, the
        # opposite of Qiskit's SparsePauliOp.to_matrix() (where the highest-indexed qubit
        # is most significant) -- reverse the wire order so the two matrices line up.
        pennylane_h = schwinger_hamiltonian_pennylane(num_sites, x=x, mass=mass, coupling=coupling)
        pennylane_matrix = qml.matrix(pennylane_h, wire_order=list(reversed(range(num_sites))))

        # PennyLane's version drops the pure-identity term (global phase only), so the two
        # matrices should agree up to an overall constant shift on the diagonal.
        difference = qiskit_matrix - pennylane_matrix
        diagonal_shift = np.diag(difference)
        assert np.allclose(diagonal_shift, diagonal_shift[0]), (
            f"num_sites={num_sites}: difference isn't a pure constant shift, "
            "the two Hamiltonians disagree on more than the dropped identity term"
        )
        off_diagonal = difference - np.diag(diagonal_shift)
        assert np.allclose(off_diagonal, 0), f"num_sites={num_sites}: off-diagonal mismatch"
