// Static preview replacement for next/link: a plain anchor (no client-side route payloads to fetch on a static host).
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { withSlash } from './url';

export default function Link({ href, children, prefetch: _p, replace: _r, scroll: _s, ...rest }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; children?: ReactNode; prefetch?: boolean; replace?: boolean; scroll?: boolean }) {
  return <a {...rest} href={withSlash(href)}>{children}</a>;
}
