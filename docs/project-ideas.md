# Quantum Simulation Project Ideas: A Portfolio Guide

This guide collects project ideas for building physics simulations whose core is computed by quantum circuits. It's meant for reading and thinking, not copy-pasting. Each idea explains the physics, the quantum technique it uses, how hard it is, and what would make your version stand out. Pick one only after the ideas make sense to you.

---

## Part 1: Honest Feedback Before You Start

### What's good about your direction

Your instinct, "simulate things classical computers struggle with," is the original and still the most convincing reason quantum computers exist. Most beginner quantum portfolios are Grover's search, a Bell state, or a copied VQE tutorial. A physics simulator with a real story ("I simulated matter being created from the vacuum") is already a step above that.

### What will make or break the project

**1. Honesty about scale.** At 4–20 qubits, a laptop can compute all of these faster and more exactly than a quantum computer. That's fine, and saying it openly makes you look *more* credible, not less. Never claim "quantum advantage" in a README or LinkedIn post. People in the field notice immediately. The right framing is: *"This demonstrates the method that becomes powerful at scale, and here's what happens when I run it on real, noisy hardware."*

**2. Real hardware is your differentiator.** Anyone can run a simulator. Running a small version on a real IBM Quantum device, seeing the result get worse because of noise, and then applying error mitigation to recover some of it is what shows you understand the field as it actually is today. Plan for this from the start.

**3. Understanding beats volume.** One project you can explain line by line in an interview is worth more than five you can't. If you use an AI coding assistant, let it help with plotting, the web UI, and boilerplate, but write the physics core yourself: the Hamiltonian, the qubit encoding, and the circuit. That's the part an interviewer will ask about.

**4. The write-up is half the project.** A clear README with the physics explained in plain language, a diagram of the circuit, result plots, and a "limitations" section will do more for your LinkedIn than extra features.

**5. Watch out for scope creep.** It's easy to plan a 10-module lab and finish none of it. Finish one module completely (code, plots, hardware run, write-up) before starting the next.

### A note about your hardware

Your RTX 3070 (8 GB VRAM) can do GPU-accelerated statevector simulation, via `qiskit-aer-gpu` or PennyLane's `lightning.gpu`, up to roughly the high-20s in qubit count at single precision. Every idea below fits comfortably, so you won't need cloud compute except for real-hardware runs.

---

## Part 2: The Umbrella Project, "Quantum Physics Lab"

One repository with a shared engine and several simulation modules, each with an interactive front end.

```
quantum-physics-lab/
├── engine/          # shared code: Trotter evolution, measurement, noise models
├── modules/
│   ├── tunneling/
│   ├── neutrinos/
│   └── ...
├── hardware_runs/   # results from real IBM devices + error mitigation
├── app/             # Streamlit (or similar) interactive front end
└── README.md
```

**Why this works:** It shows you can design reusable software, not just scripts. It grows over time, so every new module is a new LinkedIn post. The shared engine forces you to understand what the simulations have in common: almost all of them are "encode a state → apply e^(−iHt) → measure."

**Every module should include:**
- A plain-language explanation of the physics
- The Hamiltonian and how it maps onto qubits
- A simulator result compared with the exact classical answer (to prove correctness)
- A real-hardware run, even a tiny one, plus error mitigation
- One interactive control (a slider for field strength, barrier height, and so on)

---

## Part 3: The Original Five Ideas

### 1. Quantum Tunneling / Wavepacket Simulator
**Difficulty:** ★★☆☆☆ · **Qubits:** 5–8 · **Uses:** QFT (which you already know)

**The physics:** A quantum particle hitting a wall can pass through it even when it classically doesn't have enough energy. This is tunneling, the effect behind nuclear fusion in the Sun and scanning tunneling microscopes.

**The quantum technique:** Represent the particle's position on a grid using n qubits (2ⁿ grid points). Time evolution uses the *split-operator method*: apply the potential energy as phases in position space, use the QFT to switch into momentum space, apply the kinetic energy as phases, and use the inverse QFT to switch back. Repeat for many small time steps.

**Visual output:** An animated wavepacket splitting at a barrier, with part reflecting and part tunneling through. Variants include the harmonic oscillator, a double well, and a crude double slit.

**What makes it stand out:** The QFT becomes a physical tool here, not just an algorithm step. Showing *why* the QFT converts position to momentum is a great learning moment to write about.

**Honest limit:** On real hardware, deep QFT circuits get destroyed by noise fast. Expect to show hardware runs for only 1–2 time steps.

---

### 2. Neutrino Oscillation Simulator
**Difficulty:** ★★☆☆☆ (basic) to ★★★★☆ (collective) · **Qubits:** 1–2 (basic), 4–16 (collective)

**The physics:** Neutrinos come in three "flavors" (electron, muon, tau) and change between them as they travel. This discovery won the 2015 Nobel Prize and proved neutrinos have mass.

**The quantum technique:** Two flavors are a single qubit. Three flavors fit in two qubits (using 3 of the 4 states). Oscillation is just time evolution under a simple Hamiltonian. The advanced version, *collective oscillations*, models many neutrinos interacting with each other inside a supernova. That's an active research area where quantum computers are genuinely being explored, because the entanglement between neutrinos makes it hard classically.

**Visual output:** Flavor probability vs. distance traveled. Stretch goal: neutrinos passing through the Earth or Sun (the MSW effect).

**What makes it stand out:** It's real particle physics, it starts easy, and it scales up to real research.

---

### 3. Quantum Magnetism / Spin Chain Dynamics
**Difficulty:** ★★★☆☆ · **Qubits:** 6–16 · **Uses:** Hamiltonians, Trotterization

**The physics:** A line of tiny magnets (spins) that interact with their neighbors. These models (Ising, Heisenberg) explain magnetism and are the "hello world" of many-body quantum physics.

**The quantum technique:** Each spin is a qubit. Break e^(−iHt) into small steps (Trotterization) made of two-qubit gates between neighbors.

**Experiments to run:**
- Flip one spin and watch the excitation spread in a "light cone"
- Suddenly change the magnetic field (a "quench") and watch the magnetization respond
- Measure how entanglement grows over time

**What makes it stand out:** This is exactly what IBM and Google use to benchmark their hardware, so you're working on the same problems as the professionals. It also maps well onto IBM's real qubit layout, which is a line/heavy-hex graph.

---

### 4. Pair Production from the Vacuum (the Schwinger Model)
**Difficulty:** ★★★★☆ · **Qubits:** 4–12 · **New concept to learn:** the Jordan–Wigner transformation

**The physics:** In quantum field theory, "empty" space isn't empty. A strong enough electric field can rip electron–positron pairs out of the vacuum. The Schwinger model is a simplified 1D version of quantum electrodynamics where this can be simulated.

**The quantum technique:** Put the field theory on a lattice (a grid of sites), then map the fermions (electrons/positrons) onto qubits using the Jordan–Wigner transformation. This is the standard trick for simulating matter particles on qubits, and learning it is valuable on its own.

**Landmark to reproduce:** In 2016, a group ran this on a 4-qubit trapped-ion quantum computer (Martinez et al., *Nature*), one of the first lattice gauge theory simulations on quantum hardware. You'd be reproducing a real milestone.

**Visual output:** Particle-number density growing over time as pairs are created. Advanced: "string breaking," where the field between two charges snaps and creates new particles.

**What makes it stand out:** It's the most "particle physics" of all the ideas, and the headline writes itself.

---

### 5. Black Hole Information Scrambling
**Difficulty:** ★★★★☆ · **Qubits:** 3–7 · **New concepts:** scrambling, out-of-time-order correlators (OTOCs), teleportation protocols

**The physics:** Black holes are believed to be nature's fastest "scramblers": information thrown in gets spread across all of the black hole's degrees of freedom almost instantly. The Hayden–Preskill thought experiment shows that, in principle, the information can be recovered from the radiation that comes out.

**The quantum technique:** A scrambling circuit (a unitary that spreads a qubit's information across many qubits), plus a teleportation-style protocol to recover it. In 2019, a group verified scrambling on a 7-qubit trapped-ion computer (Landsman et al., *Nature*).

**What makes it stand out:** It connects directly to your "black hole simulator" inspiration, but with genuinely quantum content.

**Honest note:** Be careful with framing. In 2022, a Google experiment was widely reported as a "wormhole on a quantum computer," and that coverage was heavily criticized as hype. Say "a toy model of black hole information scrambling," not "I simulated a black hole."

---

## Part 4: New, More Unique Ideas

### 6. Nuclear Physics on the Cloud: Binding the Deuteron
**Difficulty:** ★★☆☆☆ · **Qubits:** 2–3 · **Technique:** VQE

**The idea:** The deuteron is the simplest atomic nucleus (one proton + one neutron). In 2018, researchers computed its binding energy using cloud quantum computers from IBM and Rigetti (Dumitrescu et al., *Physical Review Letters*), one of the first nuclear physics calculations on quantum hardware.

**Why it's great for you:** It uses only 2–3 qubits, so it runs well on *real* hardware with good results. That's rare. It's also a VQE project that isn't the overdone H₂ molecule, and the story "I calculated what holds an atomic nucleus together on a real quantum computer" is excellent.

**Stretch goal:** Extrapolate to larger basis sizes, as the original paper did, and compare with the experimental value (~2.22 MeV).

---

### 7. Discrete Time Crystal
**Difficulty:** ★★★☆☆ · **Qubits:** 8–20

**The idea:** A time crystal is a phase of matter that repeats in *time* the way a normal crystal repeats in space. Driven periodically, the spins flip back and forth at *twice* the driving period and keep doing it robustly even with imperfections. Google demonstrated one on its Sycamore processor (Mi et al., *Nature*, 2021/2022), and similar experiments have been run on IBM hardware.

**Why it's unique:** It's an exotic phase of matter that genuinely *only makes sense* as a quantum, many-body, out-of-equilibrium system. It's visually striking (a clean period-doubled oscillation) and is an eye-catching LinkedIn topic.

**Nice detail:** It fits naturally into the spin chain engine from idea #3, so it's a strong second module for the Lab.

---

### 8. Noise as a Feature: Energy Transfer in Photosynthesis
**Difficulty:** ★★★★☆ · **Qubits:** 3–8 · **New concepts:** open quantum systems, decoherence

**The idea:** In photosynthesis, energy absorbed by chlorophyll travels to a "reaction center" with surprisingly high efficiency. One well-known theory, *environment-assisted quantum transport*, says a moderate amount of noise actually *helps* the energy move, because too little noise leaves it stuck in interference patterns and too much freezes it in place.

**The creative twist:** Every other project treats hardware noise as the enemy. Here you *use* the controlled noise (or the real device's own noise) as the environment. You'd show transport efficiency vs. noise strength and find a "sweet spot" in the middle.

**Why it's unique:** Very few portfolio projects flip the noise narrative like this. It connects quantum physics, biology, and hardware realities.

**Honest note:** How much quantum coherence matters in real photosynthesis is still debated. Present it as a model, not a proven biological fact.

---

### 9. Particle Creation in an Expanding Universe
**Difficulty:** ★★★★☆ · **Qubits:** 2–10

**The idea:** When space itself expands quickly (as in the early universe), quantum fields can create particles out of the vacuum. This is part of how the structures we see in the cosmos may have been seeded. Toy versions reduce a field mode to a few qubits and evolve them with a time-dependent Hamiltonian.

**Why it's unique:** It's cosmology on a quantum computer, a topic very few beginners touch. Conceptually it's a cousin of the Schwinger model (#4): both are about "particles from nothing," one driven by an electric field and one by expanding space. They'd make a great pair of modules.

**Honest note:** This one requires reading some papers and simplifying heavily. Treat it as a later-stage project.

---

### 10. Anyons and Topological Order: The Toric Code
**Difficulty:** ★★★★☆ · **Qubits:** 8–20

**The idea:** In 2D, there can be particles called *anyons* that are neither bosons nor fermions. When you move one around another, the system remembers the path. The toric code is the simplest model that has them, and it's also the foundation of leading quantum error correction schemes.

**What you'd build:** Prepare the toric code ground state, create pairs of anyons, braid them, and detect the resulting phase. Google demonstrated anyon braiding on its hardware in 2022–2023.

**Why it's unique:** It connects exotic physics with the most important engineering problem in quantum computing (error correction). This makes a strong interview topic for anyone who wants to work in the industry.

---

### 11. Quantum Chaos: The Kicked Top
**Difficulty:** ★★★☆☆ · **Qubits:** 3–10

**The idea:** A classical spinning top that gets periodically "kicked" can behave chaotically. What does chaos even mean for a *quantum* system? The quantum kicked top lets you compare the classical and quantum versions side by side. This model has also been studied experimentally on superconducting qubits.

**Visual output:** A side-by-side of the classical phase space (orderly islands vs. chaotic sea) and the quantum behavior, including how entanglement generation differs in chaotic vs. regular regions.

**Why it's unique:** It's a beautiful, rarely seen visualization, and it pairs philosophically with the black hole scrambling idea (#5), since chaos and scrambling are closely related.

---

### 12. The Trotter vs. Noise Trade-off Study (a mini research project)
**Difficulty:** ★★★☆☆ · **Qubits:** 4–10

**The idea:** Every simulation above has the same hidden dilemma. More Trotter steps give a more accurate simulation but a deeper circuit, which means more hardware noise. So there's an *optimal* number of steps on a real device. Measure it systematically.

**What you'd build:** Take one model (like the spin chain), and for each number of Trotter steps, measure the error vs. the exact answer on the ideal simulator, a simulator with a realistic noise model, and real hardware. Plot the U-shaped error curve and find the minimum.

**Why it's unique:** This isn't a demo, it's a small research study with a real, practical conclusion. It shows scientific thinking, which employers and grad programs value highly. It can be a "chapter" of the Quantum Physics Lab that analyzes the other modules.

---

### 13. Quantum Sonification: Hearing Quantum Dynamics
**Difficulty:** ★★☆☆☆ (on top of any other module)

**The idea:** Turn the output of your simulations into sound. Measurement probabilities become pitches or volumes, entanglement becomes harmony or dissonance, and a time crystal becomes a rhythm.

**Why it's unique:** It's a creative, shareable layer. A 30-second video of "what a tunneling electron sounds like" will get far more LinkedIn engagement than a static plot. It's not a standalone project, but a great add-on once something works.

---

## Part 5: Comparison Table

| # | Idea | Difficulty | Qubits | Real hardware friendliness | Uniqueness | Best as |
|---|------|-----------|--------|---------------------------|------------|---------|
| 1 | Tunneling / wavepackets | ★★ | 5–8 | Low (deep circuits) | Medium | First module |
| 2 | Neutrino oscillations | ★★–★★★★ | 1–16 | High (basic version) | Medium–High | Early module |
| 3 | Spin chain dynamics | ★★★ | 6–16 | Medium | Medium | Engine backbone |
| 4 | Schwinger model | ★★★★ | 4–12 | Medium (small sizes) | High | Flagship |
| 5 | Black hole scrambling | ★★★★ | 3–7 | Medium | High | Flagship |
| 6 | Deuteron binding | ★★ | 2–3 | Very high | Medium–High | Quick real-hardware win |
| 7 | Time crystal | ★★★ | 8–20 | Medium | High | Second module |
| 8 | Photosynthesis / noise-assisted transport | ★★★★ | 3–8 | Uses noise on purpose | Very high | Standout project |
| 9 | Expanding-universe particle creation | ★★★★ | 2–10 | Medium | Very high | Later-stage |
| 10 | Toric code / anyons | ★★★★ | 8–20 | Low–Medium | High | Industry-focused |
| 11 | Quantum kicked top | ★★★ | 3–10 | Medium | High | Visual showpiece |
| 12 | Trotter vs. noise study | ★★★ | 4–10 | Core of the project | High | Research chapter |
| 13 | Sonification | ★★ | – | – | Very high | Add-on |

---

## Part 6: Possible Paths Through This List

These are just examples of how the ideas fit together. The choice is yours.

**Path A: "Particle physicist."** Tunneling (#1) → Neutrinos (#2) → Deuteron (#6) → Schwinger model (#4). A story running from single particles to nuclei to quantum field theory.

**Path B: "Exotic phases of matter."** Spin chains (#3) → Time crystal (#7) → Toric code (#10). Strongest for someone who wants to work at a quantum hardware company.

**Path C: "Big questions."** Spin chains (#3) → Kicked top (#11) → Black hole scrambling (#5) → Expanding universe (#9). Chaos, black holes, cosmology: great storytelling, harder physics.

**Path D: "Hardware realist."** Deuteron (#6) → Spin chains (#3) → Trotter vs. noise study (#12) → Photosynthesis (#8). Focused on what actually works on today's devices, and on turning noise into a feature.

---

## Part 7: Questions to Ask Yourself Before Choosing

1. Which one would I still find interesting after two frustrating weeks of debugging?
2. Which physics can I explain to a friend over coffee, after some reading?
3. Do I want to impress physicists, quantum-industry recruiters, or a general LinkedIn audience? (Different ideas win with each.)
4. How much new theory am I willing to learn before writing code? (#1, #2, #6 need little; #4, #9, #10 need a lot.)
5. Can I finish a first version in 2–4 weeks?

---

## Part 8: Useful Starting Points

- **Qiskit** (IBM) — the natural choice if you want to run on IBM's free real hardware tier
- **PennyLane** (Xanadu) — clean API, good for VQE and differentiable circuits
- **IBM Quantum Platform** — free monthly access to real devices
- **Error mitigation to learn:** zero-noise extrapolation (ZNE) and readout error mitigation are the most beginner-friendly
- **Search terms for papers:** "digital quantum simulation," "Trotterization," "lattice gauge theory quantum computer," "Jordan–Wigner transformation," plus the paper names mentioned above
