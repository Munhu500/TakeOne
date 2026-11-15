'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { currencyForCountry, type CurrencyCode } from '@takeone/shared';
import { track } from './analytics';

export type Audience = 'creators' | 'brands';
export type Market = 'IN' | 'AE';
const AUDIENCE_KEY = 't1-audience', COUNTRY_KEY = 't1-country';

interface Ctx { audience: Audience; setAudience: (a: Audience) => void; country: Market; setCountry: (c: Market) => void; currency: CurrencyCode }
const MarketingContext = createContext<Ctx | null>(null);

const read = (store: 'session' | 'local', key: string) => { try { return (store === 'session' ? sessionStorage : localStorage).getItem(key); } catch { return null; } };
const write = (store: 'session' | 'local', key: string, v: string) => { try { (store === 'session' ? sessionStorage : localStorage).setItem(key, v); } catch { /* private mode: the choice simply is not remembered */ } };

/**
 * Public-site state: which audience the page is speaking to, and the visitor's country (currency).
 * `preselect` is set by /creators and /brands; on / the last choice in this tab is restored.
 */
export function MarketingProvider({ preselect, children }: { preselect?: Audience; children: ReactNode }) {
  const [audience, setA] = useState<Audience>(preselect ?? 'creators');
  const [country, setC] = useState<Market>('IN');
  useEffect(() => {
    if (preselect) write('session', AUDIENCE_KEY, preselect);
    else { const a = read('session', AUDIENCE_KEY); if (a === 'brands' || a === 'creators') setA(a); }
    const c = read('local', COUNTRY_KEY); if (c === 'IN' || c === 'AE') setC(c);
  }, [preselect]);
  const setAudience = useCallback((a: Audience) => { setA(a); write('session', AUDIENCE_KEY, a); track('audience_toggle', { audience: a }); }, []);
  const setCountry = useCallback((c: Market) => { setC(c); write('local', COUNTRY_KEY, c); track('country_change', { country: c }); }, []);
  const value = useMemo(() => ({ audience, setAudience, country, setCountry, currency: currencyForCountry(country) }), [audience, setAudience, country, setCountry]);
  return <MarketingContext.Provider value={value}>{children}</MarketingContext.Provider>;
}
export function useMarketing(): Ctx {
  const c = useContext(MarketingContext);
  if (!c) throw new Error('useMarketing must be used inside <MarketingProvider>');
  return c;
}
