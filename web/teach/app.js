import { SECTIONS, topic, topicsIn, usedSections } from '../lib/catalog.js';
import { teachingFor } from '../lib/teaching/index.js';
import { bindQuiz, quizHtml } from '../ui/quiz.js';
import { href, mountShell } from '../ui/shell.js';

mountShell();

const $ = (id) => document.getElementById(id);
const withNotes = usedSections().flatMap((s) => topicsIn(s.id)).filter((t) => t.status === 'live' && teachingFor(t.slug));

function renderIndex(current) {
  $('teach-index').innerHTML = usedSections()
    .map((s) => {
      const items = topicsIn(s.id).filter((t) => withNotes.includes(t));
      if (!items.length) return '';
      return `<h3><span class="ket">${s.ket}</span>${s.title}</h3><ul>${items
        .map((t) => `<li><a href="#${t.slug}"${t.slug === current ? ' aria-current="page"' : ''}>${t.title}</a></li>`)
        .join('')}</ul>`;
    })
    .join('');
}

function renderNotes(slug) {
  const t = topic(slug);
  const n = teachingFor(slug);
  const section = SECTIONS.find((s) => s.id === t.section);
  const reveal = $('show-answers').checked;
  const list = (items) => `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  $('teach-notes').innerHTML = `
    <p class="eyebrow">${section.title}</p>
    <h2>${t.title}</h2>
    <p class="muted">${t.summary} <a class="no-print" href="${href(slug)}">Open the lesson →</a></p>
    <div class="teach-meta"><span class="tag live">${t.level}</span>${t.minutes ? `<span>${t.minutes} min</span>` : ''}</div>
    <h3>Learning goals</h3>${list(n.goals)}
    ${n.prereqs?.length ? `<h3>Before this lesson</h3>${list(n.prereqs)}` : ''}
    ${
      n.misconceptions?.length
        ? `<h3>Common misconceptions</h3><ul class="misconceptions">${n.misconceptions
            .map((m) => `<li><span class="wrong">“${m.wrong}”</span><span>${m.right}</span></li>`)
            .join('')}</ul>`
        : ''
    }
    <h3>Questions${reveal ? ' with answers' : ''}</h3>
    <ol class="quiz">${quizHtml(n.questions, { reveal, idPrefix: 'teach' })}</ol>`;
  bindQuiz($('teach-notes'), n.questions);
  document.title = `${t.title}: teacher notes · Quantum Physics Lab`;
}

function route() {
  const slug = location.hash.slice(1);
  const chosen = withNotes.find((t) => t.slug === slug) ?? withNotes[0];
  renderIndex(chosen.slug);
  renderNotes(chosen.slug);
}

$('show-answers').addEventListener('change', route);
$('print').addEventListener('click', () => window.print());
window.addEventListener('hashchange', () => {
  route();
  $('teach-notes').scrollIntoView({ block: 'start' });
});
route();
