// A list of Pauli strings drawn as a table: one row per generator, one coloured cell per qubit.
// flipped: row indices whose sign changed (drawn highlighted), e.g. a syndrome.

export function stabilizerTableHtml(gens, { flipped = new Set(), labels = null, names = null } = {}) {
  if (!gens.length) return '<p class="hint">No generators.</p>';
  const n = gens[0].length - 1;
  const head = `<tr><th></th>${Array.from({ length: n }, (_, q) => `<th>${labels?.[q] ?? q}</th>`).join('')}</tr>`;
  const rows = gens
    .map((g, i) => {
      const sign = g[0] === '−' ? '−' : '+';
      const cells = [...g.slice(1)].map((p) => `<td class="pauli p-${p}">${p === 'I' ? '·' : p}</td>`).join('');
      return `<tr class="${flipped.has(i) ? 'flipped' : ''}"><th class="sign">${names?.[i] ? `<span class="gen-name">${names[i]}</span>` : ''}${sign}</th>${cells}</tr>`;
    })
    .join('');
  return `<div class="table-scroll"><table class="stab-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
}
