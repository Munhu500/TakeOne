#!/usr/bin/env bash
# Builds a static preview for plain Apache hosting (e.g. Hostinger shared hosting): preview-dist/ + takeone-preview.zip.
# Everything runs in the browser against Supabase with the public anon key. The normal builds are not affected.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[ -f .env ] && { set -a; . ./.env; set +a; }
: "${SUPABASE_URL:?Set SUPABASE_URL (repo-root .env)}"; : "${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY (repo-root .env)}"
OUT="$ROOT/preview-dist"; ZIP="$ROOT/takeone-preview.zip"

echo "1/6 Next.js static export (preview flag on)"
(cd apps/web && rm -rf out-preview && NEXT_PUBLIC_STATIC_PREVIEW=true NEXT_PUBLIC_DEMO_MODE=true DEMO_MODE=true NODE_NO_WARNINGS=1 \
  NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" pnpm exec next build >/dev/null)

echo "2/6 Expo web export for /app"
(cd apps/mobile && rm -rf dist-preview && EXPO_PUBLIC_STATIC_PREVIEW=true EXPO_PUBLIC_DEMO_MODE=true DEMO_MODE=true EXPO_NO_TELEMETRY=1 CI=1 \
  EXPO_PUBLIC_SUPABASE_URL="$SUPABASE_URL" EXPO_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" EXPO_PUBLIC_WEB_URL="" pnpm exec expo export --platform web --output-dir dist-preview >/dev/null 2>&1)

echo "3/6 Assemble preview-dist/"
rm -rf "$OUT" "$ZIP"; mkdir -p "$OUT/app"
cp -R apps/web/out-preview/. "$OUT/"
cp -R apps/mobile/dist-preview/. "$OUT/app/"
rm -f "$OUT/app/metadata.json"
find "$OUT" -name "*.map" -delete   # no source maps in the preview

echo "4/6 Banner + .htaccess"
# The Next pages render the banner themselves (layout.preview.tsx). The creator app gets the same pill injected into its shell.
BANNER='<div role="note" style="position:fixed;right:12px;bottom:76px;z-index:99999;pointer-events:none;font:500 11px/1 Inter,system-ui,sans-serif;color:#FBBF24;background:rgba(0,0,0,.85);border:1px solid rgba(251,191,36,.4);border-radius:999px;padding:6px 10px">Preview build — demo data</div>'
python3 - "$OUT/app/index.html" "$BANNER" <<'PY'
import sys
p, banner = sys.argv[1], sys.argv[2]
s = open(p, encoding='utf-8').read()
assert '</body>' in s
open(p, 'w', encoding='utf-8').write(s.replace('</body>', banner + '</body>', 1))
PY
cat > "$OUT/.htaccess" <<'HT'
# TakeOne static preview — Apache (Hostinger shared hosting). Extract the zip's contents into public_html.
Options -Indexes
DirectoryIndex index.html
ErrorDocument 404 /404.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # 1. Real files and folders are served as they are (folder → folder/index.html via DirectoryIndex).
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # 2. Creator app: any unknown page path under /app/ is handled by the single-page app.
  #    (Paths that look like a file, e.g. a missing .js, still return 404.)
  RewriteCond %{REQUEST_URI} !\.[A-Za-z0-9]{2,5}$
  RewriteRule ^app/ app/index.html [L]

  # 3. Dashboard pages with an id in the URL share one exported page; it reads the id from the address bar.
  RewriteRule ^brand/campaigns/[^/]+/review/[^/]+/?$ brand/campaigns/_/review/_/index.html [L]
  RewriteRule ^brand/campaigns/[^/]+/?$ brand/campaigns/_/index.html [L]

  # 4. Anything else falls through to the exported 404 page (ErrorDocument above).
</IfModule>

<IfModule mod_headers.c>
  # HTML is never cached, so a new upload is picked up immediately.
  <FilesMatch "\.(html|txt)$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
  </FilesMatch>
  # Build assets have content hashes in their names: cache for a year.
  SetEnvIf Request_URI "^/(_next/static|app/_expo/static|app/assets)/" TAKEONE_HASHED
  Header set Cache-Control "public, max-age=31536000, immutable" env=TAKEONE_HASHED
  Header set X-Content-Type-Options "nosniff"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# Never serve dotfiles (.env, .git, …) even if one is uploaded by mistake.
<FilesMatch "^\.">
  Require all denied
</FilesMatch>
HT

echo "5/6 Security checks"
node scripts/preview-scan.cjs "$OUT"

echo "6/6 Zip (contents of preview-dist/, index.html at the zip root)"
(cd "$OUT" && zip -qr -X "$ZIP" . -x "*.DS_Store")
echo "Done: $ZIP ($(du -h "$ZIP" | cut -f1)), $(find "$OUT" -type f | wc -l) files"
