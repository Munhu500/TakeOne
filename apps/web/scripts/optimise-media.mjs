// Writes .avif and .webp copies beside every .jpg/.png under public/media (skipping ones that already exist).
// The site always prefers the smallest format present. Run after adding images: pnpm --filter @takeone/web media
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/media');
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(jpe?g|png)$/i.test(f)) files.push(p); } })(dir);
let made = 0;
for (const file of files) {
  const base = file.replace(/\.(jpe?g|png)$/i, '');
  // posters never need more than 1080px on the long edge of a phone frame
  const img = () => sharp(file).resize({ width: 1080, height: 1920, fit: 'inside', withoutEnlargement: true });
  if (!existsSync(`${base}.avif`)) { await img().avif({ quality: 55 }).toFile(`${base}.avif`); made++; }
  if (!existsSync(`${base}.webp`)) { await img().webp({ quality: 72 }).toFile(`${base}.webp`); made++; }
}
console.log(`${files.length} source image(s), ${made} optimised file(s) written`);
