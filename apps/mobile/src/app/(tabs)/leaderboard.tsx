import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, displayMoney, earningsBand, rankBrands, rankCreators } from '@takeone/shared';
import { Avatar, Badge, Chip, Empty, ErrorState, Row, Skeleton, Text } from '@/components/ui';
import { useFx, useMe, useUid } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

interface Row_ { creator_id: string; display_name: string; country: string; categories: string[]; joined_at: string; is_pro: boolean; wins: number; submissions: number; campaigns_completed: number; rating_avg: number | null; rating_count: number; month_wins: number; month_submissions: number; month_completed: number; earnings_exact: boolean; month_earnings_usd_minor: number; total_earnings_usd_minor: number }

export default function Leaderboard() {
  const c = useColors();
  const uid = useUid();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const { data: fx } = useFx();
  const [board, setBoard] = useState<'creators' | 'rising' | 'brands'>('creators');
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [mine, setMine] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['leaderboard'], queryFn: async () => { const { data, error } = await supabase.from('leaderboard_creators').select('*'); if (error) throw new Error(error.message); return (data ?? []) as Row_[]; } });
  const brands = useQuery({ queryKey: ['leaderboard-brands'], enabled: board === 'brands', queryFn: async () => (await supabase.from('leaderboard_brands').select('*')).data ?? [] });
  const viewer = me?.profile.currency ?? 'USD';
  const byId = useMemo(() => new Map((q.data ?? []).map((r) => [r.creator_id, r])), [q.data]);
  const ranked = useMemo(() => rankCreators((q.data ?? []).map((r) => ({
    creatorId: r.creator_id, wins: period === 'month' ? r.month_wins : r.wins, submissions: period === 'month' ? r.month_submissions : r.submissions, campaignsCompleted: period === 'month' ? r.month_completed : r.campaigns_completed,
    ratingAvg: r.rating_avg === null ? null : Number(r.rating_avg), ratingCount: r.rating_count, joinedAt: r.joined_at, country: r.country, categories: r.categories,
  })), { country: mine ? me?.profile.country : undefined, category: category ?? undefined, risingStars: board === 'rising' }), [q.data, period, mine, category, board, me?.profile.country]);
  const rankedBrands = useMemo(() => rankBrands((brands.data ?? []).map((b) => ({ brandId: b.brand_id as string, campaignsRun: b.campaigns_run as number, avgApprovalHours: b.avg_approval_hours === null ? null : Number(b.avg_approval_hours), avgPaymentHours: b.avg_payment_hours === null ? null : Number(b.avg_payment_hours) }))), [brands.data]);
  const brandName = new Map((brands.data ?? []).map((b) => [b.brand_id as string, b.name as string]));

  const header = (
    <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 12, paddingBottom: 12 }}>
      <Text size="xl" weight="bold">Leaderboard</Text>
      <Text size="sm" tone="muted">Ranked by win rate, completed campaigns and brand rating. Never by followers.</Text>
      <Row gap={8}>{([['creators', 'Creators'], ['rising', 'Rising Stars'], ['brands', 'Brands']] as const).map(([k, l]) => <Chip key={k} label={l} on={board === k} onPress={() => setBoard(k)} />)}</Row>
      {board !== 'brands' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label={period === 'month' ? 'This month' : 'All-time'} on onPress={() => setPeriod(period === 'month' ? 'all' : 'month')} />
          <Chip label={mine ? `My country (${me?.profile.country ?? ''})` : 'All countries'} on={mine} onPress={() => setMine(!mine)} />
          {CATEGORIES.slice(0, 6).map((k) => <Chip key={k} label={k} on={category === k} onPress={() => setCategory(category === k ? null : k)} />)}
        </ScrollView>
      )}
    </View>
  );
  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: c.bg }}>{header}<View style={{ paddingHorizontal: 20, gap: 10 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={64} />)}</View></View>;
  if (q.error) return <View style={{ flex: 1, backgroundColor: c.bg }}>{header}<ErrorState error={q.error} retry={() => q.refetch()} /></View>;
  if (board === 'brands') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <FlashList data={rankedBrands} keyExtractor={(b) => b.brandId} ListHeaderComponent={header} ListEmptyComponent={<Empty title="No brands yet" />}
          renderItem={({ item: b }) => (
            <Row gap={12} style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
              <Text weight="bold" size="lg" tone={b.rank <= 3 ? 'accent' : 'muted'} style={{ width: 30 }}>{b.rank}</Text>
              <Avatar name={brandName.get(b.brandId) ?? 'Brand'} />
              <View style={{ flex: 1 }}><Text weight="semibold">{brandName.get(b.brandId)}</Text><Text size="xs" tone="muted">{b.campaignsRun} campaigns · approves in {b.avgApprovalHours === null ? '—' : `${Math.round(b.avgApprovalHours)}h`} · pays in {b.avgPaymentHours === null ? '—' : `${Math.round(b.avgPaymentHours)}h`}</Text></View>
            </Row>
          )} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlashList data={ranked} keyExtractor={(r) => r.creatorId} ListHeaderComponent={header} ListEmptyComponent={<Empty title="No creators match" body={board === 'rising' ? 'Rising Stars joined in the last 90 days.' : 'Try another filter.'} />}
        renderItem={({ item: r }) => {
          const row = byId.get(r.creatorId)!;
          const amount = period === 'month' ? row.month_earnings_usd_minor : row.total_earnings_usd_minor;
          const isMe = r.creatorId === uid;
          return (
            <Row gap={12} style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: isMe ? `${c.accent}1A` : 'transparent' }}>
              <Text weight="bold" size="lg" tone={r.rank <= 3 ? 'accent' : 'muted'} style={{ width: 30, fontVariant: ['tabular-nums'] }}>{r.rank}</Text>
              <Avatar name={row.display_name} />
              <View style={{ flex: 1, gap: 2 }}>
                <Row gap={6}><Text weight="semibold" numberOfLines={1}>{row.display_name}</Text>{isMe && <Badge tone="accent" label="You" />}{row.is_pro && !isMe && <Badge tone="accent" label="Pro" />}</Row>
                <Row gap={8}><Text size="xs" tone="muted">{Math.round(r.winRate * 100)}% win · {r.campaignsCompleted} done</Text><Row gap={2}><Star size={10} color={c.warn} fill={c.warn} /><Text size="xs" tone="muted">{r.ratingAvg?.toFixed(1) ?? '—'}</Text></Row></Row>
              </View>
              <Text size="xs" weight="medium" tone="muted">{row.earnings_exact ? displayMoney(amount, 'USD', viewer, fx) : earningsBand(amount, 'USD', viewer, fx)}</Text>
            </Row>
          );
        }} />
    </View>
  );
}
