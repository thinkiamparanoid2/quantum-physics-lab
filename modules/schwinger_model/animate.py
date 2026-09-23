"""Real-time animation: pairs being created from the vacuum in the lattice Schwinger model,
simulated with PennyLane.

Download-and-run: `python animate.py` opens a live matplotlib window showing the
per-site particle density as bars that rise and fall as pairs are created and reabsorbed,
plus the running total. It also saves a GIF so you can share the result without anyone
needing to run the code themselves.

Usage:
    python animate.py
    python animate.py --sites 6 --mass 0.3 --coupling 1.0 --time 8 --frames 80
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib.animation as animation
import matplotlib.pyplot as plt
import numpy as np
import pennylane as qml

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from modules.schwinger_model.hamiltonian_pennylane import schwinger_hamiltonian_pennylane, vacuum_bits


def simulate_frames(
    num_sites: int,
    x: float,
    mass: float,
    coupling: float,
    total_time: float,
    frames: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Returns (times, densities) where densities[k, site] is the particle-number density
    at site `site` after `k` Trotter steps of fixed size dt = total_time / frames.

    Each frame k reuses the same step size as every other frame (t_k = k * dt via
    ApproxTimeEvolution(H, t_k, k)), matching how a real device accumulates one more
    Trotter step per unit of elapsed time rather than re-discretizing from scratch.
    """
    hamiltonian = schwinger_hamiltonian_pennylane(num_sites, x, mass, coupling)
    device = qml.device("default.qubit", wires=num_sites)
    initial_bits = np.array(vacuum_bits(num_sites))

    @qml.qnode(device)
    def circuit(evolution_time: float, trotter_steps: int):
        qml.BasisState(initial_bits, wires=range(num_sites))
        if trotter_steps > 0:
            qml.ApproxTimeEvolution(hamiltonian, evolution_time, trotter_steps)
        return [qml.expval(qml.PauliZ(i)) for i in range(num_sites)]

    times = np.linspace(0, total_time, frames + 1)
    signs = np.array([(-1) ** i for i in range(num_sites)])
    densities = np.zeros((frames + 1, num_sites))

    for k, t in enumerate(times):
        z_values = np.array(circuit(t, k))
        densities[k] = (1 - signs * z_values) / 2

    return times, densities


def animate(
    num_sites: int = 4,
    x: float = 1.0,
    mass: float = 0.5,
    coupling: float = 0.6,
    total_time: float = 6.0,
    frames: int = 60,
    save_path: Path | None = None,
    show: bool = True,
) -> Path:
    times, densities = simulate_frames(num_sites, x, mass, coupling, total_time, frames)
    total_particles = densities.sum(axis=1)

    fig, (ax_bars, ax_total) = plt.subplots(1, 2, figsize=(11, 4.5))

    bars = ax_bars.bar(range(num_sites), densities[0], color="tab:blue")
    ax_bars.set_ylim(0, max(densities.max(), 1e-3) * 1.15)
    ax_bars.set_xlabel("lattice site")
    ax_bars.set_ylabel("particle number density")
    ax_bars.set_xticks(range(num_sites))
    title = ax_bars.set_title("t = 0.00")

    (line,) = ax_total.plot([], [], color="tab:orange", linewidth=2)
    ax_total.set_xlim(0, total_time)
    ax_total.set_ylim(0, max(total_particles.max(), 1e-3) * 1.15)
    ax_total.set_xlabel("time")
    ax_total.set_ylabel("total particle number")
    ax_total.set_title("Pairs created from the vacuum")

    fig.suptitle(f"Schwinger model: x={x}, mass={mass}, coupling={coupling} ({num_sites} qubits, PennyLane)")
    fig.tight_layout()

    def update(frame_index: int):
        for bar, height in zip(bars, densities[frame_index]):
            bar.set_height(height)
        title.set_text(f"t = {times[frame_index]:.2f}")
        line.set_data(times[: frame_index + 1], total_particles[: frame_index + 1])
        return [*bars, line, title]

    anim = animation.FuncAnimation(fig, update, frames=len(times), interval=80, blit=False, repeat=True)

    if save_path is None:
        save_path = Path(__file__).parent / "plots" / "pair_production_pennylane.gif"
    save_path.parent.mkdir(parents=True, exist_ok=True)
    anim.save(save_path, writer=animation.PillowWriter(fps=15))
    print(f"Saved animation to {save_path}")

    if show:
        plt.show()
    else:
        plt.close(fig)

    return save_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sites", type=int, default=4)
    parser.add_argument("--x", type=float, default=1.0, help="hopping strength")
    parser.add_argument("--mass", type=float, default=0.5)
    parser.add_argument("--coupling", type=float, default=0.6, help="electric field coupling")
    parser.add_argument("--time", type=float, default=6.0, help="total simulated time")
    parser.add_argument("--frames", type=int, default=60)
    parser.add_argument("--no-show", action="store_true", help="save the GIF without opening a live window")
    args = parser.parse_args()

    animate(
        num_sites=args.sites,
        x=args.x,
        mass=args.mass,
        coupling=args.coupling,
        total_time=args.time,
        frames=args.frames,
        show=not args.no_show,
    )
