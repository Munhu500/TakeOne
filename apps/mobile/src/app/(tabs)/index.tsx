import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Check, Clock, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Avatar, Badge, Button, Empty, ErrorState, Row, Skeleton, Text, toast, toastError } from '@/components/ui';
import { useApply, useFeed, useMyApplications, useWeeklyQuota, type FeedCampaign } from '@/lib/campaigns';
import { daysLeft, useMoney } from '@/lib/data';
import { publicUrl } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

function CampaignCard({ item, height, applied, onApply, applying, blocked }: { item: FeedCampaign; height: number; applied: boolean; onApply: () => void; applying: boolean; blocked: boolean }) {
  const insets = useSafeAreaInsets();
  const money = useMoney();
  const early = !!item.early_access_until && new Date(item.early_access_until) > new Date();
  const left = daysLeft(item.deadline);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.brands.name}`} onPress={() => router.push(`/campaign/${item.id}`)} style={{ height, width: '100%', backgroundColor: '#000', overflow: 'hidden' }}>
      <Image source={publicUrl(item.product_images[0])} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent', 'transparent', 'rgba(0,0,0,0.92)']} locations={[0, 0.22, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ paddingTop: insets.top + 56, paddingHorizontal: 20 }}>
        <Row gap={10}>
          <Avatar name={item.brands.name} size={38} />
          <View style={{ flex: 1 }}><Text weight="semibold" style={{ color: '#fff' }}>{item.brands.name}</Text><Text size="xs" style={{ color: 'rgba(255,255,255,0.75)', textTransform: 'capitalize' }}>{item.categories.join(' · ')}</Text></View>
          {early && <Badge tone="accent" label="Pro early access" icon={<Sparkles size={11} color="#7C5CFF" />} />}
        </Row>
      </View>
      <Animated.View entering={FadeIn.duration(250)} style={{ position: 'absolute', left: 20, right: 20, bottom: 22, gap: 12 }}>
        <Text size="xl" weight="bold" style={{ color: '#fff' }}>{item.title}</Text>
        <Text size="sm" numberOfLines={2} style={{ color: 'rgba(255,255,255,0.8)' }}>{item.brief.description}</Text>
        <Row gap={18}>
          <View><Text size="xs" style={{ color: 'rgba(255,255,255,0.65)' }}>You earn</Text><Text size="xl" weight="bold" style={{ color: '#fff', fontVariant: ['tabular-nums'] }}>{money(Math.floor((Number(item.fee_per_creator_minor) * 3) / 4), item.currency)}</Text></View>
          <View><Text size="xs" style={{ color: 'rgba(255,255,255,0.65)' }}>Deadline</Text><Row gap={5}><Clock size={14} color="#fff" /><Text weight="semibold" style={{ color: '#fff' }}>{left} days</Text></Row></View>
          <View><Text size="xs" style={{ color: 'rgba(255,255,255,0.65)' }}>Deliver</Text><Text weight="semibold" style={{ color: '#fff' }}>One take</Text></View>
        </Row>
        {applied ? <Button title="Applied" variant="secondary" icon={<Check size={16} color="#34D399" />} onPress={() => router.push(`/campaign/${item.id}`)} /> : <Button title={blocked ? 'Weekly limit reached · Go Pro' : 'Apply'} loading={applying} onPress={onApply} />}
      </Animated.View>
    </Pressable>
  );
}

export default function Feed() {
  const c = useColors();
  const { height: win } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // each card fills exactly the space above the tab bar
  const [height, setHeight] = useState(win - 60 - insets.bottom);
  const feed = useFeed();
  const apps = useMyApplications();
  const quota = useWeeklyQuota();
  const apply = useApply();
  const [pending, setPending] = useState<string | null>(null);
  const appliedIds = new Set((apps.data ?? []).map((a) => a.campaign_id));
  const blocked = !quota.isPro && quota.left === 0;

  const onApply = (id: string) => {
    if (blocked) return router.push('/pro');
    setPending(id);
    apply.mutate({ campaignId: id }, { onSuccess: () => toast('Applied. The brand will see your profile and stats.'), onError: toastError, onSettled: () => setPending(null) });
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }} onLayout={(e) => setHeight(Math.round(e.nativeEvent.layout.height))}>
      {feed.isLoading ? (
        <View style={{ flex: 1, padding: 20, paddingTop: insets.top + 60, gap: 14, justifyContent: 'flex-end' }}><Skeleton height={28} width="70%" /><Skeleton height={16} /><Skeleton height={50} /></View>
      ) : feed.error ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ErrorState error={feed.error} retry={() => feed.refetch()} /></View>
      ) : (
        <FlashList
          data={feed.data}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <CampaignCard item={item} height={height} applied={appliedIds.has(item.id)} applying={pending === item.id} blocked={blocked} onApply={() => onApply(item.id)} />}
          pagingEnabled snapToInterval={height} decelerationRate="fast" showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => { void feed.refetch(); }} tintColor="#fff" />}
          ListEmptyComponent={<View style={{ height, justifyContent: 'center' }}><Empty title="No open campaigns right now" body="New campaigns for your country and categories appear here. Pro creators see them 48 hours early." action={<Button small variant="secondary" title="Edit categories" onPress={() => router.push('/(tabs)/profile')} />} /></View>}
        />
      )}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text size="lg" weight="bold" style={{ color: '#fff' }}>TakeOne</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/pro')} style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text size="xs" weight="medium" style={{ color: '#fff' }}>{quota.isPro ? 'Pro · unlimited applications' : `${quota.left} of ${quota.limit} applications left this week`}</Text>
        </Pressable>
      </View>
    </View>
  );
}
