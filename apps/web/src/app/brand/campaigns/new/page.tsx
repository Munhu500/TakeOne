import { LICENSE_DEFAULTS } from '@takeone/shared';
import { requireBrand } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase-server';
import { PageHeader } from '@/components/ui';
import { CampaignWizard } from './wizard';

export default async function NewCampaign() {
  const s = await requireBrand();
  const sb = await supabaseServer();
  const { data: credits } = await sb.from('credits').select('amount_minor, used_minor').eq('brand_id', s.brand.id).eq('currency', s.brand.currency).gt('expires_at', new Date().toISOString());
  const credit = (credits ?? []).reduce((a, c) => a + Number(c.amount_minor) - Number(c.used_minor), 0);
  return (
    <>
      <PageHeader title="New campaign" sub={`For ${s.brand.name}. Paste a product link and edit what comes back.`} />
      <CampaignWizard brand={{ id: s.brand.id, country: s.brand.country, currency: s.brand.currency }} creditMinor={credit} includedVariants={LICENSE_DEFAULTS.baseIncludedVariants} />
    </>
  );
}
