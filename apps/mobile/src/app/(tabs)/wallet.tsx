import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, Clock, Lock } from 'lucide-react-native';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMoney, sumBalances, TIERS, type LedgerEntry, type Withdrawal } from '@takeone/shared';
import { Badge, Button, Card, Empty, ErrorState, Row, Skeleton, Text } from '@/components/ui';
import { fmtDate, useMe, useUid } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

export function useLedger() {
  const uid = useUid();
  return useQuery({
    queryKey: ['ledger', uid], enabled: !!uid,
    queryFn: async () => {
      const [{ data: entries, error }, { data: withdrawals }] = await Promise.all([
        supabase.from('ledger_entries').select('*').eq('creator_id', uid).order('created_at', { ascending: false }),
        supabase.from('withdrawals').select('*').eq('creator_id', uid).order('created_at', { ascending: false }),
      ]);
      if (error) throw new Error(error.message);
      return { entries: (entries ?? []).map((e) => ({ ...e, amount_minor: Number(e.amount_minor) })) as LedgerEntry[], withdrawals: (withdrawals ?? []).map((w) => ({ ...w, amount_minor: Number(w.amount_minor) })) as Withdrawal[] };
    },
  });
}

export default function Wallet() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const q = useLedger();
  const currency = me?.profile.currency ?? 'USD';
  const money = (m: number) => formatMoney(m, currency);
  const b = useMemo(() => sumBalances(q.data?.entries ?? []), [q.data]);
  const delay = TIERS[me?.isPro ? 'pro' : 'free'].payoutDelayDays;

  // monthly statement: what cleared in each month (cleared_at), most recent first
  const months = useMemo(() => {
    const m = new Map<string, { campaign: number; license: number }>();
    for (const e of q.data?.entries ?? []) {
      if (!e.cleared_at) continue;
      const k = e.cleared_at.slice(0, 7);
      const row = m.get(k) ?? { campaign: 0, license: 0 };
      row[e.source] += e.amount_minor;
      m.set(k, row);
    }
    return [...m.entries()].sort((a, b2) => b2[0].localeCompare(a[0]));
  }, [q.data]);
  const history = useMemo(() => [
    ...(q.data?.entries ?? []).filter((e) => e.state !== 'withdrawn' || !e.withdrawal_id).map((e) => ({ id: e.id, at: e.created_at, title: e.description ?? 'Earning', sub: e.source === 'license' ? 'License payment' : 'Campaign fee', amount: e.amount_minor, state: e.state as string, out: false })),
    ...(q.data?.withdrawals ?? []).map((w) => ({ id: w.id, at: w.created_at, title: `Withdrawal · ${w.method.replace('_', ' ').toUpperCase()}`, sub: w.status, amount: w.amount_minor, state: 'withdrawn', out: true })),
  ].sort((a, b2) => b2.at.localeCompare(a.at)), [q.data]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 32, gap: 16 }} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} tintColor={c.muted} />}>
      <Text size="xl" weight="bold">Wallet</Text>
      {q.isLoading ? <><Skeleton height={170} /><Skeleton height={90} /><Skeleton height={200} /></> : q.error ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <>
          <Card style={{ backgroundColor: c.accent, borderColor: c.accent, gap: 6, padding: 20 }}>
            <Text size="sm" style={{ color: 'rgba(255,255,255,0.8)' }}>Available to withdraw</Text>
            <Text weight="bold" style={{ color: '#fff', fontSize: 38, lineHeight: 44, fontVariant: ['tabular-nums'] }}>{money(b.available)}</Text>
            <Button variant="secondary" title="Withdraw" disabled={b.available <= 0} onPress={() => router.push('/withdraw')} textColor="#09090B" style={{ marginTop: 10, backgroundColor: '#fff', borderWidth: 0 }} />
            {me?.creator?.kyc_status !== 'verified' && <Text size="xs" style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>We verify your ID once, before your first withdrawal.</Text>}
          </Card>
          <Row gap={10}>
            <Card style={{ flex: 1, gap: 4 }}><Row gap={5}><Lock size={13} color={c.faint} /><Text size="xs" tone="muted">Pending</Text></Row><Text weight="bold" size="lg">{money(b.pending)}</Text><Text size="xs" tone="faint">In escrow until the brand approves</Text></Card>
            <Card style={{ flex: 1, gap: 4 }}><Row gap={5}><Clock size={13} color={c.faint} /><Text size="xs" tone="muted">Cleared</Text></Row><Text weight="bold" size="lg">{money(b.cleared)}</Text><Text size="xs" tone="faint">Available {delay} days after clearing</Text></Card>
          </Row>
          <Card style={{ gap: 4 }}><Row style={{ justifyContent: 'space-between' }}><Text size="sm" tone="muted">Withdrawn to date</Text><Text weight="semibold">{money(b.withdrawn)}</Text></Row>
            {!me?.isPro && <Text size="xs" tone="accent" onPress={() => router.push('/pro')}>Pro creators are paid 3 days after clearing instead of 14 →</Text>}</Card>

          {months.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text size="sm" tone="muted" weight="semibold">MONTHLY EARNINGS STATEMENT</Text>
              <Card style={{ gap: 12 }}>
                {months.map(([k, m]) => (
                  <Row key={k} style={{ justifyContent: 'space-between' }}>
                    <View><Text weight="medium">{new Date(`${k}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</Text><Text size="xs" tone="faint">Campaigns {money(m.campaign)} · Licenses {money(m.license)}</Text></View>
                    <Text weight="semibold">{money(m.campaign + m.license)}</Text>
                  </Row>
                ))}
                <Text size="xs" tone="faint">Your 75% share after the platform fee.</Text>
              </Card>
            </View>
          )}

          <View style={{ gap: 10 }}>
            <Text size="sm" tone="muted" weight="semibold">TRANSACTIONS</Text>
            {history.length === 0 ? <Empty title="No earnings yet" body="Your first accepted campaign shows up here as pending." /> : (
              <Card style={{ gap: 14 }}>
                {history.map((h) => (
                  <Row key={h.id} gap={12}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>{h.out ? <ArrowUpRight size={16} color={c.muted} /> : <ArrowDownLeft size={16} color={c.ok} />}</View>
                    <View style={{ flex: 1 }}><Text size="sm" weight="medium" numberOfLines={1}>{h.title}</Text><Text size="xs" tone="faint">{h.sub} · {fmtDate(h.at)}</Text></View>
                    <View style={{ alignItems: 'flex-end', gap: 3 }}><Text size="sm" weight="semibold">{h.out ? '−' : '+'}{money(h.amount)}</Text>{!h.out && <Badge tone={h.state === 'available' ? 'ok' : h.state === 'cleared' ? 'accent' : 'muted'} label={h.state} />}</View>
                  </Row>
                ))}
              </Card>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
