// The frame every lesson page shares: title block, numbered steps with explanations,
// back/next controls, progress bar, Present mode caption and the "next lesson" link.
// The page owns the step index; it calls render(steps, index) whenever either changes
// and receives navigation requests through onNavigate(index).
//
// A step is { title, html, focus?, math?, predict? }:
//   focus    card titles to keep open on this step; the other cards on the stage fold away
//   math     HTML for a collapsible "Show the maths" panel under the explanation
//   predict  { q, options: [...], answer, why }: asked before moving on (predict, then observe)
// Every card (figure.card with a .card-head h2) can be folded by its reader; that choice is
// remembered per lesson and wins over a step's focus. A card with data-default-folded="true"
// starts folded (used for optional views).

import { SECTIONS, lessonNumber, nextTopic, topic } from '../lib/catalog.js';
import { teachingFor } from '../lib/teaching/index.js';
import { bindQuiz, quizHtml } from './quiz.js';
import { href, mountShell, setupPresent, shareButton } from './shell.js';

const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

function readStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this page only.
  }
}

function predictHtml(p, chosen) {
  const options = p.options
    .map((o, k) => {
      let cls = 'quiz-option';
      if (chosen !== undefined) {
        if (k === p.answer) cls += ' correct';
        if (k === chosen) cls += ` chosen${k === p.answer ? '' : ' wrong'}`;
      }
      return `<button type="button" class="${cls}" data-predict="${k}"><b>${'ABCDEF'[k]}</b><span>${o}</span></button>`;
    })
    .join('');
  const after =
    chosen === undefined
      ? '<p class="predict-hint">Commit to an answer, then press Next and see.</p>'
      : `<p class="quiz-why">${chosen === p.answer ? 'Right.' : 'Not quite.'} ${p.why}</p>`;
  return `<div class="predict"><p class="predict-q"><span class="predict-tag">Predict</span>${p.q}</p>
    <div class="quiz-options">${options}</div>${after}</div>`;
}

export function mountLesson({ slug, onNavigate, sandbox = false }) {
  mountShell();
  const t = topic(slug);
  const section = SECTIONS.find((s) => s.id === t.section);
  const teaching = teachingFor(slug);
  const $ = (id) => document.getElementById(id);

  $('lesson-head').innerHTML = `
    <div>
      <p class="eyebrow">${section.title} · Lesson ${lessonNumber(slug)}</p>
      <h1>${t.title}</h1>
      <p class="lede">${t.summary}</p>
    </div>
    <div class="lesson-actions">
      <button id="present" class="btn" type="button" title="Full screen with large captions (Esc to exit)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>Present</button>
      ${sandbox ? `<a id="open-sandbox" class="btn" href="${href('sandbox')}" hidden title="Edit this circuit yourself">Open in sandbox</a>` : ''}
      ${teaching ? `<a class="btn" href="${href('teach')}#${slug}" title="Goals, misconceptions and questions for this lesson">Teacher notes</a>` : ''}
      <button id="share" class="btn" type="button">Copy link</button>
    </div>`;

  const next = nextTopic(slug);
  const nextBox = $('next-lesson');
  if (teaching?.questions?.length && nextBox) {
    const quiz = document.createElement('section');
    quiz.className = 'container check-yourself';
    quiz.setAttribute('aria-labelledby', 'check-title');
    quiz.innerHTML = `<div class="panel check-panel">
        <div class="check-head"><h2 id="check-title">Check yourself</h2>
          <span class="muted">${teaching.questions.length} questions · <span class="check-score"></span></span></div>
        <ol class="quiz">${quizHtml(teaching.questions, { idPrefix: 'check' })}</ol>
      </div>`;
    nextBox.before(quiz);
    const score = quiz.querySelector('.check-score');
    const results = new Map();
    const paint = () => {
      const right = [...results.values()].filter(Boolean).length;
      score.textContent = results.size ? `${right} of ${results.size} right so far` : 'answer to see the explanation';
    };
    paint();
    bindQuiz(quiz, teaching.questions, (i, ok) => {
      results.set(i, ok);
      paint();
    });
  }
  if (next && nextBox) {
    nextBox.innerHTML = `<a href="${href(next.slug)}"><span>Next lesson</span><b>${next.title} →</b></a>`;
  }

  setupPresent($('present'), { onChange: () => window.dispatchEvent(new Event('resize')) });
  shareButton($('share'));

  // ----- foldable cards -----
  const stage = $('stage');
  const storeKey = `qpl:folded:${slug}`;
  const manual = new Map(Object.entries(readStore(storeKey, {})));
  let focus = null;
  const cardKey = (card) => card.querySelector('.card-head h2')?.textContent.trim() ?? '';
  const applyFold = (card) => {
    const key = card.dataset.cardKey;
    const folded = manual.has(key) ? manual.get(key) : focus ? !focus.includes(key) : card.dataset.defaultFolded === 'true';
    if (card.classList.contains('folded') !== folded) {
      card.classList.toggle('folded', folded);
      card.querySelector('.card-toggle')?.setAttribute('aria-expanded', String(!folded));
    }
  };
  const enhance = () => {
    for (const card of stage.querySelectorAll('.card')) {
      if (card.dataset.cardKey !== undefined) continue;
      const head = card.querySelector('.card-head');
      if (!head) continue;
      card.dataset.cardKey = cardKey(card);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'card-toggle';
      toggle.setAttribute('aria-expanded', 'true');
      toggle.title = 'Fold or unfold this view';
      toggle.innerHTML = `${CHEVRON}<span class="visually-hidden">Fold ${card.dataset.cardKey}</span>`;
      head.prepend(toggle);
      applyFold(card);
    }
  };
  stage.addEventListener('click', (e) => {
    const toggle = e.target.closest('.card-toggle');
    if (!toggle) return;
    const card = toggle.closest('.card');
    manual.set(card.dataset.cardKey, !card.classList.contains('folded'));
    writeStore(storeKey, Object.fromEntries(manual));
    applyFold(card);
  });
  new MutationObserver(enhance).observe(stage, { childList: true, subtree: true });
  enhance();

  const list = $('steps');
  const count = $('count');
  const fill = document.querySelector('.progress-fill');
  const back = $('back');
  const forward = $('next');
  const caption = $('caption');
  let current = 0;
  let total = 0;
  let titlesKey = '';
  let lastSteps = [];
  const predictions = new Map();

  const go = (i) => {
    if (i >= 0 && i < total && i !== current) onNavigate(i);
  };
  back.addEventListener('click', () => go(current - 1));
  forward.addEventListener('click', () => go(current + 1));
  const onPredict = (e) => {
    const b = e.target.closest('[data-predict]');
    if (!b) return false;
    predictions.set(current, Number(b.dataset.predict));
    render(lastSteps, current);
    return true;
  };
  list.addEventListener('click', (e) => {
    if (onPredict(e)) return;
    const item = e.target.closest('[data-step]');
    if (item) go(Number(item.dataset.step));
  });
  caption?.addEventListener('click', (e) => {
    if (onPredict(e)) return;
    const b = e.target.closest('[data-nav]');
    if (b) go(current + Number(b.dataset.nav));
  });
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const moves = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 };
    if (e.key in moves) {
      e.preventDefault();
      go(current + moves[e.key]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      go(0);
    }
  });

  function stepBody(step, i) {
    let html = step.html ?? '';
    if (step.math) html += `<details class="step-math"><summary>Show the maths</summary><div>${step.math}</div></details>`;
    if (step.predict) html += predictHtml(step.predict, predictions.get(i));
    return html;
  }

  function render(steps, index) {
    lastSteps = steps;
    current = index;
    total = steps.length;
    const key = steps.map((s) => s.title).join('\u0000');
    if (key !== titlesKey) {
      titlesKey = key;
      list.innerHTML = steps
        .map(
          (s, i) => `<li class="step" data-index="${i}">
            <button class="step-head" type="button" data-step="${i}"><span class="step-num">${i + 1}</span><span>${s.title}</span></button>
            <div class="step-text"></div></li>`,
        )
        .join('');
    }
    const body = stepBody(steps[index], index);
    list.querySelectorAll('.step').forEach((li, i) => {
      li.classList.toggle('current', i === index);
      li.classList.toggle('done', i < index);
      const head = li.querySelector('.step-head');
      if (i === index) head.setAttribute('aria-current', 'step');
      else head.removeAttribute('aria-current');
      const text = li.querySelector('.step-text');
      const html = i === index ? body : '';
      if (text.dataset.html !== html) {
        text.dataset.html = html;
        text.innerHTML = html;
      }
    });
    const currentItem = list.querySelector('.step.current');
    if (currentItem) {
      const top = currentItem.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top > list.scrollTop + list.clientHeight - 60) list.scrollTop = Math.max(0, top - 20);
    }
    count.textContent = `Step ${index + 1} of ${total}`;
    fill.style.width = `${((index + 1) / total) * 100}%`;
    back.disabled = index === 0;
    forward.disabled = index === total - 1;
    if (caption) {
      const html = `<div class="caption-text"><h2>${steps[index].title}</h2>${body}</div>
        <div class="caption-nav"><button class="btn" type="button" data-nav="-1"${index === 0 ? ' disabled' : ''}>Back</button>
        <button class="btn btn-primary" type="button" data-nav="1"${index === total - 1 ? ' disabled' : ''}>Next</button></div>`;
      if (caption.dataset.html !== html) {
        caption.dataset.html = html;
        caption.innerHTML = html;
      }
    }
    const nextFocus = steps[index].focus ?? null;
    if (String(nextFocus) !== String(focus)) {
      focus = nextFocus;
      stage.querySelectorAll('.card[data-card-key]').forEach(applyFold);
    }
  }

  return { render };
}
