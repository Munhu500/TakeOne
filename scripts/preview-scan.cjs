// Fails the preview build if anything secret, server-side or source-like ended up in preview-dist/.
const fs = require('fs'), path = require('path');
const root = process.argv[2];
const problems = [];
const TEXT = /\.(html|js|css|json|txt|xml|svg|map|htaccess)$/i;
const PATTERNS = [
  ['Stripe secret key', /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/],
  ['Stripe webhook secret', /\bwhsec_[A-Za-z0-9]{16,}/],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{10,}/],
  ['Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{16,}/],
  ['OpenAI API key', /\bsk-(?:proj-)?[A-Za-z0-9]{32,}/],
  ['ElevenLabs API key', /\bsk_[a-f0-9]{40,}/],
  ['Replicate token', /\br8_[A-Za-z0-9]{30,}/],
  ['fal.ai key', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{32}\b/],
  ['Private key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Server env name with a value', /(?:SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|ANTHROPIC_API_KEY|ELEVENLABS_API_KEY|REPLICATE_API_TOKEN|WORKER_PASSWORD)\s*[=:]\s*["']?[A-Za-z0-9_\-.]{12,}/],
];
const env = (() => { try { return fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); } catch { return ''; } })();
const workerPassword = /^WORKER_PASSWORD=(.+)$/m.exec(env)?.[1]?.trim();
const serviceKey = /^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m.exec(env)?.[1]?.trim();

function jwtRole(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role; } catch { return undefined; }
}
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name), rel = path.relative(root, file);
    if (fs.statSync(file).isDirectory()) { if (name === 'node_modules' || name === '.git') problems.push(`${rel}: directory must not be shipped`); else walk(file); continue; }
    if (/^\.env/.test(name)) problems.push(`${rel}: .env file`);
    if (/\.map$/.test(name)) problems.push(`${rel}: source map`);
    if (/\.(ts|tsx|sql|sh|py|toml|lock)$/.test(name) || name === 'package.json' || name === 'Dockerfile') problems.push(`${rel}: source/config file`);
    if (name !== '.htaccess' && !TEXT.test(name)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const [label, re] of PATTERNS) { const m = re.exec(text); if (m) problems.push(`${rel}: ${label} (${m[0].slice(0, 12)}…)`); }
    for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g)) { const role = jwtRole(m[0]); if (role && role !== 'anon') problems.push(`${rel}: JWT with role "${role}"`); }
    if (workerPassword && text.includes(workerPassword)) problems.push(`${rel}: worker password`);
    if (serviceKey && text.includes(serviceKey)) problems.push(`${rel}: service-role key`);
    if (/sourceMappingURL=(?!data:)/.test(text.slice(-300))) problems.push(`${rel}: references a source map`);
  }
})(root);
for (const need of ['index.html', '404.html', '.htaccess', 'app/index.html', 'brand/index.html', 'agency/index.html', 'admin/index.html']) if (!fs.existsSync(path.join(root, need))) problems.push(`${need}: missing`);
if (problems.length) { console.error('SECURITY CHECK FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log('  ok: no secrets, .env files, source maps or source code; only the Supabase URL and anon key are present');
