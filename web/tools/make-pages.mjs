// Writes index.html for every lesson that has an app.js, from the shared lesson frame and
// the catalog entry. Run after adding a lesson: node web/tools/make-pages.mjs
import { existsSync, writeFileSync } from 'node:fs';

import { TOPICS } from '../lib/catalog.js';

const CUSTOM_PAGES = new Set(['grover', 'playground', 'sandbox', 'schrodinger']);

const SITE = 'https://quantum-physics-lab.vercel.app/';

const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const page = (t) => `<!doctype html>
<html lang="en" data-root="../" data-page="${t.slug}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(t.title)}: Quantum Physics Lab</title>
  <meta name="description" content="${escape(t.summary)}">
  <link rel="canonical" href="${SITE}${t.slug}/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Quantum Physics Lab">
  <meta property="og:title" content="${escape(t.title)}: Quantum Physics Lab">
  <meta property="og:description" content="${escape(t.summary)}">
  <meta property="og:url" content="${SITE}${t.slug}/">
  <meta property="og:image" content="${SITE}og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Quantum Physics Lab: a qubit drawn on the Bloch sphere">
  <meta name="twitter:card" content="summary_large_image">
  <script>document.documentElement.classList.add('is-loading');try{document.documentElement.dataset.theme=localStorage.getItem('theme')||'dark'}catch(e){document.documentElement.dataset.theme='dark'}</script>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%238b7bff'/%3E%3Ctext x='16' y='21' font-family='monospace' font-size='13' font-weight='700' text-anchor='middle' fill='%23080915'%3E%7C%CF%88%E2%9F%A9%3C/text%3E%3C/svg%3E">
  <link rel="stylesheet" href="../styles/site.css">
  <link rel="modulepreload" href="../ui/lesson.js">
  <link rel="modulepreload" href="../ui/shell.js">
  <link rel="modulepreload" href="../lib/catalog.js">
  <link rel="modulepreload" href="../ui/charts.js">
</head>
<body>
  <main>
    <div class="container lesson-head" id="lesson-head"></div>
    <div class="container lesson-body">
      <aside class="guide" aria-label="Lesson steps">
        <div class="panel guide-card">
          <div class="progress-track"><div class="progress-fill"></div></div>
          <ol class="steps" id="steps"></ol>
          <div class="guide-nav">
            <span class="count" id="count"></span>
            <button id="back" class="btn" type="button">Back</button>
            <button id="next" class="btn btn-primary" type="button">Next</button>
          </div>
        </div>
        <div id="try-slot"></div>
      </aside>
      <section class="stage" id="stage" aria-label="Visualization">
        <div class="panel stage-caption" id="caption" aria-live="polite"></div>
      </section>
    </div>
    <div class="container next-lesson" id="next-lesson"></div>
  </main>
  <script type="module" src="app.js"></script>
</body>
</html>
`;

for (const t of TOPICS) {
  if (CUSTOM_PAGES.has(t.slug)) continue;
  const dir = new URL(`../${t.slug}/`, import.meta.url);
  if (!existsSync(new URL('app.js', dir))) continue;
  writeFileSync(new URL('index.html', dir), page(t));
  console.log(`wrote ${t.slug}/index.html`);
}
