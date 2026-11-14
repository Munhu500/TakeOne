import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { MessageCircle, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { LICENSE_DEFAULTS } from '@takeone/shared';
import { Avatar, Badge, Button, Card, ErrorState, Field, Row, Screen, Skeleton, Text, toast, toastError } from '@/components/ui';
import { useApply, useMyApplications, useMyAssignments, useWeeklyQuota, type FeedCampaign } from '@/lib/campaigns';
import { daysLeft, fmtDate, useMoney, useUid } from '@/lib/data';
import { publicUrl, rpc, supabase } from '@/lib/supabase';

function List({ title, items }: { title: string; items: string[] }) {
  if (!items?.filter(Boolean).length) return null;
  return <View style={{ gap: 4 }}><Text size="sm" weight="semibold">{title}</Text>{items.filter(Boolean).map((i) => <Text key={i} size="sm" tone="muted">• {i}</Text>)}</View>;
}

export default function CampaignDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useUid();
  const qc = useQueryClient();
  const money = useMoney();
  const q = useQuery({ queryKey: ['campaign', id], queryFn: async () => { const { data, error } = await supabase.from('campaigns').select('*, brands(name, logo)').eq('id', id).single(); if (error) throw new Error(error.message); return data as unknown as FeedCampaign; } });
  const apps = useMyApplications();
  const assignments = useMyAssignments();
  const quota = useWeeklyQuota();
  const apply = useApply();
  const [pitch, setPitch] = useState('');
  const [busy, setBusy] = useState(false);
  if (q.isLoading) return <Screen><Skeleton height={300} /><Skeleton height={28} width="70%" /><Skeleton height={120} /></Screen>;
  if (q.error || !q.data) return <Screen><ErrorState error={q.error} retry={() => q.refetch()} /></Screen>;
  const c = q.data;
  const app = apps.data?.find((a) => a.campaign_id === id);
  const assignment = assignments.data?.find((a) => a.campaign_id === id);
  const fee = Number(c.fee_per_creator_minor);
  const blocked = !quota.isPro && quota.left === 0;

  async function respond(accept: boolean) {
    setBusy(true);
    try {
      await rpc('respond_invite', { p_application_id: app!.id, p_accept: accept });
      await Promise.all([qc.invalidateQueries({ queryKey: ['applications', uid] }), qc.invalidateQueries({ queryKey: ['assignments', uid] }), qc.invalidateQueries({ queryKey: ['ledger', uid] })]);
      toast(accept ? 'You’re in. Check your shot list.' : 'Invite declined.');
    } catch (e) { toastError(e); } finally { setBusy(false); }
  }
  const footer = assignment ? (
    <Row gap={10}>
      <Button style={{ flex: 1 }} variant="secondary" title="Message" icon={<MessageCircle size={16} color="#A1A1AA" />} onPress={() => router.push(`/chat/${id}`)} />
      <Button style={{ flex: 2 }} title={assignment.status === 'accepted' ? 'Start shoot' : 'Open Studio'} onPress={() => router.push(assignment.status === 'accepted' ? `/shoot/${assignment.id}` : `/studio/${assignment.id}`)} />
    </Row>
  ) : app?.status === 'invited' ? (
    <Row gap={10}><Button style={{ flex: 1 }} variant="secondary" title="Decline" loading={busy} onPress={() => respond(false)} /><Button style={{ flex: 2 }} title="Accept invite" loading={busy} onPress={() => respond(true)} /></Row>
  ) : app ? (
    <Row gap={10}><Button style={{ flex: 1 }} variant="secondary" title="Message" onPress={() => router.push(`/chat/${id}`)} /><Button style={{ flex: 2 }} variant="secondary" disabled title={`Application ${app.status}`} /></Row>
  ) : c.status !== 'live' ? <Button variant="secondary" disabled title="Applications closed" /> : (
    <Button title={blocked ? 'Weekly limit reached · Go Pro' : 'Apply'} loading={apply.isPending} onPress={() => blocked ? router.push('/pro') : apply.mutate({ campaignId: id, pitch }, { onSuccess: () => toast('Applied. The brand will see your profile and stats.'), onError: toastError })} />
  );

  return (
    <Screen padded={false} edges={false} footer={footer}>
      <Image source={publicUrl(c.product_images[0])} style={{ width: '100%', height: 340 }} contentFit="cover" />
      <View style={{ paddingHorizontal: 20, gap: 16 }}>
        <Row gap={10}><Avatar name={c.brands.name} size={36} /><View style={{ flex: 1 }}><Text weight="semibold">{c.brands.name}</Text><Text size="xs" tone="muted" style={{ textTransform: 'capitalize' }}>{c.categories.join(' · ')}</Text></View>{app?.status === 'invited' && <Badge tone="warn" label="Invited · reply within 48h" />}</Row>
        <Text size="xl" weight="bold">{c.title}</Text>
        <Row gap={10}>
          <Card style={{ flex: 1 }}><Text size="xs" tone="muted">You earn</Text><Text size="lg" weight="bold">{money(fee - Math.floor(fee / 4), c.currency)}</Text><Text size="xs" tone="faint">75% of {money(fee, c.currency)}</Text></Card>
          <Card style={{ flex: 1 }}><Text size="xs" tone="muted">Deadline</Text><Text size="lg" weight="bold">{daysLeft(c.deadline)} days</Text><Text size="xs" tone="faint">{fmtDate(c.deadline)}</Text></Card>
        </Row>
        {!quota.isPro && !app && <Text size="xs" tone="muted">{quota.left} of {quota.limit} free applications left this week.</Text>}
        <Card style={{ gap: 12 }}>
          <Text weight="semibold">{c.product_name}</Text>
          <Text size="sm" tone="muted">{c.brief.description}</Text>
          <List title="What to get across" items={c.brief.key_messages} />
          <List title="Must say" items={c.brief.must_say} />
          <List title="Must not say" items={c.brief.must_not_say} />
        </Card>
        <Card style={{ gap: 8 }}>
          <Text weight="semibold">What you deliver</Text>
          <Text size="sm" tone="muted">One vertical take of you using the real product. The Variant Engine cuts it into up to ten ad formats. You choose which ones the brand sees.</Text>
          <Text size="sm" tone="muted">You never post the variants. If the brand picks a winner, you post only that one on your feed.</Text>
        </Card>
        <Card style={{ gap: 8 }}>
          <Text weight="semibold">Usage terms</Text>
          <Text size="sm" tone="muted">The brand can license up to {LICENSE_DEFAULTS.baseIncludedVariants} variants for {LICENSE_DEFAULTS.termDays} days of paid ads on Meta, TikTok and YouTube, plus organic use on its own channels.</Text>
          <Text size="sm" tone="muted">Extra variants, renewals, buyouts and whitelisting are paid add-ons. You get 75% of each.</Text>
        </Card>
        {c.brief.uses_ai_likeness && (
          <Card style={{ gap: 8 }}>
            <Row gap={6}><Sparkles size={16} color="#FBBF24" /><Text weight="semibold">AI likeness used</Text></Row>
            <Text size="sm" tone="muted">This campaign may create an AI scene version and a language version in your cloned voice. Only with your consent for this campaign, always labelled as AI, and never changing your words or verdict.</Text>
          </Card>
        )}
        {assignment && <Card style={{ gap: 10 }}><Text weight="semibold">Your shot list</Text>{c.shot_list.shots.map((s, i) => <View key={i}><Text size="sm" weight="medium">{i + 1}. {s.title} · {s.seconds}s</Text><Text size="sm" tone="muted">{s.direction}</Text></View>)}</Card>}
        {!app && !assignment && c.status === 'live' && <Field label="Add a short pitch (optional)" value={pitch} onChangeText={setPitch} maxLength={400} multiline placeholder="Why you are a good fit" />}
      </View>
    </Screen>
  );
}
