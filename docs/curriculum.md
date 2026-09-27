# What quantum courses teach, and where this site stands

Research notes (September 2026) behind the site's roadmap. The goal is to cover what
undergraduate quantum mechanics and quantum information courses actually teach, and to
prioritise the topics that are hardest to picture without a visual.

## Sources

- MIT 8.04 Quantum Physics I: [course page](https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2016/), [lecture calendar](https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2016/pages/calendar/)
- MIT 8.05 Quantum Physics II: [syllabus](https://ocw.mit.edu/courses/8-05-quantum-physics-ii-fall-2013/pages/syllabus)
- MIT 8.06 Quantum Physics III: [lecture notes](https://ocw.mit.edu/courses/8-06-quantum-physics-iii-spring-2018/pages/lecture-notes/)
- Cambridge Part IB/II quantum courses: [Cavendish Quantum Physics](https://www-teach.phy.cam.ac.uk/students/courses/quantum-physics/86), [David Tong's notes](https://www.damtp.cam.ac.uk/user/tong/quantum.html)
- Oxford (Binney): [The Physics of Quantum Mechanics synopsis](http://www-thphys.physics.ox.ac.uk/people/JamesBinney/qm_synopsis.html)
- Survey of 50+ US institutions: [Quantum mechanics curriculum in the US (arXiv:2407.15977)](https://arxiv.org/html/2407.15977v1)
- Quantum information courses: [UW QuantumX](https://www.quantumx.washington.edu/courses/), [Illinois IQUIST](https://iquist.illinois.edu/education/courses), [IIT Madras PH5840](https://physics.iitm.ac.in/~prabhamd/qcqi15.html), [IBM Quantum Learning](https://quantum.cloud.ibm.com/learning/en/courses/basics-of-quantum-information)
- Existing visualisation research: [QuVis, University of St Andrews](https://www.st-andrews.ac.uk/physics/quvis/de/index-about.php)

## What the survey says

- The Schrödinger equation (98% of courses) and 3D quantum mechanics (94%) are near-universal.
- About three-quarters of quantum mechanics courses start **position-first** (wavefunctions
  and differential equations); about a quarter start **spin-first** (two-state systems and linear
  algebra). This site so far is entirely spin-first, which is why wave mechanics is the biggest gap.
- The Stern–Gerlach experiment appears in only 28% of syllabi, despite research showing it helps.
  That makes it a good candidate for a visual that teachers can drop into any course.

## The standard undergraduate sequence

Condensed from MIT 8.04 → 8.05 → 8.06, Cambridge, Oxford and Griffiths-based courses.

| Stage | Topics | On the site |
|---|---|---|
| **Experimental origins** | Photoelectric effect, Compton scattering, de Broglie waves, double slit and Mach–Zehnder, Stern–Gerlach | **Mostly covered** (no Compton scattering yet) |
| **Wave mechanics** | Wavefunction and probability density, probability current, wave packets and group velocity, Fourier transforms and the uncertainty principle, Ehrenfest's theorem | **Mostly covered** (no probability current yet) |
| **1D bound states** | Infinite and finite square wells, harmonic oscillator (Hermite functions, ladder operators, coherent states), delta potential, particle on a ring, node theorem, shooting method | **Mostly covered** (no delta potential or ring yet) |
| **1D scattering** | Steps and barriers, tunnelling, transmission and reflection, Ramsauer–Townsend resonance, wave-packet scattering | **Covered** |
| **Formalism** | Operators, Hermiticity, commutators, measurement postulate, stationary states and time evolution, two-state systems | Partly (qubit, measurement) |
| **3D and angular momentum** | Central potentials, spherical harmonics, the hydrogen atom and its spectrum, orbitals | **Mostly covered** (no angular-momentum operators or ladder algebra yet) |
| **Spin** | Spin-1/2, Stern–Gerlach, precession in a magnetic field, magnetic resonance and Rabi oscillations, addition of angular momentum | **Mostly covered** (no addition of angular momentum yet) |
| **Many particles** | Identical particles, exchange symmetry, Pauli exclusion, periodic table, Fermi–Dirac and Bose–Einstein statistics | Not yet |
| **Solids** | Periodic potentials, Bloch waves, band structure (Kronig–Penney), metals vs insulators | Partly (lattice example in the Schrödinger playground) |
| **Approximation methods** | Time-independent perturbation theory, variational method, WKB, time-dependent perturbation theory, Fermi's golden rule, adiabatic theorem | Not yet |
| **Quantum information** | Qubits, measurement, entanglement, teleportation, superdense coding, QKD, algorithms | **Covered** |
| **Quantum information, further** | Bell/CHSH inequality, density matrices, decoherence, no-cloning, quantum error correction | **Covered** (no-cloning as a step, not its own lesson) |
| **Dynamics and simulation** | Hamiltonians, time evolution, Trotterisation | **Covered** (Hamiltonian Playground) |

## Roadmap

Ordered by how many courses teach the topic and how much a visual helps.

**Phase A: waves and the Schrödinger equation (done).** One shared 1D solver (eigenstates plus time
evolution) powers all of these.
1. Wave packets and the uncertainty principle
2. Particle in a box (stationary states, and superpositions that slosh)
3. The harmonic oscillator (eigenstates, coherent states, ladder operators)
4. Tunnelling and scattering (barriers, resonances, transmission)
5. The shooting method (find energy levels by hand, as in MIT 8.04 lecture 13)
6. A Schrödinger playground: draw any potential and see its states

**Phase B: spin and atoms (done).** Stern–Gerlach (sequential magnets), spin precession and magnetic
resonance (reusing the Bloch sphere), the hydrogen atom (3D orbitals, energy levels, spectral lines).

**Phase C: experiments that started it (done).** Double slit with single particles building up a pattern,
photoelectric effect, Mach–Zehnder interferometer and the Elitzur–Vaidman bomb tester.

**Phase D: quantum information, further (done).** Bell/CHSH test (quantum vs local hidden variables),
density matrices and decoherence, quantum error correction (bit-flip, phase-flip and Shor codes).

**Phase E: many particles and approximations.** Identical particles and exchange, periodic
potentials and band structure, perturbation theory, variational method, WKB.
