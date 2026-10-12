import { TRACKS, topicsIn, trackOf, usedSections, usedTracks } from '../lib/catalog.js';
import { href, mountShell } from '../ui/shell.js';

mountShell();

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const $ = (id) => document.getElementById(id);
const state = { q: '', track: 'all', level: 'all' };

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  state.q = p.get('q') ?? '';
  state.track = TRACKS.some((t) => t.id === p.get('track')) ? p.get('track') : 'all';
  state.level = LEVELS.includes(p.get('level')) ? p.get('level') : 'all';
}

function writeHash() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.track !== 'all') p.set('track', state.track);
  if (state.level !== 'all') p.set('level', state.level);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
}

const chips = (items, current, key) =>
  [['all', 'All'], ...items].map(([id, label]) => `<button type="button" class="chip" data-${key}="${id}" aria-pressed="${id === current}">${label}</button>`).join('');

function card(t, index) {
  const live = t.status === 'live';
  const minutes = t.minutes ? `<span>${t.minutes} min</span>` : '';
  const body = `
    <span class="topic-num">${String(index + 1).padStart(2, '0')}</span>
    <svg class="topic-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="${t.icon}"/></svg>
    <h4>${t.title}</h4>
    <p>${t.summary}</p>
    <div class="meta"><span class="tag${live ? ' live' : ''}">${t.level}</span>${minutes}${live ? '' : '<span class="tag">Coming soon</span>'}</div>`;
  return live ? `<a class="topic-card" href="${href(t.slug)}">${body}</a>` : `<div class="topic-card soon" aria-disabled="true">${body}</div>`;
}

const matches = (t) => {
  if (state.level !== 'all' && t.level !== state.level) return false;
  if (state.track !== 'all' && trackOf(t.section)?.id !== state.track) return false;
  const q = state.q.trim().toLowerCase();
  return !q || `${t.title} ${t.summary} ${t.slug}`.toLowerCase().includes(q);
};

function render() {
  $('track-chips').innerHTML = chips(usedTracks().map((t) => [t.id, t.title]), state.track, 'track');
  $('level-chips').innerHTML = chips(LEVELS.map((l) => [l, l]), state.level, 'level');
  let shown = 0;
  const html = usedSections()
    .map((s) => {
      const all = topicsIn(s.id);
      const hits = all.filter(matches);
      shown += hits.length;
      if (!hits.length) return '';
      return `<div class="path-section">
        <div class="path-head"><span class="ket">${s.ket}</span><h3>${s.title}</h3><p>${s.blurb}</p></div>
        <div class="topic-grid compact">${hits.map((t) => card(t, all.indexOf(t))).join('')}</div>
      </div>`;
    })
    .join('');
  $('topic-results').innerHTML = shown ? html : '<p class="topics-empty">No topic matches. Try another word or clear the filters.</p>';
  writeHash();
}

$('topic-search').addEventListener('input', (e) => {
  state.q = e.target.value;
  render();
});
document.querySelector('.topics-tools').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  if (b.dataset.track) state.track = b.dataset.track;
  if (b.dataset.level) state.level = b.dataset.level;
  render();
});
window.addEventListener('hashchange', () => {
  readHash();
  $('topic-search').value = state.q;
  render();
});

readHash();
$('topic-search').value = state.q;
render();
