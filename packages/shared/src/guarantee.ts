import { GUARANTEE } from './config';

export interface GuaranteeInputs {
  profileComplete: boolean;
  socialAccounts: number;
  matchingApplications: number;
  acceptedCampaigns: number;
  onTimeSubmissions: number;
  ratingAvg: number | null;
  invitesReceived: number;
  invitesAnsweredInTime: number;
  duplicateAccountSuspected: boolean;
  country: string;
  uaePermitNumber: string | null;
  paidCampaignsLanded: number;
}
export interface GuaranteeCriterion {
  key: string;
  label: string;
  met: boolean;
  progress?: { current: number; target: number };
}
export interface GuaranteeResult {
  criteria: GuaranteeCriterion[];
  allMet: boolean;
  /** all criteria met AND no paid campaign landed in the window → free Pro month */
  eligible: boolean;
}

export function evaluateGuarantee(i: GuaranteeInputs): GuaranteeResult {
  const criteria: GuaranteeCriterion[] = [
    { key: 'profile', label: 'Complete profile', met: i.profileComplete },
    {
      key: 'socials',
      label: `At least ${GUARANTEE.minSocialAccounts} linked social accounts`,
      met: i.socialAccounts >= GUARANTEE.minSocialAccounts,
      progress: { current: Math.min(i.socialAccounts, GUARANTEE.minSocialAccounts), target: GUARANTEE.minSocialAccounts },
    },
    {
      key: 'applications',
      label: `Applied to ${GUARANTEE.minMatchingApplications} matching campaigns`,
      met: i.matchingApplications >= GUARANTEE.minMatchingApplications,
      progress: { current: Math.min(i.matchingApplications, GUARANTEE.minMatchingApplications), target: GUARANTEE.minMatchingApplications },
    },
    { key: 'on_time', label: 'On-time submission for every accepted campaign', met: i.onTimeSubmissions >= i.acceptedCampaigns },
    { key: 'rating', label: `Rating ${GUARANTEE.minRating.toFixed(1)} or higher`, met: i.ratingAvg === null || i.ratingAvg >= GUARANTEE.minRating },
    { key: 'invites', label: `Responded to invites within ${GUARANTEE.inviteResponseHours}h`, met: i.invitesAnsweredInTime >= i.invitesReceived },
    { key: 'single_account', label: 'One account per person', met: !i.duplicateAccountSuspected },
  ];
  if (i.country === 'AE') {
    criteria.push({ key: 'uae_permit', label: 'UAE Advertiser Permit number on file', met: !!i.uaePermitNumber?.trim() });
  }
  const allMet = criteria.every((c) => c.met);
  return { criteria, allMet, eligible: allMet && i.paidCampaignsLanded === 0 };
}
