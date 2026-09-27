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
