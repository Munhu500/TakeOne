import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { PRO_PRICE_USD_MINOR } from '@takeone/shared';
import { Badge, Button, Card, ProgressBar, Row, Screen, Text, toast, toastError } from '@/components/ui';
import { useMe, useMoney } from '@/lib/data';
import { DEMO, rpc, supabase, webApi } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

const PERKS = ['See new campaigns 48 hours before everyone else', 'Unlimited applications (Free: 3 a week)', 'Paid 3 days after clearing instead of 14', 'Multilingual Voice: your review in Hindi, Tamil, Telugu or Arabic, in your own voice', 'Win Predictor: a score for every variant and AI rewrites for weak hooks', '60-day guarantee: do your part and land a paid campaign, or Pro is free until you do'];
interface Criterion { key: string; label: string; met: boolean; current?: number; target?: number }

export default function Pro() {
  const c = useColors();
  const qc = useQueryClient();
  const money = useMoney();
  const { data: me } = useMe();
  const [busy, setBusy] = useState(false);
  const price = useQuery({ queryKey: ['pro-price'], queryFn: async () => Number((await supabase.from('settings').select('value').eq('key', 'pro_price_usd_minor').maybeSingle()).data?.value ?? PRO_PRICE_USD_MINOR) });
  const g = useQuery({ queryKey: ['guarantee'], enabled: !!me?.isPro && !me.creator?.is_founding, queryFn: () => rpc<{ criteria: Criterion[]; tracking: { window_start: string; eligible: boolean; free_months_issued: number } }>('my_guarantee') });
  const done = async (msg: string) => { await qc.invalidateQueries({ queryKey: ['me'] }); toast(msg); };

  async function upgrade() {
    setBusy(true);
    try {
      if (DEMO) { await rpc('activate_pro'); await done('Welcome to Pro.'); return; }
      const r = await webApi<{ url: string }>('/api/mobile/pro-checkout', {});
      await WebBrowser.openBrowserAsync(r.url); // Stripe Checkout; the webhook activates Pro
      await done('Thanks. Pro activates as soon as the payment confirms.');
    } catch (e) { toastError(e); } finally { setBusy(false); }
  }
  const met = g.data?.criteria.filter((x) => x.met).length ?? 0;
  const dayN = g.data ? Math.min(60, Math.max(1, Math.ceil((Date.now() - new Date(g.data.tracking.window_start).getTime()) / 86_400_000))) : 0;
  return (
    <Screen edges={false} footer={me?.isPro ? undefined : <Button title={`Go Pro · ${money(price.data ?? PRO_PRICE_USD_MINOR, 'USD')} / month`} loading={busy} onPress={upgrade} />}>
      <View style={{ gap: 6 }}>
        {me?.isPro ? <Badge tone="accent" label={me.creator?.is_founding ? 'Founding creator · Pro free for life' : 'You are on Pro'} /> : null}
        <Text size="xl" weight="bold">{me?.isPro ? 'Your Pro benefits' : 'Get picked first.'}</Text>
        {!me?.isPro && <Text tone="muted">Billed monthly in your local currency. Cancel any time.</Text>}
      </View>
      <Card style={{ gap: 12 }}>{PERKS.map((p) => <Row key={p} gap={10} style={{ alignItems: 'flex-start' }}><Check size={16} color={c.ok} style={{ marginTop: 2 }} /><Text size="sm" style={{ flex: 1 }}>{p}</Text></Row>)}</Card>
      {g.data && (
        <Card style={{ gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}><Text weight="semibold">60-day guarantee</Text><Text size="sm" tone="muted">Day {dayN} of 60</Text></Row>
          <ProgressBar value={met / g.data.criteria.length} tone={met === g.data.criteria.length ? 'ok' : 'accent'} />
          <Text size="xs" tone="muted">{met} of {g.data.criteria.length} rules met. Meet them all and if no paid campaign lands in 60 days, your next Pro month is free until one does.</Text>
          {g.data.criteria.map((k) => (
            <Row key={k.key} gap={10}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: k.met ? c.ok : c.raised, alignItems: 'center', justifyContent: 'center' }}>{k.met && <Check size={12} color="#fff" />}</View>
              <Text size="sm" tone={k.met ? 'fg' : 'muted'} style={{ flex: 1 }}>{k.label}</Text>
              {k.target !== undefined && <Text size="xs" tone="faint">{k.current}/{k.target}</Text>}
            </Row>
          ))}
          {g.data.tracking.free_months_issued > 0 && <Text size="xs" tone="ok">{g.data.tracking.free_months_issued} free month(s) issued so far.</Text>}
        </Card>
      )}
      {me?.isPro && !me.creator?.is_founding && me.creator?.tier === 'pro' && <Button variant="ghost" small title="Cancel Pro" onPress={async () => { try { await rpc('cancel_pro'); await done('Pro cancelled.'); router.back(); } catch (e) { toastError(e); } }} />}
    </Screen>
  );
}
