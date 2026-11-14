// The only route file in the static preview build. Every exported folder contains this client-side host,
// which picks the real page from the address bar. `_` folders are placeholders that .htaccess serves for any id.
import { PreviewHost } from '@/preview/host';

const ADMIN = ['qa', 'verification', 'users', 'campaigns', 'disputes', 'payouts', 'masking', 'credits', 'settings'];
const PATHS = [
  '', 'login', 'signup', 'onboarding', 'dashboard', 'creators', 'auth/callback',
  'brand', 'brand/campaigns/new', 'brand/campaigns/_', 'brand/campaigns/_/review/_', 'brand/licenses', 'brand/leaderboard', 'brand/billing',
  'agency', 'agency/branding', 'admin', ...ADMIN.map((s) => `admin/${s}`),
];
export const dynamicParams = false;
export function generateStaticParams() {
  return PATHS.map((p) => ({ slug: p ? p.split('/') : [] }));
}
export default function PreviewPage() {
  return <PreviewHost />;
}
