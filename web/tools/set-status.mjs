// Mark catalog topics live or soon: node web/tools/set-status.mjs live teleportation bb84
import { readFileSync, writeFileSync } from 'node:fs';

const [status, ...slugs] = process.argv.slice(2);
if (!['live', 'soon'].includes(status) || slugs.length === 0) {
  console.error('usage: node web/tools/set-status.mjs <live|soon> <slug> [slug...]');
  process.exit(1);
}
const file = new URL('../lib/catalog.js', import.meta.url);
let source = readFileSync(file, 'utf8');
for (const slug of slugs) {
  const re = new RegExp(`(slug: '${slug}',[\\s\\S]*?status: )'(live|soon)'`);
  if (!re.test(source)) throw new Error(`No catalog entry for "${slug}"`);
  source = source.replace(re, `$1'${status}'`);
  console.log(`${slug}: ${status}`);
}
writeFileSync(file, source);
