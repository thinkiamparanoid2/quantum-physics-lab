"""Plots of the hardware results: python hardware_runs/plot.py → hardware_runs/plots/*.png"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import experiments as ex  # noqa: E402
from engine import exact_evolve, expectation_from_statevector  # noqa: E402
from modules.schwinger_model.hamiltonian import particle_number_operator, schwinger_hamiltonian, vacuum_state  # noqa: E402

HERE = Path(__file__).resolve().parent
R = HERE / "results"
OUT = HERE / "plots"
load = lambda name: json.loads((R / name).read_text())  # noqa: E731


def schwinger():
    p = ex.SCHWINGER
    h = schwinger_hamiltonian(p["num_sites"], x=p["x"], mass=p["mass"], coupling=p["coupling"])
    ops = [particle_number_operator(p["num_sites"], k) for k in range(p["num_sites"])]
    psi0 = vacuum_state(p["num_sites"])
    ts = np.linspace(0, 1.6, 81)
    exact = [sum(expectation_from_statevector(o, exact_evolve(h, t, psi0) if t else psi0) for o in ops) for t in ts]
    d = load("schwinger-run2-ibm_kingston-analysis.json")
    rows = d["rows"]
    t = [r["t"] for r in rows]
    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.plot(ts, exact, "k-", lw=2, label="exact")
    ax.plot(t, [r["raw"] for r in rows], "s", color="0.6", label="hardware, raw")
    ax.errorbar(t, [r["readout_mitigated"] for r in rows], [r["readout_mitigated_err"] for r in rows], fmt="o", color="tab:blue", capsize=3, label="+ readout mitigation")
    ax.errorbar(t, [r["zne_linear"] for r in rows], [r["zne_linear_err"] for r in rows], fmt="D", color="tab:red", capsize=3, label="+ zero-noise extrapolation")
    ax.axhline(2, color="0.75", ls=":", lw=1)
    ax.text(1.62, 2.02, "fully scrambled", color="0.5", fontsize=8, ha="right", va="bottom")
    ax.set_xlabel("time")
    ax.set_ylabel("total particle number")
    ax.set_title(f"Schwinger pair production on {d['source']} (qubits {d['layout']})")
    ax.legend(fontsize=8, loc="lower right")
    fig.tight_layout()
    fig.savefig(OUT / "schwinger_kingston.png", dpi=150)


def chsh():
    d = load("chsh-ibm_kingston-analysis.json")
    sw = sorted(d["sweep"], key=lambda r: r["angle_diff"] % (2 * np.pi))
    x = [r["angle_diff"] % (2 * np.pi) for r in sw]
    fig, ax = plt.subplots(figsize=(7, 4))
    xs = np.linspace(0, 2 * np.pi, 200)
    ax.plot(xs, np.cos(xs), "k-", lw=1.5, label="quantum prediction cos(a − b)")
    ax.plot(x, [r["E"] for r in sw], "o", color="tab:blue", label="ibm_kingston")
    ax.set_xlabel("angle between measurement directions a − b")
    ax.set_ylabel("correlation E(a, b)")
    ax.set_title(f"Bell test on ibm_kingston: S = {d['S']:.3f} ± {d['S_err']:.3f} (classical limit 2)")
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(OUT / "chsh_kingston.png", dpi=150)


def rb():
    d = load("rb-ibm_kingston-analysis.json")
    ms = np.array([p["m"] for p in d["points"]])
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.errorbar(ms, [p["survival"] for p in d["points"]], [p["sem"] for p in d["points"]], fmt="o", capsize=3, label=f"qubit {d['device_layout']}")
    xs = np.linspace(0, ms.max(), 200)
    ax.plot(xs, d["A"] * d["f"] ** xs + d["B"], "r-", label=f"fit: r = {d['error_per_clifford'] * 1e4:.2f} ± {d['error_per_clifford_err'] * 1e4:.2f} × 10⁻⁴ per Clifford")
    ax.set_xlabel("sequence length m (Cliffords)")
    ax.set_ylabel("survival probability of |0⟩")
    ax.set_title("Randomized benchmarking on ibm_kingston")
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(OUT / "rb_kingston.png", dpi=150)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    schwinger()
    chsh()
    rb()
    print("saved plots to", OUT)
