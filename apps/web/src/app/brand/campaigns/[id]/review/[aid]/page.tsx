import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ASPECTS, FORMAT_LIST, LICENSE_DEFAULTS, licensePrice, type License, type LicensePricing, type Variant } from '@takeone/shared';
import { requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { creatorsByIds } from '@/lib/queries';
import { PageHeader } from '@/components/ui';
import { Review } from './review';

export default async function ReviewPage({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const { id, aid } = await params;
  await requireBrand();
  const sb = await supabaseServer();
  const [{ data: a }, { data: c }, { data: pricingRow }] = await Promise.all([
    sb.from('assignments').select('*').eq('id', aid).eq('campaign_id', id).maybeSingle(),
    sb.from('campaigns').select('id, title, fee_per_creator_minor, currency, product_name').eq('id', id).maybeSingle(),
    sb.from('settings').select('value').eq('key', 'license_pricing').maybeSingle(),
  ]);
  if (!a || !c) notFound();
  // RLS: the brand only ever receives variants that were delivered to it
  const { data: vs } = await sb.from('variants').select('*').eq('assignment_id', aid).order('score', { ascending: false });
  const variants = ((vs ?? []) as unknown as Variant[]);
  const { data: lic } = variants.length ? await sb.from('licenses').select('*').in('variant_id', variants.map((v) => v.id)).order('created_at') : { data: [] };
  const paths = variants.flatMap((v) => [v.thumbnail, ...ASPECTS.map((x) => v.preview_renditions[x])]).filter((p): p is string => !!p);
  const { data: signed } = paths.length ? await sb.storage.from('variants').createSignedUrls(paths, 3600) : { data: [] };
  const urls: Record<string, string> = {};
  for (const x of signed ?? []) if (x.path && x.signedUrl) urls[x.path] = x.signedUrl;
  const { creators } = await creatorsByIds([a.creator_id]);
  const pricing = (pricingRow?.value ?? {}) as Partial<LicensePricing>;
  const fee = Number(c.fee_per_creator_minor);
  const delivered = new Set(variants.map((v) => v.format));
  return (
    <>
      <Link href={`/brand/campaigns/${id}?tab=creators`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft size={14} />{c.title}</Link>
      <PageHeader title={`Variants from ${creators.get(a.creator_id)?.display_name ?? 'creator'}`} sub="One take, cut into ad formats and ranked against your brief." />
      <Review
        campaignId={id} assignment={{ id: a.id, status: a.status, winning_variant_id: a.winning_variant_id, post_url: a.post_url, delivered_at: a.delivered_at, approved_at: a.approved_at }}
        variants={variants.map((v) => ({ id: v.id, format: v.format, status: v.status, hook_text: v.hook_text, score: v.score, score_reason: v.score_reason, is_synthetic: v.is_synthetic, ai_disclosure: v.ai_disclosure, language: v.language, thumbnail: v.thumbnail, preview_renditions: v.preview_renditions, renditions: v.renditions }))}
        notDelivered={FORMAT_LIST.filter((f) => !delivered.has(f.id)).map((f) => ({ id: f.id, name: f.name, tagline: f.tagline, v1: f.v1 }))}
        licenses={(lic ?? []) as License[]} urls={urls} currency={c.currency}
        prices={{ extra: licensePrice('extra', fee, pricing), renewal: licensePrice('renewal', fee, pricing), buyout: licensePrice('buyout', fee, pricing), whitelist: licensePrice('whitelist', fee, pricing) }}
        included={LICENSE_DEFAULTS.baseIncludedVariants} termDays={pricing.termDays ?? LICENSE_DEFAULTS.termDays} productName={c.product_name}
      />
    </>
  );
}
