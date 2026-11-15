import { LICENSE_DEFAULTS } from '@takeone/shared';
import { requireBrand } from '@/lib/session';
import { PageHeader } from '@/components/ui';
import { CampaignWizard } from './wizard';

export default async function NewCampaign() {
  const s = await requireBrand();
  return (
    <>
      <PageHeader title="New campaign" sub="Four steps. Your progress is saved on this device as you go." />
      <CampaignWizard brand={{ id: s.brand.id, country: s.brand.country, currency: s.brand.currency }} includedVariants={LICENSE_DEFAULTS.baseIncludedVariants} />
    </>
  );
}
