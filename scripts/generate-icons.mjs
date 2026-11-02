#!/usr/bin/env node
/**
 * Renders every app icon, splash and PWA image from the hand-authored mark
 * at assets/brand/logo-mark.svg.
 *
 *   npm run icons
 *
 * Outputs are committed so builds never need to run this. Re-run it after
 * changing the mark or the background colours below.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brand = path.join(root, 'assets/brand');
const publicIcons = path.join(root, 'public/icons');

// The brand blue background (top to bottom). Keep in sync with app.json.
const BG_TOP = '#3B82F6';
const BG_BOTTOM = '#1D4ED8';

const markSvg = await readFile(path.join(brand, 'logo-mark.svg'), 'utf8');
const markInner = markSvg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/** Wraps the mark, scaled about the centre, optionally on the brand blue. */
function compose({ scale = 1, background = true }) {
  const offset = (1024 * (1 - scale)) / 2;
  const bg = background
    ? `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0" stop-color="${BG_TOP}"/><stop offset="1" stop-color="${BG_BOTTOM}"/>
       </linearGradient></defs><rect width="1024" height="1024" fill="url(#bg)"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    ${bg}<g transform="translate(${offset} ${offset}) scale(${scale})">${markInner}</g></svg>`;
}

const bgOnly = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${BG_TOP}"/><stop offset="1" stop-color="${BG_BOTTOM}"/>
  </linearGradient></defs><rect width="1024" height="1024" fill="url(#bg)"/></svg>`;

const render = (svg, size) => sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png();

/** A single-colour silhouette of the mark (Android themed icons). */
async function monochrome(svg, size) {
  const alpha = await render(svg, size).extractChannel('alpha').toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: '#FFFFFF' } })
    .joinChannel(alpha)
    .png();
}

const fullIcon = compose({ scale: 0.92 });
// Android adaptive icons crop to a circle/squircle within the central 66%.
const adaptiveFg = compose({ scale: 0.62, background: false });
// PWA maskable icons keep content inside the central 80% circle.
const maskable = compose({ scale: 0.72 });
const splashMark = compose({ scale: 1, background: false });

const outputs = [
  // Native app icon (iOS uses it as-is; it must have no transparency).
  ['assets/brand/icon.png', () => render(fullIcon, 1024).flatten({ background: BG_BOTTOM })],
  ['assets/brand/adaptive-foreground.png', () => render(adaptiveFg, 1024)],
  ['assets/brand/adaptive-background.png', () => render(bgOnly, 1024)],
  ['assets/brand/adaptive-monochrome.png', () => monochrome(adaptiveFg, 1024)],
  ['assets/brand/splash-icon.png', () => render(splashMark, 512)],
  // Used in-app (header, onboarding).
  ['assets/brand/logo-mark.png', () => render(splashMark, 512)],
  // Web
  ['assets/brand/favicon.png', () => render(fullIcon, 48)],
  ['public/icons/icon-192.png', () => render(fullIcon, 192)],
  ['public/icons/icon-512.png', () => render(fullIcon, 512)],
  ['public/icons/maskable-512.png', () => render(maskable, 512)],
  [
    'public/icons/apple-touch-icon.png',
    () => render(fullIcon, 180).flatten({ background: BG_BOTTOM }),
  ],
];

await mkdir(publicIcons, { recursive: true });
await writeFile(path.join(brand, 'logo-icon.svg'), fullIcon.trim() + '\n');
for (const [file, make] of outputs) {
  const img = await make();
  await img.toFile(path.join(root, file));
  console.log('wrote', file);
}
