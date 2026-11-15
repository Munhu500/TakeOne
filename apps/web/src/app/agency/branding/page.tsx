import { requireRole } from '@/lib/session';
import { siteHost } from '@/lib/site';
import { PageHeader } from '@/components/ui';
import { BrandingForm } from './form';

export default async function Branding() {
  const s = await requireRole('agency_member');
  const a = s.agency!;
  return (
    <>
      <PageHeader title="White-label" sub="Your clients sign in on your domain and see your name, logo and colour everywhere, including invoices." />
      <BrandingForm agency={{ id: a.id, name: a.name, logo: a.logo, primary_color: a.primary_color, subdomain: a.subdomain, markup_default_bps: a.markup_default_bps }} userId={s.userId} cnameTarget={siteHost()} />
    </>
  );
}
