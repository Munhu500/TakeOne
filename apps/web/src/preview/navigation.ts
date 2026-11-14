// Static preview replacement for next/navigation. Navigation is a normal page load; "refresh" re-runs the page's data loading.
import { useEffect, useState } from 'react';
import { go, logicalPath } from './url';

export class PreviewRedirect extends Error { constructor(public to: string) { super(`redirect:${to}`); } }
export class PreviewNotFound extends Error { constructor() { super('not-found'); } }
export function redirect(to: string): never { throw new PreviewRedirect(to); }
export function notFound(): never { throw new PreviewNotFound(); }

export const REFRESH_EVENT = 'takeone:preview-refresh';
export function useRouter() {
  return {
    push: (href: string) => go(href),
    replace: (href: string) => go(href, true),
    refresh: () => window.dispatchEvent(new Event(REFRESH_EVENT)),
    back: () => window.history.back(),
    prefetch: () => {},
  };
}
export function usePathname(): string {
  const [p, setP] = useState('/');
  useEffect(() => setP(logicalPath()), []);
  return p;
}
export function useSearchParams(): URLSearchParams {
  const [s, setS] = useState(() => new URLSearchParams());
  useEffect(() => setS(new URLSearchParams(window.location.search)), []);
  return s;
}
