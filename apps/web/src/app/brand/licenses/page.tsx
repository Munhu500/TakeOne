import { LICENSE_DEFAULTS, licensePrice, type FormatId, type LicensePricing, type LicenseType } from '@takeone/shared';
import { requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { EmptyState, LinkButton, PageHeader, Stat } from '@/components/ui';
import { LicenceTable, type LicenceRow } from './table';

const DAY = 86_400_000;

export default async function Licenses() {
  const s = await requireBrand();
  const sb = await supabaseServer();
  const [{ data }, { data: pricingRow }] = await Promise.all([
    sb.from('licenses').select('id, variant_id, type, starts_at, ends_at, created_at, variants(id, format, is_synthetic, assignment_id, renditions), campaigns(id, title, fee_per_creator_minor, currency, product_name, license_term_days)').eq('brand_id', s.brand.id).order('ends_at', { ascending: true, nullsFirst: false }),
    sb.from('settings').select('value').eq('key', 'license_pricing').maybeSingle(),
  ]);
  type Row = { id: string; variant_id: string; type: LicenseType; ends_at: string | null; created_at: string; variants: { format: FormatId; is_synthetic: boolean; assignment_id: string; renditions: Record<string, string> | null }; campaigns: { id: string; title: string; fee_per_creator_minor: number; currency: string; product_name: string; license_term_days: number | null } };
  const pricing = (pricingRow?.value ?? {}) as Partial<LicensePricing>;
  const byVariant = new Map<string, Row[]>();
  for (const r of (data ?? []) as unknown as Row[]) byVariant.set(r.variant_id, [...(byVariant.get(r.variant_id) ?? []), r]);
  const now = Date.now();
  const rows: LicenceRow[] = [...byVariant.values()].map((ls) => {
    const l = ls[0]!;
    const perpetual = ls.some((x) => x.type === 'buyout');
    const ends = perpetual ? null : ls.filter((x) => x.type !== 'whitelist' && x.ends_at).map((x) => x.ends_at!).sort().pop() ?? null;
    const fee = Number(l.campaigns.fee_per_creator_minor);
    return {
      variantId: l.variant_id, format: l.variants.format, synthetic: l.variants.is_synthetic, assignmentId: l.variants.assignment_id, renditions: l.variants.renditions ?? {},
      campaignId: l.campaigns.id, campaign: l.campaigns.title, product: l.campaigns.product_name, currency: l.campaigns.currency,
      partnership: ls.some((x) => x.type === 'whitelist'), perpetual, ends, termDays: l.campaigns.license_term_days ?? LICENSE_DEFAULTS.termDays,
      renewPrice: licensePrice('renewal', fee, pricing), buyoutPrice: licensePrice('buyout', fee, pricing),
    };
  }).sort((a, b) => (a.ends ? new Date(a.ends).getTime() : Infinity) - (b.ends ? new Date(b.ends).getTime() : Infinity));
  const running = rows.filter((r) => r.perpetual || (r.ends && new Date(r.ends).getTime() > now)).length;
  const soon = rows.filter((r) => r.ends && new Date(r.ends).getTime() > now && new Date(r.ends).getTime() <= now + 7 * DAY).length;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const renewed = ((data ?? []) as unknown as Row[]).filter((r) => r.type === 'renewal' && new Date(r.created_at).getTime() >= monthStart).length;
  return (
    <>
      <PageHeader title="Usage & licences" sub="Paid-ad usage runs for each campaign’s licence term; a renewal adds the same again. Organic use on your own channels never ends." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Running now" value={running} />
        <Stat label="Ending in 7 days" value={soon} hint={soon ? 'Renew to keep these ads running' : 'Nothing needs renewing this week'} />
        <Stat label="Renewed this month" value={renewed} />
      </div>
      <div className="mt-8">
        {rows.length === 0 ? <EmptyState title="You have no licensed ads yet. Select your winners in the Review room to start the clock." action={<LinkButton href="/brand">Go to campaigns</LinkButton>} /> : <LicenceTable rows={rows} />}
      </div>
    </>
  );
}
