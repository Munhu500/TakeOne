// Local stand-in for Apache serving preview-dist/ with the rules from its .htaccess (for testing only):
// real files as-is, folder → folder/index.html (301 to add the slash), no directory listing, /app SPA fallback,
// id routes → placeholder page, exported 404 page, and the same cache headers.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2] || 'preview-dist'), port = +(process.argv[3] || 8090);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const REWRITES = [
  [/^\/app\/(?!.*\.[A-Za-z0-9]{2,5}$)/, '/app/index.html'],
  [/^\/brand\/campaigns\/[^/]+\/review\/[^/]+\/?$/, '/brand/campaigns/_/review/_/index.html'],
  [/^\/brand\/campaigns\/[^/]+\/?$/, '/brand/campaigns/_/index.html'],
];
function send(res, status, file, uri) {
  const headers = { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'x-content-type-options': 'nosniff' };
  if (/\.(html|txt)$/.test(file)) headers['cache-control'] = 'no-cache, no-store, must-revalidate';
  if (/^\/(_next\/static|app\/_expo\/static|app\/assets)\//.test(uri)) headers['cache-control'] = 'public, max-age=31536000, immutable';
  res.writeHead(status, headers); fs.createReadStream(file).pipe(res);
}
http.createServer((req, res) => {
  const [rawPath, query = ''] = req.url.split('?');
  const uri = decodeURIComponent(rawPath);
  const notFound = () => send(res, 404, path.join(root, '404.html'), '/404.html');
  if (uri.split('/').some((s) => s.startsWith('.'))) { res.writeHead(403); return res.end('Forbidden'); }
  const file = path.join(root, uri);
  if (!file.startsWith(root)) return notFound();
  const st = fs.existsSync(file) ? fs.statSync(file) : null;
  if (st?.isFile()) return send(res, 200, file, uri);
  if (st?.isDirectory()) {
    if (!uri.endsWith('/')) { res.writeHead(301, { location: uri + '/' + (query ? '?' + query : '') }); return res.end(); }
    const index = path.join(file, 'index.html');
    if (fs.existsSync(index)) return send(res, 200, index, uri);
    res.writeHead(403); return res.end('Forbidden'); // Options -Indexes
  }
  for (const [re, target] of REWRITES) if (re.test(uri)) return send(res, 200, path.join(root, target), uri);
  notFound();
}).listen(port, () => console.log(`preview-dist on http://localhost:${port}`));
