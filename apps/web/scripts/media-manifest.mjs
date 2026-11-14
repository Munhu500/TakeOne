// Lists the files under public/media so <ProductImage> and <VideoFrame> know what footage has been supplied
// without probing the network. Run automatically from next.config.mjs.
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function writeMediaManifest(webRoot) {
  const dir = path.join(webRoot, 'public/media');
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else if (!f.startsWith('.')) files.push('/media/' + path.relative(dir, p).split(path.sep).join('/')); } };
  if (existsSync(dir)) walk(dir); else mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(webRoot, 'src/lib/media-manifest.json'), JSON.stringify(files.sort(), null, 2) + '\n');
}
