import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Badge, Card, Empty, Row, Screen, Skeleton, Text } from '@/components/ui';
import { useMyApplications, useMyAssignments } from '@/lib/campaigns';
import { fmtDate, timeAgo, useUid } from '@/lib/data';
import { supabase } from '@/lib/supabase';

const NEXT: Record<string, { label: string; tone: 'accent' | 'warn' | 'ok' | 'muted' | 'bad' }> = {
  accepted: { label: 'Ready to shoot', tone: 'accent' }, processing: { label: 'Building variants', tone: 'warn' }, variants_ready: { label: 'Review in Studio', tone: 'accent' },
  qa_review: { label: 'In quality review', tone: 'warn' }, delivered: { label: 'With the brand', tone: 'muted' }, approved: { label: 'Approved', tone: 'ok' }, completed: { label: 'Completed', tone: 'ok' }, disputed: { label: 'In dispute', tone: 'bad' },
};

export default function Work() {
  const uid = useUid();
  const assignments = useMyAssignments();
  const apps = useMyApplications();
  const titles = useQuery({
    queryKey: ['app-campaigns', (apps.data ?? []).map((a) => a.campaign_id).join()], enabled: !!apps.data?.length,
    queryFn: async () => new Map(((await supabase.from('campaigns').select('id, title').in('id', apps.data!.map((a) => a.campaign_id))).data ?? []).map((c) => [c.id as string, c.title as string])),
  });
  const notes = useQuery({ queryKey: ['notifications', uid], enabled: !!uid, queryFn: async () => (await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(8)).data ?? [] });
  const assignedIds = new Set((assignments.data ?? []).map((a) => a.campaign_id));
  const open = (apps.data ?? []).filter((a) => !assignedIds.has(a.campaign_id));
  return (
    <Screen>
      <Text size="xl" weight="bold">My work</Text>
      {assignments.isLoading ? <><Skeleton height={90} /><Skeleton height={90} /></> : (
        <View style={{ gap: 10 }}>
          <Text size="sm" tone="muted" weight="semibold">CAMPAIGNS</Text>
          {(assignments.data ?? []).length === 0 && <Empty title="No campaigns yet" body="Apply from the feed. Accepted campaigns show up here with your shot list." />}
          {(assignments.data ?? []).map((a) => {
            const post = a.winning_variant_id && !a.post_url;
            return (
              <Pressable key={a.id} accessibilityRole="button" onPress={() => router.push(a.status === 'accepted' ? `/campaign/${a.campaign_id}` : `/studio/${a.id}`)}>
                <Card style={{ gap: 8 }}>
                  <Row style={{ justifyContent: 'space-between' }}><Text weight="semibold" style={{ flex: 1 }} numberOfLines={1}>{a.campaigns.title}</Text><Badge tone={post ? 'warn' : NEXT[a.status]?.tone} label={post ? 'Post your winning ad' : NEXT[a.status]?.label ?? a.status} /></Row>
                  <Text size="sm" tone="muted">{a.campaigns.brands.name}{a.due_at ? ` · due ${fmtDate(a.due_at)}` : ''}</Text>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}
      {open.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text size="sm" tone="muted" weight="semibold">APPLICATIONS AND INVITES</Text>
          {open.map((a) => (
            <Pressable key={a.id} accessibilityRole="button" onPress={() => router.push(`/campaign/${a.campaign_id}`)}>
              <Card><Row style={{ justifyContent: 'space-between' }}><Text weight="medium" style={{ flex: 1 }} numberOfLines={1}>{titles.data?.get(a.campaign_id) ?? 'Campaign'}</Text><Badge tone={a.status === 'invited' ? 'warn' : a.status === 'shortlisted' ? 'accent' : a.status === 'rejected' ? 'bad' : 'muted'} label={a.status === 'invited' ? 'Invited · respond' : a.status} /></Row><Text size="xs" tone="faint">{timeAgo(a.created_at)}</Text></Card>
            </Pressable>
          ))}
        </View>
      )}
      {(notes.data ?? []).length > 0 && (
        <View style={{ gap: 10 }}>
          <Text size="sm" tone="muted" weight="semibold">UPDATES</Text>
          <Card style={{ gap: 12 }}>{notes.data!.map((n) => <View key={n.id}><Text size="sm" weight="medium">{n.title}</Text><Text size="xs" tone="faint">{n.body ? `${n.body} · ` : ''}{timeAgo(n.created_at)}</Text></View>)}</Card>
        </View>
      )}
    </Screen>
  );
}
