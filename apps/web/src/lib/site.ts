/** Public address of the site. Override with NEXT_PUBLIC_SITE_URL per environment. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lm-softwaresolutions.com').replace(/\/$/, '');
export const siteHost = () => new URL(SITE_URL).hostname.replace(/^www\./, '');
export const AGENCY_HOST_TAG = 'agency-host';
