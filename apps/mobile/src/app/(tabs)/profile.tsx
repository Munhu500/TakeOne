import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight, Star } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { CATEGORIES, COUNTRIES } from '@takeone/shared';
import { Avatar, Badge, Button, Card, Chip, Field, Row, Screen, Skeleton, Text, toast, toastError } from '@/components/ui';
import { useAuth, useMe, useUid } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { themePref, useColors } from '@/lib/theme';

function Link({ title, sub, onPress, right }: { title: string; sub?: string; onPress: () => void; right?: React.ReactNode }) {
  const c = useColors();
  return <Pressable accessibilityRole="button" onPress={onPress}><Row gap={10} style={{ paddingVertical: 4 }}><View style={{ flex: 1 }}><Text weight="medium">{title}</Text>{sub && <Text size="xs" tone="muted">{sub}</Text>}</View>{right}<ChevronRight size={18} color={c.faint} /></Row></Pressable>;
}

export default function Profile() {
  const c = useColors();
  const uid = useUid();
  const qc = useQueryClient();
  const { session } = useAuth();
  const me = useMe();
  const theme = themePref.use();
  const [bio, setBio] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const socials = useQuery({ queryKey: ['socials', uid], enabled: !!uid, queryFn: async () => (await supabase.from('social_accounts').select('*').eq('creator_id', uid)).data ?? [] });
  const likeness = useQuery({ queryKey: ['likeness', uid], enabled: !!uid, queryFn: async () => (await supabase.from('likeness_profiles').select('status').eq('creator_id', uid).maybeSingle()).data });
  useEffect(() => { if (me.data?.creator) { setBio(me.data.creator.bio ?? ''); setCats(me.data.creator.categories); } }, [me.data?.creator]);
  if (me.isLoading || !me.data) return <Screen><Skeleton height={90} /><Skeleton height={160} /><Skeleton height={200} /></Screen>;
  const { profile, creator, isPro } = me.data;
  const dirty = bio !== (creator?.bio ?? '') || cats.join() !== (creator?.categories ?? []).join();

  async function patch(values: Record<string, unknown>, msg?: string) {
    setSaving(true);
    const { error } = await supabase.from('creators').update(values).eq('profile_id', uid);
    setSaving(false);
    if (error) return toastError(new Error(error.message));
    await Promise.all([qc.invalidateQueries({ queryKey: ['me'] }), qc.invalidateQueries({ queryKey: ['feed'] })]);
    if (msg) toast(msg);
  }
  return (
    <Screen>
      <Row gap={14}>
        <Avatar name={profile.display_name || 'You'} size={62} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text size="lg" weight="bold">{profile.display_name}</Text>
          <Text size="sm" tone="muted">{COUNTRIES[profile.country as keyof typeof COUNTRIES]?.flag} {COUNTRIES[profile.country as keyof typeof COUNTRIES]?.name} · {profile.currency}</Text>
          <Row gap={6}>{isPro ? <Badge tone="accent" label={creator?.is_founding ? 'Founding · Pro for life' : 'Pro'} /> : <Badge label="Free" />}{creator?.kyc_status === 'verified' && <Badge tone="ok" label="ID verified" />}</Row>
        </View>
      </Row>
      <Row gap={10}>
        <Card style={{ flex: 1, alignItems: 'center' }}><Text weight="bold" size="lg">{Math.round(Number(creator?.win_rate ?? 0) * 100)}%</Text><Text size="xs" tone="muted">Win rate</Text></Card>
        <Card style={{ flex: 1, alignItems: 'center' }}><Text weight="bold" size="lg">{creator?.campaigns_completed ?? 0}</Text><Text size="xs" tone="muted">Completed</Text></Card>
        <Card style={{ flex: 1, alignItems: 'center' }}><Row gap={4}><Star size={14} color={c.warn} fill={c.warn} /><Text weight="bold" size="lg">{creator?.rating_avg ? Number(creator.rating_avg).toFixed(1) : '—'}</Text></Row><Text size="xs" tone="muted">Rating</Text></Card>
      </Row>
      {!isPro && <Card style={{ gap: 8, borderColor: c.accent }}><Text weight="semibold">Go Pro</Text><Text size="sm" tone="muted">48-hour early access, unlimited applications, 3-day payouts, Multilingual Voice and Win Predictor.</Text><Button small title="See Pro" onPress={() => router.push('/pro')} /></Card>}
      <Card style={{ gap: 14 }}>
        {isPro && <Link title="Pro and 60-day guarantee" sub="Benefits and your guarantee progress" onPress={() => router.push('/pro')} />}
        <Link title="Social accounts" sub={`${socials.data?.length ?? 0} linked · ${(socials.data ?? []).filter((s) => s.verification !== 'self_reported').length} verified`} onPress={() => router.push('/socials')} />
        <Link title="Likeness Vault" sub="Your face and voice, used only with your consent" onPress={() => router.push('/likeness')} right={<Badge tone={likeness.data?.status === 'ready' ? 'ok' : 'muted'} label={likeness.data?.status === 'ready' ? 'Ready' : 'Not set up'} />} />
      </Card>
      <Card style={{ gap: 12 }}>
        <Text weight="semibold">About you</Text>
        <Field label="Bio" value={bio} onChangeText={setBio} multiline maxLength={240} placeholder="What you create and who watches" />
        <Text size="sm" tone="muted" weight="medium">Categories (your feed follows these)</Text>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>{CATEGORIES.map((k) => <Chip key={k} label={k} on={cats.includes(k)} onPress={() => setCats(cats.includes(k) ? cats.filter((x) => x !== k) : cats.length < 5 ? [...cats, k] : cats)} />)}</Row>
        {profile.country === 'AE' && <Text size="xs" tone="muted">UAE Advertiser Permit: {creator?.uae_permit_number ?? 'missing'}</Text>}
        {dirty && <Button small title="Save" loading={saving} disabled={!cats.length} onPress={() => patch({ bio, categories: cats }, 'Profile saved.')} />}
      </Card>
      <Card style={{ gap: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Text weight="medium">Show exact earnings on the leaderboard</Text><Text size="xs" tone="muted">Off shows a band, like “$1K+ this month”.</Text></View><Switch accessibilityLabel="Show exact earnings" value={!!creator?.show_exact_earnings} onValueChange={(v) => patch({ show_exact_earnings: v })} trackColor={{ true: c.accent }} /></Row>
        <View style={{ gap: 8 }}><Text weight="medium">Appearance</Text><Row gap={8}>{(['dark', 'light', 'system'] as const).map((t) => <Chip key={t} label={t} on={theme === t} onPress={() => themePref.set(t)} />)}</Row></View>
      </Card>
      <Text size="xs" tone="faint" style={{ textAlign: 'center' }}>{session?.user.email}</Text>
      <Button variant="secondary" title="Sign out" onPress={async () => { await supabase.auth.signOut(); router.replace('/sign-in'); }} />
    </Screen>
  );
}
