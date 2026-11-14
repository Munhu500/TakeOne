import { FORMATS, formatMoney, LICENSE_DEFAULTS, licensePrice, type FormatId, type LicensePricing } from '@takeone/shared';
import { requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { Badge, Empty, LinkButton, PageHeader } from '@/components/ui';
import { daysLeft, fmtDate, titleCase } from '@/lib/utils';
import { RenewButton } from './renew';

export default async function Licenses() {
  const s = await requireBrand();
  const sb = await supabaseServer();
  const [{ data }, { data: pricingRow }] = await Promise.all([
    sb.from('licenses').select('*, variants(id, format, is_synthetic, assignment_id), campaigns(id, title, fee_per_creator_minor, currency)').eq('brand_id', s.brand.id).order('ends_at', { ascending: true, nullsFirst: false }),
    sb.from('settings').select('value').eq('key', 'license_pricing').maybeSingle(),
  ]);
  type Row = { id: string; variant_id: string; type: string; starts_at: string; ends_at: string | null; variants: { format: FormatId; is_synthetic: boolean; assignment_id: string }; campaigns: { id: string; title: string; fee_per_creator_minor: number; currency: string } };
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
      <PageHeader title="Usage & licenses" sub={`Paid-ad usage runs ${pricing.termDays ?? LICENSE_DEFAULTS.termDays} days per license. You get a reminder ${LICENSE_DEFAULTS.renewalReminderDays} days before expiry. Organic use on your own channels never expires.`} />
      {items.length === 0 ? <Empty title="No licensed variants yet" body="Select variants from a delivery to start the clock." action={<LinkButton href="/brand">Go to campaigns</LinkButton>} /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-faint"><th className="p-4 font-medium">Variant</th><th className="p-4 font-medium">Campaign</th><th className="p-4 font-medium">Licenses</th><th className="p-4 font-medium">Paid usage ends</th><th className="p-4" /></tr></thead>
            <tbody className="divide-y divide-line">
              {items.map(({ first: l, types, perpetual, ends, left }) => {
                const expired = !perpetual && left <= 0;
                const price = licensePrice('renewal', Number(l.campaigns.fee_per_creator_minor), pricing);
                return (
                  <tr key={l.variant_id}>
                    <td className="p-4"><div className="font-medium">{FORMATS[l.variants.format]?.name ?? l.variants.format}</div>{l.variants.is_synthetic && <div className="text-xs text-warn">AI-assisted · enable the AI-info label when publishing</div>}</td>
                    <td className="p-4 text-muted">{l.campaigns.title}</td>
                    <td className="p-4"><div className="flex flex-wrap gap-1">{types.map((t) => <Badge key={t}>{titleCase(t)}</Badge>)}</div></td>
                    <td className="tabular p-4">{perpetual ? <Badge tone="ok">Perpetual</Badge> : ends ? <span className="flex items-center gap-2">{fmtDate(ends)}{expired ? <Badge tone="bad">Expired</Badge> : left <= 7 ? <Badge tone="warn">{left} days left</Badge> : <span className="text-xs text-faint">{left} days left</span>}</span> : '—'}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {!perpetual && <RenewButton variantId={l.variant_id} campaignId={l.campaigns.id} label={`Renew · ${formatMoney(price, l.campaigns.currency)}`} primary={left <= 7} />}
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
