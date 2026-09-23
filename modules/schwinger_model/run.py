"""Simulate pair production from the vacuum in the lattice Schwinger model.

Starts in the bare vacuum (no particles), turns on the Hamiltonian, and watches the
particle-number density grow at each site as electron-positron pairs are pulled out of
the vacuum by the electric field -- exactly analogous to how a strong enough field can
rip pairs out of empty space in real QED.

Usage:
    python run.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from engine import exact_evolve, expectation_from_statevector, trotter_steps_circuit
from modules.schwinger_model.hamiltonian import (
    particle_number_operator,
    schwinger_hamiltonian,
    vacuum_state,
)


def run_simulation(
    num_sites: int = 4,
    x: float = 1.0,
    mass: float = 0.5,
    coupling: float = 0.6,
    total_time: float = 6.0,
    steps: int = 60,
    trotter_order: int = 2,
) -> dict:
    hamiltonian = schwinger_hamiltonian(num_sites, x=x, mass=mass, coupling=coupling)
    initial_state = vacuum_state(num_sites)
    number_ops = [particle_number_operator(num_sites, site) for site in range(num_sites)]

    times = np.linspace(0, total_time, steps + 1)

    # exact reference
    exact_density = np.zeros((steps + 1, num_sites))
    for t_index, t in enumerate(times):
        state = exact_evolve(hamiltonian, t, initial_state) if t > 0 else initial_state
        for site, op in enumerate(number_ops):
            exact_density[t_index, site] = expectation_from_statevector(op, state)

    # Trotterized circuit, evaluated via statevector (ideal simulator -- see hardware/ for
    # a real-device version with shots + noise)
    trotter_density = np.zeros((steps + 1, num_sites))
    trotter_density[0] = 0.0  # t=0 is the untouched vacuum
    step_circuits = trotter_steps_circuit(hamiltonian, total_time, steps, order=trotter_order)
    for t_index, circuit in enumerate(step_circuits, start=1):
        state = initial_state.evolve(circuit)
        for site, op in enumerate(number_ops):
            trotter_density[t_index, site] = expectation_from_statevector(op, state)

    return {
        "times": times,
        "exact_density": exact_density,
        "trotter_density": trotter_density,
        "num_sites": num_sites,
    }


def plot_results(results: dict, output_path: Path) -> None:
    times = results["times"]
    num_sites = results["num_sites"]

    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5), sharey=True)

    total_exact = results["exact_density"].sum(axis=1)
    total_trotter = results["trotter_density"].sum(axis=1)

    axes[0].plot(times, total_exact, label="exact", linewidth=2)
    axes[0].plot(times, total_trotter, "--", label="Trotterized circuit", linewidth=2)
    axes[0].set_xlabel("time")
    axes[0].set_ylabel("total particle number")
    axes[0].set_title("Pairs created from the vacuum")
    axes[0].legend()

    for site in range(num_sites):
        axes[1].plot(
            times,
            results["exact_density"][:, site],
            label=f"site {site}",
            linewidth=2.5 - 0.4 * site,
            linestyle=["-", "--", ":", "-."][site % 4],
        )
    axes[1].set_xlabel("time")
    axes[1].set_title("Per-site particle density (exact)\n(site 0 mirrors site 3, site 1 mirrors site 2)")
    axes[1].legend(fontsize=8)

    fig.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=150)
    print(f"Saved plot to {output_path}")


if __name__ == "__main__":
    results = run_simulation()
    plot_results(results, Path(__file__).parent / "plots" / "pair_production.png")

    final_fidelity_proxy = np.abs(
        results["exact_density"][-1].sum() - results["trotter_density"][-1].sum()
    )
    print(f"Final total particle number (exact):     {results['exact_density'][-1].sum():.4f}")
    print(f"Final total particle number (Trotter):   {results['trotter_density'][-1].sum():.4f}")
    print(f"Difference:                              {final_fidelity_proxy:.4f}")
