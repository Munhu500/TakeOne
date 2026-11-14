import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { writeMediaManifest } from './scripts/media-manifest.mjs';

// one .env at the repo root is shared by web, worker and scripts
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, '.env') });
writeMediaManifest(path.join(root, 'apps/web'));

// Static preview (Hostinger / plain Apache): `NEXT_PUBLIC_STATIC_PREVIEW=true next build`. Off by default, so the normal
// (Vercel) build is untouched. In preview mode only *.preview.tsx files are routes, and server-only modules are swapped
// for browser versions that talk to Supabase directly with the public anon key.
const PREVIEW = process.env.NEXT_PUBLIC_STATIC_PREVIEW === 'true';
const src = (p) => path.join(root, 'apps/web/src', p);
const SWAPS = [
  [/[\\/]src[\\/]lib[\\/]actions\.ts$/, src('lib/actions.preview.ts')],
  [/[\\/]src[\\/]lib[\\/]checkout\.ts$/, src('lib/checkout.preview.ts')],
  [/[\\/]src[\\/]lib[\\/]session\.ts$/, src('lib/session.preview.ts')],
  [/[\\/]src[\\/]lib[\\/]supabase-server\.ts$/, src('lib/supabase-server.preview.ts')],
  [/[\\/]src[\\/]lib[\\/]ai\.ts$/, src('lib/ai.preview.ts')],
  [/[\\/]src[\\/]components[\\/]invoice-link\.tsx$/, src('components/invoice-link.preview.tsx')],
  [/^next\/navigation$/, src('preview/navigation.ts')],
  [/^next\/link$/, src('preview/link.tsx')],
  [/^server-only$/, src('preview/empty.ts')],
];
const previewConfig = {
  output: 'export',
  distDir: 'out-preview',
  trailingSlash: true,
  images: { unoptimized: true },
  productionBrowserSourceMaps: false,
  pageExtensions: ['preview.tsx', 'preview.ts'],
  webpack(config, { webpack }) {
    for (const [from, to] of SWAPS) config.plugins.push(new webpack.NormalModuleReplacementPlugin(from, to));
    return config;
  },
};

/** @type {import('next').NextConfig} */
export default {
  ...(PREVIEW ? previewConfig : {}),
  transpilePackages: ['@takeone/shared', '@takeone/providers', '@takeone/design-tokens'],
  outputFileTracingRoot: root,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '',
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE ?? process.env.DEMO_MODE ?? 'true',
  },
  ...(PREVIEW ? {} : { experimental: { serverActions: { bodySizeLimit: '4mb' } } }),
};
