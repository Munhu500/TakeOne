import { notFound } from 'next/navigation';
import { ASPECTS, LICENSE_DEFAULTS, licensePrice, type License, type LicensePricing, type Variant } from '@takeone/shared';
import { requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { creatorsByIds } from '@/lib/queries';
import { ReviewRoom } from './review';

const REVIEWABLE = ['delivered', 'approved', 'completed', 'disputed'];

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string; aid: string }>; searchParams: Promise<{ v?: string }> }) {
  const [{ id, aid }, { v: startAt }] = await Promise.all([params, searchParams]);
  await requireBrand();
  const sb = await supabaseServer();
  const [{ data: a }, { data: c }, { data: pricingRow }, { data: sibs }] = await Promise.all([
    sb.from('assignments').select('*').eq('id', aid).eq('campaign_id', id).maybeSingle(),
    sb.from('campaigns').select('id, title, fee_per_creator_minor, currency, product_name, license_term_days').eq('id', id).maybeSingle(),
    sb.from('settings').select('value').eq('key', 'license_pricing').maybeSingle(),
    sb.from('assignments').select('id, creator_id, status').eq('campaign_id', id).in('status', REVIEWABLE).order('created_at'),
  ]);
  if (!a || !c) notFound();
  // RLS: the brand only ever receives variants that were delivered to it
  const { data: vs } = await sb.from('variants').select('*').eq('assignment_id', aid).order('score', { ascending: false });
  const variants = ((vs ?? []) as unknown as Variant[]).filter((v) => v.status !== 'coming_soon');
  const { data: lic } = variants.length ? await sb.from('licenses').select('*').in('variant_id', variants.map((v) => v.id)).order('created_at') : { data: [] };
  const paths = variants.flatMap((v) => [v.thumbnail, ...ASPECTS.map((x) => v.preview_renditions[x])]).filter((p): p is string => !!p);
  const { data: signed } = paths.length ? await sb.storage.from('variants').createSignedUrls(paths, 3600) : { data: [] };
  const urls: Record<string, string> = {};
  for (const x of signed ?? []) if (x.path && x.signedUrl) urls[x.path] = x.signedUrl;
  const siblings = (sibs ?? []) as { id: string; creator_id: string }[];
  const { creators } = await creatorsByIds([...new Set([a.creator_id, ...siblings.map((s) => s.creator_id)])]);
  const pricing = (pricingRow?.value ?? {}) as Partial<LicensePricing>;
  const fee = Number(c.fee_per_creator_minor);
  const at = siblings.findIndex((s) => s.id === aid);
  const link = (s?: { id: string; creator_id: string }) => (s ? { href: `/brand/campaigns/${id}/review/${s.id}`, name: creators.get(s.creator_id)?.display_name ?? 'Creator' } : null);
  const who = creators.get(a.creator_id);
  return (
    <ReviewRoom
      campaign={{ id, title: c.title, productName: c.product_name, currency: c.currency }}
      creator={{ name: who?.display_name ?? 'Creator', avatar: who?.avatar ?? null }}
      prev={at > 0 ? link(siblings[at - 1]) : null} next={at >= 0 ? link(siblings[at + 1]) : null}
      assignment={{ id: a.id, status: a.status, winning_variant_id: a.winning_variant_id, post_url: a.post_url, delivered_at: a.delivered_at, approved_at: a.approved_at }}
      variants={variants.map((v) => ({ id: v.id, format: v.format, status: v.status, hook_text: v.hook_text, score: v.score, score_reason: v.score_reason, is_synthetic: v.is_synthetic, language: v.language, thumbnail: v.thumbnail, preview_renditions: v.preview_renditions, renditions: v.renditions }))}
      licenses={(lic ?? []) as License[]} urls={urls} startAt={startAt ?? null}
      prices={{ extra: licensePrice('extra', fee, pricing), renewal: licensePrice('renewal', fee, pricing), buyout: licensePrice('buyout', fee, pricing), whitelist: licensePrice('whitelist', fee, pricing) }}
      included={LICENSE_DEFAULTS.baseIncludedVariants} termDays={c.license_term_days ?? LICENSE_DEFAULTS.termDays}
    />
  );
}
