import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import test from 'node:test';

// The shared lesson frame (tools/make-pages.mjs) owns these ids. A lesson that reuses one gets the
// frame's element from getElementById, which has already broken two controls silently.
const FRAME_IDS = ['lesson-head', 'steps', 'count', 'back', 'next', 'try-slot', 'stage', 'caption', 'next-lesson'];

test('no lesson reuses an id owned by the lesson frame', () => {
  const root = new URL('../', import.meta.url);
  const clashes = [];
  for (const dir of readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const app = new URL(`${dir.name}/app.js`, root);
    if (!existsSync(app)) continue;
    const src = readFileSync(app, 'utf8');
    for (const id of FRAME_IDS) if (src.includes(`id="${id}"`)) clashes.push(`${dir.name}: id="${id}"`);
  }
  assert.deepEqual(clashes, [], `ids clash with the lesson frame:\n${clashes.join('\n')}`);
});

test('no lesson declares the same id twice', () => {
  const root = new URL('../', import.meta.url);
  const dupes = [];
  for (const dir of readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const app = new URL(`${dir.name}/app.js`, root);
    if (!existsSync(app)) continue;
    const ids = [...readFileSync(app, 'utf8').matchAll(/id="([\w-]+)"/g)].map((m) => m[1]);
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) dupes.push(`${dir.name}: ${id}`);
      seen.add(id);
    }
  }
  assert.deepEqual(dupes, [], `duplicate ids:\n${dupes.join('\n')}`);
});

test('every lesson has teaching notes with well-formed questions', async () => {
  const { TOPICS } = await import('../lib/catalog.js');
  const { teachingFor } = await import('../lib/teaching/index.js');
  const problems = [];
  for (const t of TOPICS) {
    if (t.section === 'tools' || t.status !== 'live') continue;
    const n = teachingFor(t.slug);
    if (!n) {
      problems.push(`${t.slug}: no teaching notes`);
      continue;
    }
    if (!n.goals?.length) problems.push(`${t.slug}: no goals`);
    if (!n.questions?.length) problems.push(`${t.slug}: no questions`);
    for (const [i, q] of (n.questions ?? []).entries()) {
      if (!(q.options?.length >= 2) || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length || !q.why) {
        problems.push(`${t.slug}: question ${i + 1} is malformed`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('the catalog is consistent with the pages on disk', async () => {
  const { SECTIONS, TOPICS } = await import('../lib/catalog.js');
  const sections = new Set(SECTIONS.map((s) => s.id));
  const slugs = new Set();
  const problems = [];
  for (const t of TOPICS) {
    if (!sections.has(t.section)) problems.push(`${t.slug}: unknown section ${t.section}`);
    if (slugs.has(t.slug)) problems.push(`${t.slug}: duplicate slug`);
    slugs.add(t.slug);
    if (t.status === 'live') {
      for (const f of ['app.js', 'index.html']) {
        if (!existsSync(new URL(`../${t.slug}/${f}`, import.meta.url))) problems.push(`${t.slug}: missing ${f}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('the checks page lists every test (run node web/tools/make-checks.mjs)', async () => {
  const { checksHtml } = await import('../tools/make-checks.mjs');
  const onDisk = readFileSync(new URL('../checks/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(onDisk, checksHtml(), 'web/checks/index.html is out of date');
});
