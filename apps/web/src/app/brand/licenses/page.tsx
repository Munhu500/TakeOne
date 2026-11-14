import { FORMATS, LICENSE_DEFAULTS, LICENSE_LABELS, licensePrice, type FormatId, type LicensePricing, type LicenseType } from '@takeone/shared';
import { requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { Badge, EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { daysLeft, daysLeftLabel, fmtDate, money } from '@/lib/utils';
import { RenewButton } from './renew';

export default async function Licenses() {
  const s = await requireBrand();
  const sb = await supabaseServer();
  const [{ data }, { data: pricingRow }] = await Promise.all([
    sb.from('licenses').select('*, variants(id, format, is_synthetic, assignment_id), campaigns(id, title, fee_per_creator_minor, currency)').eq('brand_id', s.brand.id).order('ends_at', { ascending: true, nullsFirst: false }),
    sb.from('settings').select('value').eq('key', 'license_pricing').maybeSingle(),
  ]);
  type Row = { id: string; variant_id: string; type: LicenseType; starts_at: string; ends_at: string | null; variants: { format: FormatId; is_synthetic: boolean; assignment_id: string }; campaigns: { id: string; title: string; fee_per_creator_minor: number; currency: string } };
  const rows = (data ?? []) as unknown as Row[];
  // one line per variant: latest usage end (or perpetual), plus add-ons
  const byVariant = new Map<string, Row[]>();
  for (const r of rows) byVariant.set(r.variant_id, [...(byVariant.get(r.variant_id) ?? []), r]);
  const items = [...byVariant.values()].map((ls) => {
    const perpetual = ls.some((l) => l.type === 'buyout');
    const ends = perpetual ? null : ls.filter((l) => l.type !== 'whitelist' && l.ends_at).map((l) => l.ends_at!).sort().pop() ?? null;
    return { first: ls[0]!, types: [...new Set(ls.map((l) => l.type))], perpetual, ends, left: ends ? daysLeft(ends) : Infinity };
  }).sort((a, b) => a.left - b.left);
  const pricing = (pricingRow?.value ?? {}) as Partial<LicensePricing>;
  return (
    <>
      <PageHeader title="Usage & licences" sub={`Paid-ad usage runs ${LICENSE_DEFAULTS.termDays} days per licence, and a renewal adds the same again. You get a reminder ${LICENSE_DEFAULTS.renewalReminderDays} days before a licence ends. Organic use on your own channels never expires.`} />
      {items.length === 0 ? <EmptyState title="You have no licensed variants yet. Select variants from a delivery to start the clock." action={<LinkButton href="/brand">Go to campaigns</LinkButton>} /> : (
        <div className="card overflow-x-auto">
          <table className="data-table min-w-table">
            <thead><tr><th>Variant</th><th>Campaign</th><th>Licences</th><th>Paid usage ends</th><th /></tr></thead>
            <tbody>
              {items.map(({ first: l, types, perpetual, ends, left }) => {
                const price = licensePrice('renewal', Number(l.campaigns.fee_per_creator_minor), pricing);
                return (
                  <tr key={l.variant_id}>
                    <td><div className="font-medium">{FORMATS[l.variants.format]?.name ?? l.variants.format}</div>{l.variants.is_synthetic && <div className="text-caption text-tertiary">AI-assisted · enable the AI-info label when publishing</div>}</td>
                    <td className="text-secondary">{l.campaigns.title}</td>
                    <td><div className="flex flex-wrap gap-1">{types.map((t) => <Badge key={t} tone="outline">{LICENSE_LABELS[t]}</Badge>)}</div></td>
                    <td className="tabular">{perpetual ? <Badge tone="success">Perpetual</Badge> : ends ? <span className="flex items-center gap-2">{fmtDate(ends)}<Badge tone={left <= 0 ? 'danger' : left <= 7 ? 'warning' : 'neutral'}>{daysLeftLabel(ends)}</Badge></span> : '—'}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        {!perpetual && <RenewButton variantId={l.variant_id} campaignId={l.campaigns.id} label={`Renew · ${money(price, l.campaigns.currency)}`} urgent={left <= 7} />}
                        <LinkButton size="sm" variant="ghost" href={`/brand/campaigns/${l.campaigns.id}/review/${l.variants.assignment_id}`}>Open</LinkButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
