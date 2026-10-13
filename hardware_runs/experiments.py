"""Circuits for the real-hardware runs: a CHSH Bell test, pair production in the 4-site lattice
Schwinger model with zero-noise extrapolation, and single-qubit randomized benchmarking.

Every builder returns logical circuits plus the metadata needed to analyse the counts. Circuits
are transpiled to the device in `run.py`; zero-noise folding is applied *after* transpilation
(each native CZ → CZ·CZ·CZ), so the compiler cannot cancel the folded gates.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Clifford, random_clifford

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from engine import trotter_circuit  # noqa: E402
from modules.schwinger_model.hamiltonian import schwinger_hamiltonian  # noqa: E402

# ----- CHSH -----
# Bell pair (|00⟩ + |11⟩)/√2; Alice measures along angle a, Bob along b in the x–z plane, by
# rotating with RY(−angle) before a Z measurement. Ideal correlation E(a, b) = cos(a − b).
CHSH_SETTINGS = {"a0": 0.0, "a1": np.pi / 2, "b0": np.pi / 4, "b1": -np.pi / 4}


def bell_measured(a: float, b: float) -> QuantumCircuit:
    qc = QuantumCircuit(2, 2)
    qc.h(0)
    qc.cx(0, 1)
    qc.ry(-a, 0)
    qc.ry(-b, 1)
    qc.measure([0, 1], [0, 1])
    return qc


def chsh_circuits(sweep_points: int = 16):
    s = CHSH_SETTINGS
    pairs = [("a0", "b0"), ("a0", "b1"), ("a1", "b0"), ("a1", "b1")]
    circuits = [bell_measured(s[a], s[b]) for a, b in pairs]
    meta = [{"kind": "chsh", "a": a, "b": b, "angle_diff": s[a] - s[b]} for a, b in pairs]
    for k in range(sweep_points):
        theta = 2 * np.pi * k / sweep_points
        circuits.append(bell_measured(0.0, theta))
        meta.append({"kind": "sweep", "angle_diff": -theta})
    return circuits, meta


def correlation(counts: dict[str, int]) -> float:
    shots = sum(counts.values())
    return sum((1 if k.count("1") % 2 == 0 else -1) * v for k, v in counts.items()) / shots


# ----- Schwinger model -----
SCHWINGER = {"num_sites": 4, "x": 1.0, "mass": 0.5, "coupling": 0.6}
SCHWINGER_TIMES = [0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5]
SCHWINGER_DT = 0.25  # one second-order Trotter step per 0.25 of time


def schwinger_circuits():
    h = schwinger_hamiltonian(SCHWINGER["num_sites"], x=SCHWINGER["x"], mass=SCHWINGER["mass"], coupling=SCHWINGER["coupling"])
    n = SCHWINGER["num_sites"]
    circuits, meta = [], []
    for t in SCHWINGER_TIMES:
        qc = QuantumCircuit(n, n)
        for q in range(1, n, 2):  # bare vacuum |0101⟩: odd sites filled (Dirac sea)
            qc.x(q)
        if t > 0:
            steps = max(1, round(t / SCHWINGER_DT))
            qc.compose(trotter_circuit(h, t, steps=steps, order=2), inplace=True)
        qc.measure(range(n), range(n))
        circuits.append(qc)
        meta.append({"kind": "schwinger", "t": t})
    return circuits, meta


def particle_number(counts: dict[str, int], n: int = 4) -> tuple[float, list[float]]:
    """Total and per-site particle number: n_k = (1 − (−1)^k Z_k)/2, i.e. bit k = 1 on an even
    site (electron) or bit k = 0 on an odd site (positron)."""
    shots = sum(counts.values())
    site = np.zeros(n)
    for bits, c in counts.items():
        b = bits.replace(" ", "")[::-1]  # qiskit bitstrings: qubit 0 is rightmost
        for k in range(n):
            occupied = b[k] == "1"
            site[k] += c * (occupied if k % 2 == 0 else not occupied)
    site /= shots
    return float(site.sum()), site.tolist()


def readout_calibration_circuits(n: int = 4):
    zero = QuantumCircuit(n, n)
    zero.measure(range(n), range(n))
    one = QuantumCircuit(n, n)
    one.x(range(n))
    one.measure(range(n), range(n))
    return [zero, one], [{"kind": "readout", "prepared": 0}, {"kind": "readout", "prepared": 1}]


# ----- single-qubit randomized benchmarking -----
RB_LENGTHS = [1, 100, 400, 1000, 2000, 3500]
RB_SEQUENCES = 8


def rb_circuits(seed: int = 11):
    rng = np.random.default_rng(seed)
    circuits, meta = [], []
    for m in RB_LENGTHS:
        for s in range(RB_SEQUENCES):
            qc = QuantumCircuit(1, 1)
            total = Clifford(QuantumCircuit(1))
            for _ in range(m):
                c = random_clifford(1, seed=rng)
                qc.compose(c.to_circuit(), inplace=True)
                qc.barrier()  # keep the compiler from merging the sequence into one gate
                total = total.compose(c)
            qc.compose(total.adjoint().to_circuit(), inplace=True)
            qc.measure(0, 0)
            circuits.append(qc)
            meta.append({"kind": "rb", "m": m, "seq": s})
    return circuits, meta


def survival(counts: dict[str, int]) -> float:
    return counts.get("0", 0) / sum(counts.values())


def fit_rb(points: list[tuple[int, float]]):
    """Fit A f^m + B by scanning f with linear least squares for A, B."""
    ms = np.array([p[0] for p in points], float)
    ys = np.array([p[1] for p in points], float)
    best = None
    for f in np.linspace(0.95, 1.0, 50001)[:-1]:
        X = np.vstack([f**ms, np.ones_like(ms)]).T
        coef, *_ = np.linalg.lstsq(X, ys, rcond=None)
        res = float(np.sum((X @ coef - ys) ** 2))
        if best is None or res < best[0]:
            best = (res, f, coef)
    _, f, (A, B) = best
    return {"f": float(f), "A": float(A), "B": float(B), "error_per_clifford": float((1 - f) / 2)}
