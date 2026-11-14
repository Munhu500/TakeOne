import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as AuthSession from 'expo-auth-session';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, CircleCheck, CircleDashed } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { PLATFORMS, socialAccountSchema, VERIFICATION_BADGES, type SocialAccount, type SocialPlatform } from '@takeone/shared';
import { Badge, Button, Card, Chip, Field, Row, Screen, Skeleton, Text, toast, toastError } from '@/components/ui';
import { useUid } from '@/lib/data';
import { STATIC_PREVIEW, supabase, webApi } from '@/lib/supabase';
import { uploadResumable } from '@/lib/upload';
import { useColors } from '@/lib/theme';

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE = { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth', tokenEndpoint: 'https://oauth2.googleapis.com/token' };

/** Layered trust: ownership code → screen recording of live insights → public cross-check → (YouTube) verified via API. */
export default function Socials() {
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const uid = useUid();
  const c = useColors();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['socials', uid], enabled: !!uid, refetchInterval: 6000, queryFn: async () => ((await supabase.from('social_accounts').select('*').eq('creator_id', uid).order('created_at')).data ?? []) as SocialAccount[] });
  const [platform, setPlatform] = useState<SocialPlatform>('instagram');
  const [f, setF] = useState({ handle: '', followers: '', avg_views: '', engagement_rate: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [recording, setRecording] = useState<{ id: string; code: string; startedAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!recording) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [recording]);
  const linked = new Set((q.data ?? []).map((s) => s.platform));
  const refresh = () => qc.invalidateQueries({ queryKey: ['socials', uid] });
  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn(); await refresh(); } catch (e) { toastError(e); } finally { setBusy(null); } };

  const add = () => run('add', async () => {
    const p = socialAccountSchema.safeParse({ platform, handle: f.handle.trim().replace(/^@/, ''), followers: Number(f.followers), avg_views: Number(f.avg_views), engagement_rate: Number(f.engagement_rate) });
    if (!p.success) throw new Error(p.error.issues[0]?.message ?? 'Check the numbers');
    const { error } = await supabase.from('social_accounts').insert({ creator_id: uid, ...p.data });
    if (error) throw new Error(error.message.includes('duplicate') ? `You already linked ${platform}` : error.message);
    setF({ handle: '', followers: '', avg_views: '', engagement_rate: '' });
    toast('Linked. Verify it to earn a badge brands can see.');
  });
  const requestOwnership = (s: SocialAccount) => run(`own-${s.id}`, async () => {
    // Demo: an admin approves from the console. Hook: replace with an automated bio/story check.
    const { error } = await supabase.from('social_accounts').update({ ownership_requested_at: new Date().toISOString() }).eq('id', s.id);
    if (error) throw new Error(error.message);
    toast('Sent for review. Keep the code in your bio until it’s approved.');
  });
  const uploadRecording = (s: SocialAccount) => run(`rec-${s.id}`, async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const path = `${uid}/${s.platform}-insights-${Date.now()}.mp4`;
    await uploadResumable('verification', path, r.assets[0].uri, 'video/mp4');
    const { error } = await supabase.from('social_accounts').update({ screen_recording_path: path, screen_recording_code: recording?.code ?? null, ownership_requested_at: new Date().toISOString() }).eq('id', s.id);
    if (error) throw new Error(error.message);
    setRecording(null);
    toast('Recording uploaded for review.');
  });
  const [, , promptYouTube] = AuthSession.useAuthRequest({ clientId: GOOGLE_CLIENT_ID ?? 'missing', scopes: ['https://www.googleapis.com/auth/youtube.readonly'], redirectUri: AuthSession.makeRedirectUri({ scheme: 'takeone' }), usePKCE: true, responseType: AuthSession.ResponseType.Code }, GOOGLE);
  const connectYouTube = () => run('yt', async () => {
    if (STATIC_PREVIEW) throw new Error('YouTube API verification is available in the full deployment.');
    if (!GOOGLE_CLIENT_ID) throw new Error('YouTube connection needs a Google OAuth client ID (EXPO_PUBLIC_GOOGLE_CLIENT_ID). See the README.');
    const res = await promptYouTube();
    if (res.type !== 'success') return;
    await webApi('/api/mobile/youtube', { code: res.params.code, redirect_uri: AuthSession.makeRedirectUri({ scheme: 'takeone' }) });
    toast('YouTube verified via API.');
  });

  return (
    <Screen edges={false} footer={onboarding ? <Button title={(q.data ?? []).length ? 'Continue' : 'Skip for now'} onPress={() => router.replace('/likeness?onboarding=1')} /> : undefined}>
      <Text tone="muted">Brands see your handle, your stats and a trust badge. They never see your contact details.</Text>
      {q.isLoading && <Skeleton height={120} />}
      {(q.data ?? []).map((s) => {
        const Icon = s.verification === 'api_verified' ? BadgeCheck : s.verification === 'checked' ? CircleCheck : CircleDashed;
        const pending = !!s.ownership_requested_at && s.verification === 'self_reported';
        return (
          <Card key={s.id} style={{ gap: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View><Text weight="semibold" style={{ textTransform: 'capitalize' }}>{s.platform}</Text><Text size="sm" tone="muted">@{s.handle} · {s.followers.toLocaleString()} followers</Text></View>
              <Badge tone={s.verification === 'api_verified' ? 'ok' : s.verification === 'checked' ? 'accent' : 'muted'} icon={<Icon size={11} color={s.verification === 'self_reported' ? c.muted : s.verification === 'checked' ? c.accent : c.ok} />} label={VERIFICATION_BADGES[s.verification]} />
            </Row>
            {s.flags.length > 0 && <Text size="xs" tone="warn">Your numbers look different from what’s public ({s.flags.join(', ').replace(/_/g, ' ')}). A screen recording of your insights clears this up.</Text>}
            {s.verification === 'self_reported' && (
              <>
                <View style={{ backgroundColor: c.raised, borderRadius: 12, padding: 12, gap: 4 }}>
                  <Text size="xs" tone="muted">1 · Put this code in your bio or a story, then tap Verify</Text>
                  <Text weight="bold" size="lg" style={{ letterSpacing: 2 }}>{s.ownership_code}</Text>
                </View>
                {recording?.id === s.id && (
                  <View style={{ backgroundColor: c.raised, borderRadius: 12, padding: 12, gap: 4, borderWidth: 1, borderColor: c.accent }}>
                    <Text size="xs" tone="muted">2 · Start your phone’s screen recording now with this stamp visible, open your {s.platform} insights live, then come back and upload.</Text>
                    <Text weight="bold" size="lg" style={{ letterSpacing: 2 }}>{recording.code}</Text>
                    <Text size="sm" tone="accent" style={{ fontVariant: ['tabular-nums'] }}>{new Date(now).toISOString().replace('T', ' ').slice(0, 19)} UTC</Text>
                  </View>
                )}
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  <Button small title={pending ? 'Awaiting review' : 'Verify code'} disabled={pending} loading={busy === `own-${s.id}`} onPress={() => requestOwnership(s)} />
                  {recording?.id === s.id
                    ? <Button small variant="secondary" title="Upload recording" loading={busy === `rec-${s.id}`} onPress={() => uploadRecording(s)} />
                    : <Button small variant="secondary" title={s.screen_recording_path ? 'Re-record insights' : 'Record insights'} onPress={() => setRecording({ id: s.id, code: `T1-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, startedAt: Date.now() })} />}
                  {s.platform === 'youtube' && <Button small variant="secondary" title="Connect via YouTube API" loading={busy === 'yt'} onPress={connectYouTube} />}
                </Row>
              </>
            )}
          </Card>
        );
      })}
      {PLATFORMS.some((p) => !linked.has(p)) && (
        <Card style={{ gap: 12 }}>
          <Text weight="semibold">Link an account</Text>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>{PLATFORMS.filter((p) => !linked.has(p)).map((p) => <Chip key={p} label={p} on={platform === p} onPress={() => setPlatform(p)} />)}</Row>
          <Field label="Handle" value={f.handle} onChangeText={(t) => setF({ ...f, handle: t })} autoCapitalize="none" placeholder="@yourhandle" />
          <Row gap={10}>
            <View style={{ flex: 1 }}><Field label="Followers" value={f.followers} onChangeText={(t) => setF({ ...f, followers: t.replace(/\D/g, '') })} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Avg views" value={f.avg_views} onChangeText={(t) => setF({ ...f, avg_views: t.replace(/\D/g, '') })} keyboardType="number-pad" /></View>
          </Row>
          <Field label="Engagement rate (%)" value={f.engagement_rate} onChangeText={(t) => setF({ ...f, engagement_rate: t.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" hint="Claimed numbers are cross-checked against public data." />
          <Button title={`Link ${platform}`} disabled={!f.handle || !f.followers} loading={busy === 'add'} onPress={add} />
        </Card>
      )}
    </Screen>
  );
}
