'use client';
// Runs the app's (normally server-rendered) pages in the browser for the static preview.
// A page is an async function that returns React elements; here it is awaited on the client and the result rendered.
import { cloneElement, isValidElement, useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { hostAgency, resetPreviewCache } from '@/lib/session.preview';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { PreviewNotFound, PreviewRedirect, REFRESH_EVENT } from './navigation';
import { SkeletonPage } from '@/components/ui';
import { agencyThemeCss } from '@/lib/theme';
import { go, logicalPath } from './url';

type PageFn = (props: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string>> }) => ReactNode | Promise<ReactNode>;
type LayoutFn = (props: { children: ReactNode }) => ReactNode | Promise<ReactNode>;
interface Loaded { default: unknown }
const page = (m: Loaded) => m.default as PageFn;
const layout = (m: Loaded) => m.default as LayoutFn;

const brandLayout = () => import('@/app/brand/layout').then(layout);
const agencyLayout = () => import('@/app/agency/layout').then(layout);
const adminLayout = () => import('@/app/admin/layout').then(layout);

/** Route table mirroring src/app. `:x` segments are read from the address bar. */
const ROUTES: [pattern: string, load: () => Promise<PageFn>, layout?: () => Promise<LayoutFn>][] = [
  ['/', () => import('@/app/page').then(page)],
  ['/login', () => import('@/app/login/page').then(page)],
  ['/signup', () => import('@/app/signup/page').then(page)],
  ['/onboarding', () => import('@/app/onboarding/page').then(page)],
  ['/dashboard', () => import('@/app/dashboard/page').then(page)],
  ['/creators', () => import('@/app/creators/page').then(page)],
  ['/brands', () => import('@/app/brands/page').then(page)],
  ['/agencies', () => import('@/app/agencies/page').then(page)],
  ['/about', () => import('@/app/about/page').then(page)],
  ['/contact', () => import('@/app/contact/page').then(page)],
  ['/privacy', () => import('@/app/privacy/page').then(page)],
  ['/terms', () => import('@/app/terms/page').then(page)],
  ['/demo', () => import('@/app/demo/page').then(page)],
  ['/_design', () => import('@/app/%5Fdesign/page').then(page)],
  ['/brand', () => import('@/app/brand/page').then(page), brandLayout],
  ['/brand/campaigns/new', () => import('@/app/brand/campaigns/new/page').then(page), brandLayout],
  ['/brand/campaigns/:id', () => import('@/app/brand/campaigns/[id]/page').then(page), brandLayout],
  ['/brand/campaigns/:id/review/:aid', () => import('@/app/brand/campaigns/[id]/review/[aid]/page').then(page), brandLayout],
  ['/brand/licenses', () => import('@/app/brand/licenses/page').then(page), brandLayout],
  ['/brand/leaderboard', () => import('@/app/brand/leaderboard/page').then(page), brandLayout],
  ['/brand/billing', () => import('@/app/brand/billing/page').then(page), brandLayout],
  ['/agency', () => import('@/app/agency/page').then(page), agencyLayout],
  ['/agency/branding', () => import('@/app/agency/branding/page').then(page), agencyLayout],
  ['/admin', () => import('@/app/admin/page').then(page), adminLayout],
  ['/admin/:section', () => import('@/app/admin/[section]/page').then(page), adminLayout],
];

function match(path: string) {
  const parts = path.split('/').filter(Boolean);
  for (const [pattern, load, lay] of ROUTES) {
    const pp = pattern.split('/').filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params: Record<string, string> = {};
    if (pp.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(parts[i]!)), true) : seg === parts[i]))) return { load, lay, params };
  }
  return null;
}

const isAsync = (fn: unknown): fn is (props: unknown) => Promise<ReactNode> => typeof fn === 'function' && fn.constructor?.name === 'AsyncFunction';
const isThenable = (x: unknown): x is Promise<ReactNode> => !!x && typeof (x as { then?: unknown }).then === 'function';

/** Awaits async components and promise children anywhere in the tree, leaving a plain tree React can render in the browser. */
async function resolveTree(node: ReactNode): Promise<ReactNode> {
  if (isThenable(node)) return resolveTree(await node);
  if (Array.isArray(node)) return Promise.all(node.map(resolveTree));
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (isAsync(el.type)) return resolveTree(await el.type(el.props));
  if (el.props.children === undefined) return el;
  // (not Children.toArray: React treats a pending promise child there as a suspension and throws it)
  const c = el.props.children;
  return Array.isArray(c) ? cloneElement(el, undefined, ...(await Promise.all(c.map(resolveTree)))) : cloneElement(el, undefined, await resolveTree(c));
}

function Message({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="mx-auto mt-24 max-w-md px-6 text-center"><h1 className="text-h3">{title}</h1><p className="mt-2 text-small text-secondary">{body}</p>{action && <div className="mt-6">{action}</div>}</div>;
}

export function PreviewHost() {
  const [state, setState] = useState<{ node?: ReactNode; error?: string; missing?: boolean }>({});
  const run = useCallback(async () => {
    resetPreviewCache();
    try {
      const path = logicalPath();
      if (path === '/auth/callback') { // OAuth / magic-link return: the browser client exchanges the code, then continue
        await supabaseBrowser().auth.getSession();
        return go('/dashboard', true);
      }
      const m = match(path);
      if (!m) return setState({ missing: true });
      const props = { params: Promise.resolve(m.params), searchParams: Promise.resolve(Object.fromEntries(new URLSearchParams(window.location.search))) };
      const [Page, Layout] = await Promise.all([m.load(), m.lay?.()]);
      // layout first: it holds the sign-in / role guard
      const pageResult = Promise.resolve(Page(props));
      pageResult.catch(() => {}); // if the layout redirects first, the page's own redirect must not surface as an unhandled rejection
      const tree = Layout ? await Layout({ children: pageResult as unknown as ReactNode }) : await pageResult;
      setState({ node: await resolveTree(tree) });
    } catch (e) {
      if (e instanceof PreviewRedirect) return go(e.to, true);
      if (e instanceof PreviewNotFound) return setState({ missing: true });
      console.error('[preview] page failed', e);
      setState((s) => ({ ...s, error: e instanceof Error ? e.message : typeof (e as { message?: unknown })?.message === 'string' ? (e as { message: string }).message : 'The page could not be loaded.' }));
    }
  }, []);
  useEffect(() => {
    void run();
    window.addEventListener(REFRESH_EVENT, run);
    return () => window.removeEventListener(REFRESH_EVENT, run);
  }, [run]);

  if (state.missing) return <Message title="Page not found" body="This link does not point to anything in the preview." action={<a className="text-accent-text hover:underline" href="/">Back to home</a>} />;
  if (state.error && !state.node) return <Message title="Something went wrong" body={state.error} action={<button className="text-accent-text hover:underline" onClick={() => { setState({}); void run(); }}>Try again</button>} />;
  return state.node ?? <div className="container-page py-8"><SkeletonPage /></div>;
}

/** Applies the agency theme chosen with ?agency=<slug>: the same generated accent variables the server layout sets by host. */
export function AgencyTheme() {
  useEffect(() => {
    hostAgency().then((a) => {
      if (!a) return;
      const style = document.createElement('style');
      style.textContent = agencyThemeCss(a.primary_color);
      document.head.appendChild(style);
      document.title = `${a.name} · Creator campaigns`;
    }).catch(() => {});
  }, []);
  return null;
}
