// A step-through circuit diagram (SVG). Each column is one block applied to every qubit;
// `position` is how many columns have been applied so far. Clicking a block calls
// onSelect(position after that block).

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent.appendChild(node);
  return node;
}

function text(parent, x, y, content, cls) {
  const t = el('text', { x, y, class: cls }, parent);
  t.textContent = content;
  return t;
}

export function circuitStrip(container, { n, columns, position, onSelect }) {
  container.textContent = '';
  const wireGap = 26;
  const top = 34;
  const left = 64;
  const colW = 72;
  const blockW = 58;
  const width = left + columns.length * colW + 20;
  const bottomWire = top + (n - 1) * wireGap;
  const height = bottomWire + 22;
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width, height, class: 'circuit' }, container);

  for (let q = 0; q < n; q++) {
    const y = top + q * wireGap;
    el('line', { x1: left - 26, y1: y, x2: width - 8, y2: y, class: 'wire' }, svg);
    text(svg, 4, y + 4, `q${q}`, 'wire-label');
    text(svg, left - 24, y + 4, '|0⟩', 'wire-label');
  }

  columns.forEach((c, i) => {
    const x = left + i * colW + (colW - blockW) / 2;
    const done = i < position;
    const current = i === position - 1;
    const g = el(
      'g',
      {
        class: `col ${c.kind}${done ? ' done' : ' todo'}${current ? ' current' : ''}`,
        tabindex: '0',
        role: 'button',
        'aria-label': `${c.title}${current ? ' (current step)' : ''}`,
      },
      svg,
    );
    if (c.kind === 'measure') {
      for (let q = 0; q < n; q++) {
        const y = top + q * wireGap;
        el('rect', { x: x + 8, y: y - 10, width: blockW - 16, height: 20, rx: 4 }, g);
        el('path', { d: `M${x + 16} ${y + 5} A 13 13 0 0 1 ${x + blockW - 16} ${y + 5}`, class: 'meter' }, g);
        el('line', { x1: x + blockW / 2, y1: y + 5, x2: x + blockW / 2 + 7, y2: y - 6, class: 'meter' }, g);
      }
    } else {
      el('rect', { x, y: top - 13, width: blockW, height: bottomWire - top + 26, rx: 6 }, g);
      text(g, x + blockW / 2, (top + bottomWire) / 2 + 4, c.label, 'block-label');
    }
    if (c.group && (i === 0 || columns[i - 1].group !== c.group)) {
      const span = columns.filter((d) => d.group === c.group).length;
      text(svg, left + i * colW + (span * colW) / 2, 13, c.group, 'group-label');
    }
    const select = () => onSelect(i + 1);
    g.addEventListener('click', select);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select();
      }
    });
  });

  const cx = left + position * colW;
  el('line', { x1: cx, y1: top - 20, x2: cx, y2: bottomWire + 18, class: 'cursor' }, svg);
  container.scrollLeft = Math.max(0, cx - container.clientWidth / 2);
}
