// Site chrome shared by every page: navigation with the topics menu, theme toggle, footer.
// Pages set <html data-root="../"> (path back to the site root) and data-page="<slug>".

import { SECTIONS, TOPICS } from '../lib/catalog.js';

const REPO = 'https://github.com/thinkiamparanoid2/quantum-physics-lab';
const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';

const root = document.documentElement.dataset.root ?? '';
const page = document.documentElement.dataset.page ?? '';

export const href = (slug) => `${root}${slug}/`;

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this page only.
  }
  window.dispatchEvent(new CustomEvent('themechange'));
}

function megaMenu() {
  return SECTIONS.map((s) => {
    const links = TOPICS.filter((t) => t.section === s.id)
      .map((t) =>
        t.status === 'live'
          ? `<a href="${href(t.slug)}"${t.slug === page ? ' aria-current="page"' : ''}>${t.title}</a>`
          : `<span class="soon-link">${t.title}<span class="tag">Soon</span></span>`,
      )
      .join('');
    return `<div><h3><span class="ket">${s.ket}</span>${s.title}</h3>${links}</div>`;
  }).join('');
}

function renderNav() {
  const nav = document.createElement('header');
  nav.className = 'site-nav';
  nav.innerHTML = `
    <div class="container nav-inner">
      <a class="brand" href="${root || './'}"><span class="brand-mark">|ψ⟩</span><span class="brand-name">Quantum Physics Lab</span></a>
      <nav class="nav-links" aria-label="Main">
        <button class="nav-menu-btn" type="button" aria-expanded="false" aria-controls="mega">Topics ▾</button>
        <a href="${href('sandbox')}"${page === 'sandbox' ? ' aria-current="page"' : ''}>Sandbox</a>
        <a href="${href('playground')}"${page === 'playground' ? ' aria-current="page"' : ''}>Playground</a>
        <a href="${root || './'}#teachers">For teachers</a>
      </nav>
      <div class="nav-actions">
        <button class="icon-btn theme-toggle" type="button"></button>
      </div>
    </div>
    <div class="mega" id="mega" hidden><div class="container mega-grid">${megaMenu()}</div></div>`;
  document.body.prepend(nav);

  const menuBtn = nav.querySelector('.nav-menu-btn');
  const mega = nav.querySelector('.mega');
  const setMenu = (open) => {
    mega.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
  };
  menuBtn.addEventListener('click', () => setMenu(mega.hidden));
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) setMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !mega.hidden) {
      setMenu(false);
      menuBtn.focus();
    }
  });

  const toggle = nav.querySelector('.theme-toggle');
  const paint = () => {
    const light = currentTheme() === 'light';
    toggle.innerHTML = light ? MOON : SUN;
    toggle.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme (better on projectors)');
    toggle.title = toggle.getAttribute('aria-label');
  };
  toggle.addEventListener('click', () => {
    setTheme(currentTheme() === 'light' ? 'dark' : 'light');
    paint();
  });
  paint();
}

function renderFooter() {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="container footer-grid">
      <p>Every simulation runs on a classical computer, in your browser. At these sizes that is exact and instant.
         The point is to see what the mathematics does; real quantum hardware matters at scales far beyond this.</p>
      <div class="footer-links">
        <a href="${root || './'}#path">All topics</a>
        <a href="${REPO}">Source on GitHub</a>
      </div>
    </div>`;
  document.body.append(footer);
}

export function mountShell() {
  renderNav();
  renderFooter();
}

// Present mode: hides the page chrome and turns the current step into a large caption.
export function setupPresent(button, { onChange } = {}) {
  const exit = document.createElement('button');
  exit.className = 'btn present-exit';
  exit.type = 'button';
  exit.textContent = 'Exit presentation (Esc)';
  document.body.append(exit);

  const set = (on) => {
    document.body.classList.toggle('present', on);
    if (on) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onChange?.(on);
  };
  button.addEventListener('click', () => set(true));
  exit.addEventListener('click', () => set(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('present')) set(false);
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && document.body.classList.contains('present')) set(false);
  });
  return set;
}

export function shareButton(button) {
  const label = button.textContent;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      button.textContent = 'Link copied';
    } catch {
      button.textContent = 'Copy the address bar';
    }
    setTimeout(() => (button.textContent = label), 1800);
  });
}
