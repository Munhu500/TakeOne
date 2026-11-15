/**
 * Analytics hook points. Deliberately a no-op: nothing is collected or sent until a provider is chosen and consent is
 * handled. Wire the provider in here and every call site is covered.
 */
export type AnalyticsEvent = 'audience_toggle' | 'cta_click' | 'waitlist_submit' | 'country_change';
export function track(_event: AnalyticsEvent, _props?: Record<string, string>): void {
  // no-op
}
