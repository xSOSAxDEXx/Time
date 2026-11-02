#!/usr/bin/env node
/**
 * Renders every app icon, splash and PWA image from the logo artwork at
 * assets/brand/logo-source.jpg (square, at least 1024 px).
 *
 *   npm run icons
 *
 * Outputs are committed so builds never need to run this. Re-run it after
 * replacing the artwork.
 */
import { Buffer } from 'node:buffer';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'assets/brand/logo-source.jpg');

// The brand blue behind the artwork. Keep in sync with app.json.
const BG = '#1D4ED8';

// Palette PNGs keep the committed icons small with no visible loss.
const PNG = { palette: true, quality: 95, compressionLevel: 9, effort: 10 };

/** The artwork, square, at `size` px. */
const art = (size) => sharp(source).resize(size, size, { fit: 'cover' });

/** The artwork with rounded corners (for places that don't round it for us). */
async function rounded(size, radiusRatio = 0.22) {
  const r = Math.round(size * radiusRatio);
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`,
  );
  const img = await art(size).png().toBuffer();
  return sharp(img)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png(PNG);
}

/**
 * The artwork shrunk to `scale` of the canvas, with its edges mirrored out to
 * fill the rest. Used where the platform crops to a circle or squircle
 * (Android adaptive icons, PWA maskable icons) so the knuckles stay in view.
 */
async function padded(size, scale) {
  const inner = Math.round(size * scale);
  const pad = Math.floor((size - inner) / 2);
  const buf = await art(inner).png().toBuffer();
  return sharp(buf)
    .extend({
      top: pad,
      left: pad,
      bottom: size - inner - pad,
      right: size - inner - pad,
      extendWith: 'mirror',
    })
    .png(PNG);
}

const outputs = [
  // Native app icon (iOS rounds it itself; it must have no transparency).
  ['assets/brand/icon.png', () => art(1024).png(PNG)],
  // Android shows the central 66% of the adaptive icon.
  ['assets/brand/adaptive-foreground.png', () => padded(1024, 0.7)],
  ['assets/brand/splash-icon.png', () => rounded(512)],
  // Used in-app (Week screen header).
  ['assets/brand/logo-mark.png', () => rounded(256)],
  // Web
  ['assets/brand/favicon.png', () => rounded(48)],
  ['public/icons/icon-192.png', () => rounded(192)],
  ['public/icons/icon-512.png', () => rounded(512)],
  // Maskable icons keep content inside the central 80% circle.
  ['public/icons/maskable-512.png', () => padded(512, 0.86)],
  ['public/icons/apple-touch-icon.png', () => art(180).flatten({ background: BG }).png(PNG)],
];

await mkdir(path.join(root, 'public/icons'), { recursive: true });
for (const [file, make] of outputs) {
  const img = await make();
  await img.toFile(path.join(root, file));
  console.log('wrote', file);
}
