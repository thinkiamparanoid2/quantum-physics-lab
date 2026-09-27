// The frame every lesson page shares: title block, numbered steps with explanations,
// back/next controls, progress bar, Present mode caption and the "next lesson" link.
// The page owns the step index; it calls render(steps, index) whenever either changes
// and receives navigation requests through onNavigate(index).

import { SECTIONS, lessonNumber, nextTopic, topic } from '../lib/catalog.js';
import { href, mountShell, setupPresent, shareButton } from './shell.js';

export function mountLesson({ slug, onNavigate, sandbox = false }) {
  mountShell();
  const t = topic(slug);
  const section = SECTIONS.find((s) => s.id === t.section);
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
      <button id="share" class="btn" type="button">Copy link</button>
    </div>`;

  const next = nextTopic(slug);
  const nextBox = $('next-lesson');
  if (next && nextBox) {
    nextBox.innerHTML = `<a href="${href(next.slug)}"><span>Next lesson</span><b>${next.title} →</b></a>`;
  }

  setupPresent($('present'), { onChange: () => window.dispatchEvent(new Event('resize')) });
  shareButton($('share'));

  const list = $('steps');
  const count = $('count');
  const fill = document.querySelector('.progress-fill');
  const back = $('back');
  const forward = $('next');
  const caption = $('caption');
  let current = 0;
  let total = 0;
  let titlesKey = '';

  const go = (i) => {
    if (i >= 0 && i < total && i !== current) onNavigate(i);
  };
  back.addEventListener('click', () => go(current - 1));
  forward.addEventListener('click', () => go(current + 1));
  list.addEventListener('click', (e) => {
    const item = e.target.closest('[data-step]');
    if (item) go(Number(item.dataset.step));
  });
  caption?.addEventListener('click', (e) => {
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

  function render(steps, index) {
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
    list.querySelectorAll('.step').forEach((li, i) => {
      li.classList.toggle('current', i === index);
      li.classList.toggle('done', i < index);
      const head = li.querySelector('.step-head');
      if (i === index) head.setAttribute('aria-current', 'step');
      else head.removeAttribute('aria-current');
      const text = li.querySelector('.step-text');
      const html = i === index ? steps[i].html : '';
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
      const html = `<div class="caption-text"><h2>${steps[index].title}</h2>${steps[index].html}</div>
        <div class="caption-nav"><button class="btn" type="button" data-nav="-1"${index === 0 ? ' disabled' : ''}>Back</button>
        <button class="btn btn-primary" type="button" data-nav="1"${index === total - 1 ? ' disabled' : ''}>Next</button></div>`;
      if (caption.dataset.html !== html) {
        caption.dataset.html = html;
        caption.innerHTML = html;
      }
    }
  }

  return { render };
}
