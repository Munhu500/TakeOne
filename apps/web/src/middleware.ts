import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/brand', '/agency', '/admin', '/onboarding'];

/**
 * 1. White-label: pass the request host on so layouts can resolve an agency by its custom (sub)domain and theme the page.
 * 2. Refresh the Supabase session cookie and gate the dashboards.
 */
export async function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set('x-takeone-host', (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(':')[0]!.toLowerCase());
  let res = NextResponse.next({ request: { headers } });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: { headers } });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user && PROTECTED.some((p) => req.nextUrl.pathname.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return res;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|mp4)$).*)'] };
