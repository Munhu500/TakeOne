/** Static hosting serves each route as folder/index.html, so internal links get a trailing slash (saves a redirect). */
export function withSlash(href: string): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const m = /^([^?#]*)(.*)$/.exec(href)!;
  const path = m[1]!;
  return (path.endsWith('/') || /\.[a-z0-9]{2,5}$/i.test(path) ? path : `${path}/`) + m[2]!;
}
export function go(href: string, replace = false) {
  if (replace) window.location.replace(withSlash(href)); else window.location.assign(withSlash(href));
}
/** The address bar path without its trailing slash, i.e. the app's own route (`/brand/campaigns/<id>`). */
export function logicalPath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/';
}
