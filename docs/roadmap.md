# Roadmap: from 39 lessons to a reference people cite

Written 2026-10-12. This roadmap builds on [`curriculum.md`](curriculum.md), whose phases A to E are done.
It covers three things: what the research says is still missing, how to fix the cluttered UI, and
how to sequence the work so the site earns attention from instructors and professors.

> **Status note, 2026-10-26.** Written when the site had 39 lessons; the catalog now holds 84,
> all live, which is the "80+ topics planned below" this document anticipated. The home-page
> redesign it asks for landed on 2026-10-13, so diagnosis 1 in section 2 is resolved and is
> marked as such. The remaining diagnoses have not been re-checked against the current site, so
> read them as the state on 2026-10-12 rather than as today's.

---

## 1. Where the site stands

**Strengths that are rare and worth protecting**

- Breadth across both quantum mechanics and quantum computing. Most tools do one or the other:
  PhET, QuVis and QuILTs do conceptual QM; Quirk and IBM Composer do circuits.
- Exact physics with an independent check for every result (72 web tests, 7 Python tests, numpy
  and Qiskit references). Almost no education tool can say this, and professors notice it.
- No install, no account, shareable links to an exact step, and a Present mode.
- An honest tone: no claims of quantum advantage, and schematics labelled as schematics.

**Weaknesses**

- The UI is dense. Section 3 gives the details.
- Almost everything is single-qubit or textbook-level. Little would surprise a quantum-information
  or field-theory researcher.
- There is no learning layer (predictions, concept checks, teacher notes), and the PER (physics
  education research) literature shows that is what turns a simulation into a teaching tool.
- There is no evidence yet that it helps anyone learn, and that is the first thing an education
  researcher will ask about.

---

## 2. What is missing, from the research

I surveyed existing tools, the PER literature and current quantum courses. Six gaps stand out.

| Gap | Evidence | Opportunity for this site |
|---|---|---|
| **Entanglement is invisible in every popular tool** | Circuit-tool interfaces such as IBM Composer and Quirk "typically display only single-qubit reduced states, omitting critical information about entanglement" ([arXiv 2510.00895](https://arxiv.org/pdf/2510.00895), whose MuqcsCraft adds pairwise concurrence). New visualizations are active research: complex concurrence ([2603.07942](https://arxiv.org/abs/2603.07942v2)), multi-sphere models ([2607.04979](https://arxiv.org/pdf/2607.04979)), dimensional circle notation (Bley et al., PRR 2024, [2305.07596](https://arxiv.org/abs/2305.07596v4)), and geometric pictures in AJP (Chang et al., 2024). | Our Bloch spheres already shrink under entanglement. Add a two-qubit **entanglement view** (Schmidt decomposition, concurrence, entanglement entropy) to every circuit lesson. This is both a research-grade visual and a good paper topic. |
| **No browser tool teaches surface codes end to end** | Crumble, the browser stabilizer editor, is "a prototype… a complete lack of user interface polish." The decoder tools (qsurface, PyMatching) are Python, and I found no browser decoder ([Crumble](https://algassert.com/crumble), [Stim paper](https://arxiv.org/pdf/2103.02202)). Google's Willow showed below-threshold scaling, with Λ ≈ 2.14 across distances 3, 5 and 7 ([APS Physics](https://physics.aps.org/articles/v17/176), [UCSB colloquium](https://www.physics.ucsb.edu/events/all/colloquium-willow-and-quantum-computing-below-surface-code-threshold)). | A **QEC track**: stabilizers, then the surface code, a live decoder, a threshold measured in the browser, and Willow's data. This is timely and nobody has done it well. |
| **QML has one playground, covering one model** | QML Playground (Fraunhofer, IEEE CG&A) visualizes only the data re-uploading classifier ([2507.17931](https://arxiv.org/abs/2507.17931v1)). Barren-plateau tools are Python or TensorBoard ([Mind the QApp](https://indico.cern.ch/event/1433194/contributions/6279994), [EQuaTE](https://aurora.ajou.ac.kr/handle/2018.oak/36951)). Meanwhile the field is questioning itself: provable absence of barren plateaus may imply classical simulability ([Cerezo et al., 2312.09121](https://arxiv.org/abs/2312.09121)). | A **QML track** that trains models live and is honest about the hype: encodings, models as Fourier series, kernels, barren plateaus measured live, and a lesson on dequantization. Honesty is the differentiator. |
| **Nothing interactive for second quantization or lattice field theory** | Feynman-diagram games exist ([FeynCraft](https://arxiv.org/abs/2510.14082)), but I found no web app for creation and annihilation operators, Fock space or lattice gauge theory. Tensor-network GUIs are general-purpose ([GuiTeNet](https://arxiv.org/pdf/1808.00532)). The Schwinger model is the standard testbench for tensor-network and quantum-simulation methods ([Edinburgh colloquium](https://higgs.ph.ed.ac.uk/colloquia/applying-tensor-network-techniques-to-lattice-gauge-theories/)). | This repo **already has a validated Schwinger model**. A **"Quantum fields on a lattice"** track is the strongest hook for field-theory experts and the most distinctive thing the site could own. |
| **Tools help students get answers, not reasoning** | A think-aloud study found a QM simulation "helps students to obtain the correct answers… but additional support is needed to facilitate the development of student reasoning" ([2104.13260](https://arxiv.org/pdf/2104.13260)). Research-based sims (PhET, QuVis, QuILTs) are iteratively refined with students and have shown learning gains ([Kohnle et al.](https://research-portal.st-andrews.ac.uk/en/publications/research-based-interactive-simulations-to-support-quantum-mechani/)). No-code tools stop working when learners never move on to the maths ([2604.06293](https://arxiv.org/pdf/2604.06293)). | Add **predict-then-observe questions**, a "show the maths" layer per step, and a small user study. |
| **Teachers need materials and access, not just sims** | PhET's adoption rests on an activities database of "hundreds of lesson plans, homework assignments, labs, clicker questions" ([SERC](https://serc.carleton.edu/sp/library/phet/examples/example1.html)) and on keyboard, screen-reader and sonification support ([PhET accessibility](https://snow.idrc.ocadu.ca/articles/the-phet-interactive-simulations-project-working-to-increase-access-to-interactive-stem-simulations-part-2-of-2/)). | **Teacher pages**: goals, misconceptions, clicker questions and worksheets for each lesson, plus an accessibility pass. |

What is already well served and should be linked rather than rebuilt: Feynman-diagram games
(FeynCraft), stabilizer-circuit editing (Crumble), hardware access (IBM Composer) and
full-length courses (IBM Quantum Learning, which now includes error correction, the general
formulation of quantum information and quantum diagonalization:
[catalog](https://learning.quantum.ibm.com/catalog),
[QDA course](https://quantum.cloud.ibm.com/learning/en/courses/quantum-diagonalization-algorithms)).

---

## 3. UI: why it feels congested, and the fix

These findings come from screenshots of the home page, teleportation, tunnelling, Shor's code,
the sandbox and the playground at 1440 px.

### Diagnosis

1. **The home page was one 39-card wall — resolved 2026-10-13.** Every section got the same
   weight, rows of four left single orphan cards, and three explainer blocks came before the
   content, which would not have scaled to the 80+ topics planned below. The home page now
   shows five track rows, each carrying its sections and its lesson count, with per-topic
   browsing moved to `topics/`.
2. **Lesson stages are tall stacks of equal cards.** Teleportation step 5 stacks circuit, state,
   three 250 px Bloch spheres and two more spheres. The step text sits in a narrow left column,
   and the visual it describes is often a screen away. On a phone this becomes a very long scroll.
3. **Everything is visible at once.** Each card has a legend, a hint and small mono labels.
   That is fine for an expert, but noisy for a student and hard to read on a projector.
4. **Small visual bugs:**
   - On Shor's code, the threshold chart's curve labels overlap ("3 qubits", "9 qubits" and so on
     print on top of each other).
   - In the sandbox, the Bloch note "no direction of its own" collides with the |1⟩ label.
   - Teleportation step 5 says "Fidelity 100%. Not the message yet." whenever Alice measures 00.
     The note checks the step, not the fidelity (`web/teleportation/app.js`, `comparison`).

### Design direction: one idea, one main visual

- **A stage hierarchy.** Each step declares a *primary* view (large, beside the text) and
  optional *secondary* views. Secondary views go in tabs or a collapsed "More views" strip.
  `runCircuitLesson` already has `views`, so add `primary` and `views` per step.
- **Text docked to the visual.** On wide screens use a two-column split with a sticky step
  card, so the explanation and the picture are always both visible. On phones, put the step text
  in a bottom sheet over the visual.
- **Compact Bloch row.** Smaller multi-qubit spheres (about 140 px) in one row. Enlarge one on
  click.
- **Progressive disclosure.** Hide legends behind an ⓘ toggle, and keep "Try it" collapsed until
  the last step or until opened.
- **A home page that scales:**
  - a hero;
  - a choice of four **learning tracks** (Quantum mechanics, Quantum computing, Error
    correction, Quantum machine learning, then later Fields);
  - a compact section grid (nine tiles, each with a progress count);
  - section pages that hold the lesson cards;
  - search and filters (level, course alignment).
- **A projector check on every change.** Minimum 14 px for canvas text, and test in both themes
  at 1280×720.
- **Rhythm.** Fewer bordered panels, more whitespace between groups than inside them, and one
  accent colour per view.

---

## 4. The content roadmap

Sizes: **S** is about a week, **M** two to three weeks, **L** a month or more, all part-time.
Every lesson keeps the house rule: physics in `web/lib/` with an independent test, and a
Python-lab cross-check where one exists.

### Phase 0: polish and foundations (do first, about 3 weeks)

| Item | Size | Notes |
|---|---|---|
| Fix the three bugs in section 3 | S | Quick credibility win |
| Stage hierarchy, docked text, compact Bloch row | M | Shared change in `ui/lesson.js` and `ui/circuit-lesson.js` |
| Home page restructure: tracks, section pages, search | M | `catalog.js` gains `tracks` and `prereqs` |
| Web Worker helper for heavy simulations | S | Needed for QEC Monte Carlo, QML training and MPS |
| `CITATION.cff` plus a Zenodo DOI for releases | S | Makes the site citable |
| Public "Is it right?" page on the site, listing every check | S | The README already has the content |

### Phase F: finish the QM core (from `curriculum.md`)

Probability current, delta potential, particle on a ring, angular-momentum algebra and addition
of angular momenta, time-dependent perturbation theory and Fermi's golden rule, the adiabatic
theorem with Landau–Zener, and finite-temperature statistics. These are about 6 S/M lessons, and
they can be interleaved with the tracks below.

### Phase 1: quantum information done properly (about 6 weeks)

| Lesson | Size | Key visual |
|---|---|---|
| **Entanglement, measured** | M | Schmidt decomposition as two coupled Bloch arrows; concurrence and entropy live; two-qubit state space. Then add it as a view to every circuit lesson. |
| Density matrices and quantum channels | M | Bloch-ball maps: depolarizing, amplitude damping, dephasing; Kraus operators; Stinespring as a circuit |
| Generalized measurement (POVMs) and state discrimination | S | Unambiguous discrimination of two non-orthogonal states |
| No-cloning and monogamy of entanglement | S | |
| Quantum walks | S | Spreading ∝ t against classical √t |

### Phase 2: the error-correction track (flagship, about 3 months)

The engine work is a **stabilizer tableau simulator in JS** (Aaronson–Gottesman) plus a
**Pauli-frame sampler**. Validate both against Stim and PyMatching in the Python lab, using the
`reference.json` pattern. The existing lessons (repetition code, Shor's code) become lessons 1 and 2.

| Lesson | Size | Key visual |
|---|---|---|
| Stabilizers: describing states by what leaves them alone | M | Pauli-group table; the same state as a vector and as its stabilizers |
| Steane [[7,1,3]] and CSS codes | M | Two classical Hamming codes making one quantum code |
| **The surface code** | L | Click qubits to add X/Z errors and watch syndromes light up; logical operators as strings across the lattice |
| **Decoding** | L | Animated minimum-weight matching and union-find on your own error pattern; a decoder failing on a logical string |
| **Threshold in the browser** | M | Monte Carlo logical error rate against p for d = 3, 5, 7, computed live in a worker, with the Willow points on top |
| Fault tolerance and circuit noise | M | Measurement errors, so time becomes a third dimension of the lattice |
| Magic states and distillation | M | Why Clifford gates are not enough; the 15-to-1 protocol as fidelity in against fidelity out |
| Toric code and anyons | M | A bridge to the fields track |

### Phase 3: the quantum machine learning track (about 2.5 months)

The engine work is a parameterized circuit with exact **parameter-shift gradients** and an
optimizer in a worker. Validate against PennyLane, the owner's preferred framework.

| Lesson | Size | Key visual |
|---|---|---|
| Encoding data: basis, angle, amplitude | S | The same dataset in three encodings |
| A classifier that trains while you watch | M | Decision boundary, loss curve, Bloch states per layer (QML Playground style, built on our engine) |
| **Quantum models are Fourier series** | M | Spectrum of the model against the number of re-uploadings (Schuld, Sweke & Meyer 2021) |
| Quantum kernels | M | Kernel matrix heatmap against a classical RBF kernel on the same data |
| **Barren plateaus, measured** | M | Gradient variance against qubits and depth, live, with noise-induced plateaus |
| VQE and QAOA landscapes | M | H₂ dissociation curve; MaxCut on small drawable graphs; the energy landscape over (γ, β) |
| **Is there an advantage?** | S | Dequantization, classical simulability, what is open. Cite both sides. |

### Phase 4: quantum fields on a lattice (the distinctive track, about 3 months)

This is the track a QFT or many-body professor would remember. It starts from what the Python
lab already validates.

| Lesson | Size | Key visual |
|---|---|---|
| From oscillators to particles | M | A chain of coupled masses → normal modes → phonons as quanta; ladder operators acting on occupation numbers |
| Fock space, bosons and fermions | M | Creation and annihilation operators clickable on occupation diagrams; anticommutation signs shown |
| Jordan–Wigner: fermions as qubits | S | The Z-string drawn growing along the chain |
| **The Schwinger model: pair creation** | M | The existing physics, now in the web engine: vacuum quench, then pairs; staggered fermions explained |
| **Confinement and string breaking** | M | Two static charges with the electric flux string between them; the string snaps into a pair past a critical length |
| The transverse-field Ising model | M | A quantum phase transition; the gap closing; a Kibble–Zurek quench |
| **Entanglement area law and MPS** | L | A TEBD/DMRG engine in the browser for 1D chains; bond-dimension slider; entanglement entropy against cut position; light cones (the playground preset exists) |
| Simulating fields on quantum hardware | S | Trotter cost against system size, linking to the Hamiltonian Playground and the Martinez et al. 2016 experiment |

### Phase 5: algorithms and hardware realism (ongoing)

- **Algorithms:** amplitude amplification and estimation, Simon's algorithm, Hamiltonian
  simulation (qDRIFT against Trotter), the adiabatic algorithm, HHL with its caveats, and
  quantum-safe cryptography in context.
- **Hardware:**
  - how a transmon works (the anharmonic oscillator as a qubit), plus trapped ions;
  - gate pulses and leakage, readout error, randomized benchmarking;
  - zero-noise extrapolation (the engine already has `zne_fold`);
  - the planned `hardware_runs/`: real IBM data next to the ideal curve, shown on the site.

---

## 5. The learning layer (what turns sims into teaching tools)

Build this once in the lesson frame, then fill it in per lesson:

1. **Predict first.** A one-click prediction before a key reveal ("Which detector clicks?").
   Store it locally and show it beside the result. Predict-observe-explain is the PER-standard
   way to provoke reasoning.
2. **Show the maths.** A collapsible panel per step with the equation the visual is computing,
   with live numbers.
3. **Concept checks.** Two or three multiple-choice questions per lesson, drawn from the known
   misconceptions (Styer; Singh; the QuVis papers), with explanations.
4. **A teacher page per lesson.** Learning goals, prerequisites, misconceptions, clicker
   questions, a printable worksheet, and course alignment (e.g. "MIT 8.04 lecture 13").
5. **Accessibility.** Keyboard control of every canvas, text descriptions that update with the
   state (PhET's parallel-DOM approach), reduced-motion support everywhere, and contrast checks.
6. **Translations later.** Keep the copy in one place per lesson so they become possible.

---

## 6. Getting professors' attention (and the master's application)

Professors read hundreds of "I built an app" emails. What separates this project is **evidence
and depth**:

1. **One flagship, finished deeply.** Pick the error-correction track or the fields track, not
   both at once. A professor in QEC or lattice gauge theory should open it and find something
   they would use in their own course.
2. **A small study.** Think-aloud sessions with 5–10 students on one lesson, or a pre/post
   concept test with a class whose teacher agrees. Even a small, honest study is publishable in
   education venues and is exactly what PER faculty look for.
3. **Write it up:**
   - Post on **arXiv (physics.ed-ph)**.
   - Then pick a venue:
     - **American Journal of Physics**: its Computational Physics section takes a proposal
       first, summarising the physics, the algorithm and why it suits advanced undergraduates
       ([AJP computational physics](https://aapt.org/Publications/AJP/Readers/computational_physics.cfm)).
     - **Physical Review PER**, **Physics Education**, or an education workshop at IEEE Quantum
       Week.
   - JOSS is a weaker fit unless the engine is packaged as reusable research software
     ([JOSS scope](https://joss.readthedocs.io/en/latest/)).
4. **Contact people with something specific.** Email a professor whose course matches a lesson:
   "Your QEC course covers the surface code; here is an interactive lesson that runs the
   decoder in the browser. Would it be useful for your students? I would value your
   criticism." Feedback leads to conversations, and conversations lead to recommendation letters.
5. **Be able to defend every line.** Interviews will probe the physics core: the stabilizer
   simulator, the decoder, the MPS code. AI assistance is fine for UI and plumbing, but own the
   physics, as `project-ideas.md` already says.
6. **Make it citable and visible:**
   - a DOI and `CITATION.cff`;
   - a short demo video for each flagship;
   - a changelog;
   - a "used in" list once a teacher adopts it.

---

## 7. Suggested order

1. **Phase 0** (polish, UI restructure, bugs, workers, citation).
2. **Phase 1, entanglement lesson and view**: the first research-grade visual, and a natural
   first arXiv note.
3. **Phase 2, error-correction track**, with the learning layer built alongside it. Run the
   small study on the surface-code lesson, then write the paper.
4. **Phase 4, fields track** (it reuses the stabilizer and Ising work, plus the Schwinger lab).
5. **Phase 3, QML track.**
6. Phase F and Phase 5 interleaved as smaller breaks.

Swap 3 and 4 if the master's target is QFT or many-body rather than quantum information. Swap in
QML first if the target groups are in QML.

**Not on the list, on purpose:**

- hundreds of shallow lessons;
- a Feynman-diagram game (it exists);
- a framework rewrite (the no-build site is an asset);
- any claim of quantum advantage.

---

## Sources

- Student use of a quantum simulation and visualization tool: [arXiv 2104.13260](https://arxiv.org/pdf/2104.13260)
- Eye-tracking study of an interactive QM tool: [arXiv 2302.06286](https://arxiv.org/pdf/2302.06286)
- Quantum games and interactive tools for outreach and education: [arXiv 2202.07756](https://arxiv.org/pdf/2202.07756)
- The quantum education ecosystem (review, 2026): [arXiv 2604.06293](https://arxiv.org/pdf/2604.06293)
- State-vector difference highlighting and the half-matrix (MuqcsCraft): [arXiv 2510.00895](https://arxiv.org/pdf/2510.00895)
- Qymera (notes on Quirk's limits): [arXiv 2506.08759](https://arxiv.org/pdf/2506.08759)
- Visualizing three-qubit states, local against nonlocal: [arXiv 2603.07942](https://arxiv.org/abs/2603.07942v2)
- Extending the Bloch sphere to N qubits: [arXiv 2607.04979](https://arxiv.org/pdf/2607.04979)
- Dimensional circle notation for entanglement: [arXiv 2305.07596](https://arxiv.org/abs/2305.07596v4)
- Quantum Machine Learning Playground: [arXiv 2507.17931](https://arxiv.org/abs/2507.17931v1)
- Mind the QApp (barren plateaus): [CERN Indico](https://indico.cern.ch/event/1433194/contributions/6279994)
- EQuaTE (barren-plateau visualization): [Ajou repository](https://aurora.ajou.ac.kr/handle/2018.oak/36951)
- Does provable absence of barren plateaus imply classical simulability?: [arXiv 2312.09121](https://arxiv.org/abs/2312.09121)
- Data re-uploading classifier: [arXiv 1907.02085](https://arxiv.org/pdf/1907.02085), [PennyLane demo](https://pennylane.ai/demos/tutorial_data_reuploading_classifier)
- Crumble: [algassert.com/crumble](https://algassert.com/crumble); Stim: [arXiv 2103.02202](https://arxiv.org/pdf/2103.02202)
- Willow below threshold: [APS Physics](https://physics.aps.org/articles/v17/176), [UCSB colloquium](https://www.physics.ucsb.edu/events/all/colloquium-willow-and-quantum-computing-below-surface-code-threshold)
- FeynCraft: [arXiv 2510.14082](https://arxiv.org/abs/2510.14082); GuiTeNet: [arXiv 1808.00532](https://arxiv.org/pdf/1808.00532)
- Tensor networks for lattice gauge theories: [Edinburgh colloquium](https://higgs.ph.ed.ac.uk/colloquia/applying-tensor-network-techniques-to-lattice-gauge-theories/)
- QuVis research-based simulations: [St Andrews](https://research-portal.st-andrews.ac.uk/en/publications/research-based-interactive-simulations-to-support-quantum-mechani/)
- PhET activities database: [SERC](https://serc.carleton.edu/sp/library/phet/examples/example1.html); PhET accessibility: [IDRC](https://snow.idrc.ocadu.ca/articles/the-phet-interactive-simulations-project-working-to-increase-access-to-interactive-stem-simulations-part-2-of-2/)
- IBM Quantum Learning: [catalog](https://learning.quantum.ibm.com/catalog), [Quantum Diagonalization Algorithms](https://quantum.cloud.ibm.com/learning/en/courses/quantum-diagonalization-algorithms)
- AJP Computational Physics section: [AAPT](https://aapt.org/Publications/AJP/Readers/computational_physics.cfm); JOSS: [docs](https://joss.readthedocs.io/en/latest/)
