"""Checks for hardware_runs/: zero-noise folding leaves the ideal circuit unchanged and scales its
two-qubit gate count, and the stored analyses are reproducible from the raw IBM counts."""

import json
import sys
from pathlib import Path

import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Operator

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "hardware_runs"))

import analyze  # noqa: E402
from run import fold  # noqa: E402

RESULTS = ROOT / "hardware_runs" / "results"


def _native_circuit():
    qc = QuantumCircuit(3)
    for q in range(3):
        qc.rz(0.3 + q, q)
        qc.sx(q)
    qc.cz(0, 1)
    qc.rz(0.7, 1)
    qc.cz(1, 2)
    qc.sx(2)
    qc.cz(0, 1)
    qc.cz(1, 2)
    return qc


def test_folding_keeps_the_ideal_circuit_and_scales_the_two_qubit_gates():
    qc = _native_circuit()
    base = Operator(qc)
    for scale, expected in [(1, 4), (2, 8), (3, 12), (1.5, 6)]:
        folded = fold(qc, scale)
        assert Operator(folded).equiv(base)
        assert sum(1 for i in folded.data if i.operation.num_qubits == 2) == expected


def test_stored_analyses_are_reproducible_from_the_raw_counts():
    raw = json.loads((RESULTS / "chsh-ibm_kingston.json").read_text())
    stored = json.loads((RESULTS / "chsh-ibm_kingston-analysis.json").read_text())
    assert abs(analyze.chsh(raw)["S"] - stored["S"]) < 1e-12
    raw = json.loads((RESULTS / "schwinger-run2-ibm_kingston.json").read_text())
    stored = json.loads((RESULTS / "schwinger-run2-ibm_kingston-analysis.json").read_text())
    point = analyze.schwinger_point(raw)
    for a, b in zip(point["rows"], stored["rows"]):
        assert np.isclose(a["zne_linear"], b["zne_linear"]) and np.isclose(a["readout_mitigated"], b["readout_mitigated"])
