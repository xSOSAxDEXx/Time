#!/usr/bin/env node
/**
 * Runs after `expo export --platform web` (see `npm run build:web`).
 *
 * - Fills the service worker's precache list with every file in the export
 *   (JS, fonts and images) and stamps it with a content hash, so
 *   the installed web app works offline and updates cleanly.
 * - When EXPO_BASE_URL is set (e.g. "/Time" for GitHub Pages), points the
 *   hand-written links in index.html at that sub-path.
 * - Writes 404.html (a copy of the app) so GitHub Pages serves the app for
 *   deep links like /Time/day/2026-11-02.
 */
import { createHash } from 'node:crypto';
import { copyFile, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
const SKIP = new Set(['sw.js', 'metadata.json', '404.html', '.nojekyll']);

// 1. index.html links written by hand in public/index.html.
const indexPath = path.join(dist, 'index.html');
let index = await readFile(indexPath, 'utf8');
if (base) {
  index = index
    .replaceAll('href="/manifest.webmanifest"', `href="${base}/manifest.webmanifest"`)
    .replaceAll('href="/icons/', `href="${base}/icons/`);
  await writeFile(indexPath, index);
}

// 2. Precache list, relative to the service worker's scope.
async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name);
    if ((await stat(full)).isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const files = (await walk(dist))
  .map((f) => path.relative(dist, f).split(path.sep).join('/'))
  .filter((f) => !SKIP.has(f) && !f.endsWith('.map'))
  .map((f) => (f === 'index.html' ? '' : f))
  .sort();

const hash = createHash('sha256');
for (const f of files) {
  hash.update(f);
  hash.update(await readFile(path.join(dist, f || 'index.html')));
}
const version = hash.digest('hex').slice(0, 12);

const swPath = path.join(dist, 'sw.js');
let sw = await readFile(swPath, 'utf8');
if (!sw.includes('__CLOCKED_VERSION__') || !sw.includes('/* __CLOCKED_PRECACHE__ */ []')) {
  throw new Error('dist/sw.js is missing its build placeholders');
}
sw = sw
  .replace('__CLOCKED_VERSION__', version)
  .replace('/* __CLOCKED_PRECACHE__ */ []', JSON.stringify(files, null, 2));
await writeFile(swPath, sw);

// 3. GitHub Pages: deep links fall back to the app; don't run Jekyll.
await copyFile(indexPath, path.join(dist, '404.html'));
await writeFile(path.join(dist, '.nojekyll'), '');

console.log(`web build: base "${base || '/'}", service worker ${version}, ${files.length} files`);
