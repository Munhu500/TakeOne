// The only route file in the static preview build. Every exported folder contains this client-side host,
// which picks the real page from the address bar. `_` folders are placeholders that .htaccess serves for any id.
import { PreviewHost } from '@/preview/host';

// add each admin page here (and in preview/host.tsx ROUTES) as it is written
const ADMIN = ['audit'];
const PATHS = [
  '', 'login', 'signup', 'onboarding', 'dashboard', 'creators', 'brands', 'agencies', 'about', 'contact', 'privacy', 'terms', 'demo', 'auth/callback', '_design',
  'brand', 'brand/campaigns/new', 'brand/campaigns/_', 'brand/campaigns/_/review/_', 'brand/licenses', 'brand/leaderboard', 'brand/billing',
  'agency', 'agency/branding', 'agency/billing', 'mfa', 'admin', ...ADMIN.map((s) => `admin/${s}`),
];
export const dynamicParams = false;
export function generateStaticParams() {
  return PATHS.map((p) => ({ slug: p ? p.split('/') : [] }));
}
export default function PreviewPage() {
  return <PreviewHost />;
}
