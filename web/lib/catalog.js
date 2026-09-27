// The site's table of contents. Navigation, the landing page and "next lesson" links all
// read from here, so adding a topic means adding one entry.

export const SECTIONS = [
  {
    id: 'foundations',
    ket: '|00⟩',
    title: 'Foundations',
    blurb: 'What a qubit is, and the three ideas everything else builds on: superposition, interference and entanglement.',
  },
  {
    id: 'protocols',
    ket: '|01⟩',
    title: 'Protocols',
    blurb: 'Using entanglement to move and protect information in ways classical physics cannot.',
  },
  {
    id: 'algorithms',
    ket: '|10⟩',
    title: 'Algorithms',
    blurb: 'Where the speedups come from, one algorithm at a time.',
  },
  {
    id: 'tools',
    ket: '|11⟩',
    title: 'Tools',
    blurb: 'Open-ended spaces to build circuits and simulate physics yourself.',
  },
];

// Icons are SVG path data drawn in a 48x48 box with round strokes.
export const TOPICS = [
  {
    slug: 'qubit',
    section: 'foundations',
    title: 'The qubit',
    summary: 'Superposition, and every gate as a rotation of an arrow on the Bloch sphere.',
    level: 'Beginner',
    minutes: 8,
    status: 'live',
    icon: 'M24 7a17 17 0 1 0 0.01 0 M7 24c0 4 7.6 7 17 7s17-3 17-7 M24 24 L33 12',
  },
  {
    slug: 'measurement',
    section: 'foundations',
    title: 'Measurement',
    summary: 'Why outcomes are random, how likely each one is, and what measuring does to the state.',
    level: 'Beginner',
    minutes: 6,
    status: 'live',
    icon: 'M8 34a16 16 0 0 1 32 0 M24 34 L32 20 M6 38 H42',
  },
  {
    slug: 'interference',
    section: 'foundations',
    title: 'Interference and phase',
    summary: 'Amplitudes are arrows: they add up or cancel, and that is where quantum advantage starts.',
    level: 'Beginner',
    minutes: 8,
    status: 'live',
    icon: 'M4 24c4-10 8-10 12 0s8 10 12 0 8-10 12 0 M4 24c4 10 8 10 12 0',
  },
  {
    slug: 'entanglement',
    section: 'foundations',
    title: 'Entanglement',
    summary: 'Two qubits sharing one state: Bell pairs, and outcomes that always agree.',
    level: 'Beginner',
    minutes: 8,
    status: 'live',
    icon: 'M14 16a8 8 0 1 0 0.01 0 M34 16a8 8 0 1 0 0.01 0 M20 29 C24 34 24 34 28 29',
  },
  {
    slug: 'teleportation',
    section: 'protocols',
    title: 'Quantum teleportation',
    summary: 'Send an unknown qubit using one Bell pair and two classical bits.',
    level: 'Intermediate',
    minutes: 10,
    status: 'live',
    icon: 'M10 24a6 6 0 1 0 0.01 0 M38 24a6 6 0 1 0 0.01 0 M18 24 H30 M26 20 L30 24 L26 28',
  },
  {
    slug: 'superdense-coding',
    section: 'protocols',
    title: 'Superdense coding',
    summary: 'Send two classical bits by sending one qubit, with a shared Bell pair.',
    level: 'Intermediate',
    minutes: 7,
    status: 'live',
    icon: 'M8 16 H22 M8 24 H22 M22 20 H40 M36 16 L40 20 L36 24 M8 32 H22',
  },
  {
    slug: 'bb84',
    section: 'protocols',
    title: 'BB84 key distribution',
    summary: 'Share a secret key, and catch any eavesdropper by the errors they leave behind.',
    level: 'Intermediate',
    minutes: 10,
    status: 'live',
    icon: 'M14 22 V16 a10 10 0 0 1 20 0 V22 M10 22 H38 V40 H10 Z M24 29 V33',
  },
  {
    slug: 'deutsch-jozsa',
    section: 'algorithms',
    title: 'Deutsch–Jozsa',
    summary: 'Decide whether a function is constant or balanced with a single question.',
    level: 'Intermediate',
    minutes: 8,
    status: 'live',
    icon: 'M8 12 H40 M8 24 H18 M30 24 H40 M18 18 H30 V30 H18 Z M8 36 H40',
  },
  {
    slug: 'bernstein-vazirani',
    section: 'algorithms',
    title: 'Bernstein–Vazirani',
    summary: 'Read out a hidden string of bits in one query instead of one per bit.',
    level: 'Intermediate',
    minutes: 7,
    status: 'live',
    icon: 'M8 14 H16 M20 14 H28 M32 14 H40 M8 24 H40 M12 32 V38 M24 32 V38 M36 32 V38',
  },
  {
    slug: 'grover',
    section: 'algorithms',
    title: "Grover's search",
    summary: "Watch the marked answer's amplitude grow, one reflection at a time.",
    level: 'Intermediate',
    minutes: 10,
    status: 'live',
    icon: 'M8 40 V34 M14 40 V34 M20 40 V34 M26 40 V10 M32 40 V34 M38 40 V34',
  },
  {
    slug: 'qft',
    section: 'algorithms',
    title: 'Quantum Fourier transform',
    summary: 'Turn a number into a pattern of phases: clock hands spinning at different speeds.',
    level: 'Advanced',
    minutes: 10,
    status: 'live',
    icon: 'M24 8a16 16 0 1 0 0.01 0 M24 24 L24 12 M24 24 L33 28',
  },
  {
    slug: 'phase-estimation',
    section: 'algorithms',
    title: 'Phase estimation',
    summary: 'Measure an unknown phase to many bits of precision: the engine inside Shor.',
    level: 'Advanced',
    minutes: 10,
    status: 'live',
    icon: 'M6 38 L14 30 L20 34 L26 12 L32 34 L38 30 L42 34',
  },
  {
    slug: 'shor',
    section: 'algorithms',
    title: "Shor's algorithm",
    summary: 'Factor 15 by finding the period of a function with quantum interference.',
    level: 'Advanced',
    minutes: 12,
    status: 'live',
    icon: 'M10 38 V22 M18 38 V10 M26 38 V22 M34 38 V10 M42 38 V22 M6 38 H44',
  },
  {
    slug: 'sandbox',
    section: 'tools',
    title: 'Circuit sandbox',
    summary: 'Drag gates onto wires and watch the state change live.',
    level: 'All levels',
    minutes: null,
    status: 'soon',
    icon: 'M6 14 H42 M6 24 H42 M6 34 H42 M14 9 H24 V19 H14 Z M30 24 a3 3 0 1 0 0.01 0 M30 24 V34 M30 34 a4 4 0 1 0 0.01 0',
  },
  {
    slug: 'playground',
    section: 'tools',
    title: 'Hamiltonian Playground',
    summary: 'Type any Hamiltonian and watch it evolve, next to the circuit a quantum computer would run.',
    level: 'Advanced',
    minutes: null,
    status: 'live',
    icon: 'M4 30 C10 10, 16 10, 22 26 S34 40, 44 16',
  },
];

export function topic(slug) {
  return TOPICS.find((t) => t.slug === slug);
}

// The next live topic after `slug`, in site order, or null.
export function nextTopic(slug) {
  const i = TOPICS.findIndex((t) => t.slug === slug);
  return TOPICS.slice(i + 1).find((t) => t.status === 'live') ?? null;
}

export function lessonNumber(slug) {
  const t = topic(slug);
  return TOPICS.filter((x) => x.section === t.section).findIndex((x) => x.slug === slug) + 1;
}
