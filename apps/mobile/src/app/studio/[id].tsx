import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Check, Lock, Play, Sparkles, Trophy, Wand2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { FORMAT_LIST, FORMATS, type Assignment, type Job, type Take, type Variant } from '@takeone/shared';
import { Badge, Button, Card, Chip, ErrorState, Field, ProgressBar, Row, Screen, Skeleton, Text, toast, toastError } from '@/components/ui';
import type { FeedCampaign } from '@/lib/campaigns';
import { useMe, useUid } from '@/lib/data';
import { rpc, signMany, STATIC_PREVIEW, supabase, webApi } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

function Player({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.play(); });
  return <VideoView player={player} style={{ width: '100%', aspectRatio: 9 / 16, borderRadius: 16, backgroundColor: '#000' }} contentFit="cover" nativeControls />;
}

const STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'accent' | 'bad' | 'muted' }> = {
  qa_pending: { label: 'In quality review', tone: 'warn' }, qa_rejected: { label: 'Needs changes', tone: 'bad' }, delivered: { label: 'With the brand', tone: 'accent' },
  licensed: { label: 'Licensed by the brand', tone: 'ok' }, processing: { label: 'Rendering', tone: 'warn' }, failed: { label: 'Failed', tone: 'bad' },
};

export default function Studio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useUid();
  const c = useColors();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [postUrl, setPostUrl] = useState('');

  const q = useQuery({
    queryKey: ['studio', id], enabled: !!uid,
    refetchInterval: (query) => { const d = query.state.data; return d && (d.assignment.status === 'processing' || d.variants.some((v) => v.status === 'processing')) ? 3000 : false; },
    queryFn: async () => {
      const { data: assignment, error } = await supabase.from('assignments').select('*, campaigns(*, brands(name, logo))').eq('id', id).single();
      if (error) throw new Error(error.message);
      const { data: take } = await supabase.from('takes').select('*').eq('assignment_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const [{ data: variants }, { data: jobs }] = take
        ? await Promise.all([supabase.from('variants').select('*').eq('take_id', take.id), supabase.from('jobs').select('*').eq('payload->>take_id', take.id).order('created_at', { ascending: false })])
        : [{ data: [] }, { data: [] }];
      const vs = (variants ?? []) as Variant[];
      const urls = await signMany('variants', vs.flatMap((v) => [v.thumbnail ?? '', v.renditions['9:16'] ?? '']));
      return { assignment: assignment as unknown as Assignment & { campaigns: FeedCampaign }, take: take as Take | null, variants: vs, jobs: (jobs ?? []) as Job[], urls };
    },
  });
  const ready = (q.data?.variants ?? []).filter((v) => ['ready', 'qa_rejected'].includes(v.status));
  // every variant is pre-selected the first time it becomes ready; the creator unticks what the brand should not see
  const [seen, setSeen] = useState<Set<string>>(new Set());
  useEffect(() => {
    const fresh = ready.filter((v) => !seen.has(v.id));
    if (!fresh.length) return;
    setSeen(new Set([...seen, ...fresh.map((v) => v.id)]));
    setPicked(new Set([...(picked ?? []), ...fresh.map((v) => v.id)]));
  }, [ready.map((v) => v.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) return <Screen edges={false}><Skeleton height={24} width="60%" /><Skeleton height={320} /><Skeleton height={120} /></Screen>;
  if (q.error || !q.data) return <Screen edges={false}><ErrorState error={q.error} retry={() => q.refetch()} /></Screen>;
  const { assignment, take, variants, jobs, urls } = q.data;
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['studio', id] }), qc.invalidateQueries({ queryKey: ['assignments', uid] })]);
  const processJob = jobs.find((j) => j.type === 'process_take');
  const built = [...variants].filter((v) => v.status !== 'coming_soon').sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const builtFormats = new Set(built.map((v) => v.format));
  const canSubmit = assignment.status === 'variants_ready';
  const winner = variants.find((v) => v.id === assignment.winning_variant_id);

  async function act(key: string, fn: () => Promise<unknown>, done?: string) {
    setBusy(key);
    try { await fn(); await refresh(); if (done) toast(done); } catch (e) { toastError(e); } finally { setBusy(null); }
  }
  const rewrite = (v: Variant) => act(`rw-${v.id}`, async () => {
    // static preview has no API server: build the options locally from the creator's own sentences (same rule as the mock provider)
    const local = () => (take?.transcript?.segments ?? []).map((s) => s.text.replace(/^(?:(?:okay|ok|so|um|uh|well|honestly)[,\s]+)+/i, '').replace(/[.!?]+$/, '').split(/\s+/).slice(0, 7).join(' ').replace(/[,;:]$/, '')).filter((h) => h && !v.hook_options.includes(h)).slice(0, 3);
    const hooks = STATIC_PREVIEW ? local() : (await webApi<{ hooks: string[] }>('/api/mobile/rewrite-hook', { variant_id: v.id })).hooks;
    if (!hooks.length) throw new Error('No further rewrites available for this take.');
    await rpc('add_hook_options', { p_variant_id: v.id, p_hooks: hooks });
  }, 'New hook options added. Pick one to re-render.');

  return (
    <Screen edges={false} footer={canSubmit ? <Button title={`Submit ${picked?.size ?? 0} variant${picked?.size === 1 ? '' : 's'} to ${assignment.campaigns.brands.name}`} disabled={!picked?.size || built.some((v) => v.status === 'processing')} loading={busy === 'submit'}
      onPress={() => act('submit', async () => { const r = await rpc<string>('submit_variants', { p_assignment_id: id, p_variant_ids: [...picked!] }); toast(r === 'qa_review' ? 'Submitted. A quick quality review comes first.' : 'Delivered to the brand.'); })} /> : undefined}>
      <View style={{ gap: 4 }}><Text size="sm" tone="muted">{assignment.campaigns.brands.name}</Text><Text size="lg" weight="bold">{assignment.campaigns.title}</Text></View>

      {!take && <Card style={{ gap: 10 }}><Text weight="semibold">No take yet</Text><Text size="sm" tone="muted">Shoot your one take to start the Variant Engine.</Text><Button title="Start shoot" onPress={() => router.push(`/shoot/${id}`)} /></Card>}

      {take && take.product_check === 'failed' && (
        <Card style={{ gap: 10, borderColor: c.bad }}>
          <Text weight="semibold" tone="bad">We couldn’t clearly see the product</Text>
          <Text size="sm" tone="muted">{take.product_check_reason ?? 'Hold the product inside the guide box with the label facing the camera.'}</Text>
          <Button title="Retake" onPress={() => router.push(`/shoot/${id}`)} />
        </Card>
      )}
      {take && take.product_check === 'passed' && assignment.status === 'processing' && <Badge tone="ok" icon={<Check size={11} color={c.ok} />} label="Product check passed" />}

      {assignment.status === 'processing' && (
        <Card style={{ gap: 12 }}>
          <Text weight="semibold">Building your variants</Text>
          <ProgressBar value={(processJob?.progress ?? 2) / 100} />
          <Text size="sm" tone="muted">{processJob?.status === 'failed' ? `Something went wrong: ${processJob.error ?? 'unknown error'}` : (processJob?.progress ?? 0) < 10 ? 'Transcribing your take and removing filler…' : `Cutting formats, captions and aspect ratios… ${processJob?.progress ?? 0}%`}</Text>
          <Text size="xs" tone="faint">You can leave this screen. We’ll notify you when they’re ready.</Text>
        </Card>
      )}

      {assignment.status === 'qa_review' && <Card><Text weight="semibold">In quality review</Text><Text size="sm" tone="muted">Our team checks new submissions before the brand sees them. Usually within a few hours.</Text></Card>}

      {winner && (
        <Card style={{ gap: 10, borderColor: c.warn }}>
          <Row gap={6}><Trophy size={16} color={c.warn} /><Text weight="semibold">Post your winning ad</Text></Row>
          <Text size="sm" tone="muted">{assignment.campaigns.brands.name} chose {FORMATS[winner.format].name}. Post it on your feed, then paste the link. You never post the other variants.</Text>
          {assignment.post_url ? <Text size="sm" tone="ok">Posted: {assignment.post_url}</Text> : (
            <><Field label="Link to your post" value={postUrl} onChangeText={setPostUrl} autoCapitalize="none" keyboardType="url" placeholder="https://www.instagram.com/reel/…" />
              <Button small title="Submit link" disabled={!postUrl} loading={busy === 'post'} onPress={() => act('post', () => rpc('submit_post_link', { p_assignment_id: id, p_url: postUrl.trim() }), 'Thanks. The brand has been notified.')} /></>
          )}
        </Card>
      )}

      {built.length > 0 && <Text size="sm" tone="muted">{canSubmit ? 'Ranked against the brief. Untick anything you don’t want the brand to see.' : 'Your variants for this campaign.'}</Text>}

      {built.map((v, i) => {
        const f = FORMATS[v.format];
        const editable = canSubmit && ['ready', 'qa_rejected'].includes(v.status);
        const on = !!picked?.has(v.id);
        const video = urls[v.renditions['9:16'] ?? ''];
        const weak = (v.score ?? 0) < 80;
        return (
          <Animated.View key={v.id} entering={FadeInDown.delay(i * 60).duration(260)}>
            <Card style={{ gap: 12, borderColor: editable && on ? c.accent : c.line }}>
              <Row gap={12} style={{ alignItems: 'flex-start' }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Play ${f.name}`} onPress={() => setPlaying(playing === v.id ? null : v.id)} style={{ width: 84, height: 149, borderRadius: 12, overflow: 'hidden', backgroundColor: c.raised }}>
                  {v.status === 'processing' ? <Skeleton height={149} /> : <><Image source={urls[v.thumbnail ?? '']} style={{ width: '100%', height: '100%' }} contentFit="cover" /><View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}><Play size={16} color="#fff" fill="#fff" /></View></View></>}
                </Pressable>
                <View style={{ flex: 1, gap: 6 }}>
                  <Row style={{ justifyContent: 'space-between' }}><Text weight="semibold">{f.name}</Text>{STATUS[v.status] ? <Badge tone={STATUS[v.status]!.tone} label={STATUS[v.status]!.label} /> : <Text size="xs" tone="faint">#{i + 1}</Text>}</Row>
                  <Text size="xs" tone="muted">{f.tagline}</Text>
                  {v.is_synthetic && <Badge tone="warn" icon={<Sparkles size={11} color={c.warn} />} label={v.language ? `AI voice · ${v.language.toUpperCase()}` : 'AI scene · labelled'} />}
                  {v.qa_note && v.status === 'qa_rejected' && <Text size="xs" tone="bad">QA: {v.qa_note}</Text>}
                  {/* Win Predictor is Pro-only */}
                  {me?.isPro ? (
                    <View style={{ gap: 4, marginTop: 2 }}>
                      <Row gap={8}><Text size="xs" tone="muted">Win Predictor</Text><Text size="sm" weight="bold" tone={weak ? 'warn' : 'ok'}>{v.score ?? '—'}</Text></Row>
                      <ProgressBar value={(v.score ?? 0) / 100} tone={weak ? 'accent' : 'ok'} />
                      <Text size="xs" tone="faint">{v.score_reason}</Text>
                    </View>
                  ) : (
                    <Pressable accessibilityRole="button" onPress={() => router.push('/pro')}><Row gap={6}><Lock size={12} color={c.faint} /><Text size="xs" tone="faint">Win Predictor score · Pro</Text></Row></Pressable>
                  )}
                </View>
              </Row>
              {playing === v.id && video && <Player uri={video} />}
              {v.hook_options.length > 0 && f.edit.hookOverlay && (
                <View style={{ gap: 8 }}>
                  <Text size="xs" tone="muted" weight="semibold">ON-SCREEN HOOK {editable ? '· tap to change (re-renders)' : ''}</Text>
                  <Row gap={8} style={{ flexWrap: 'wrap' }}>
                    {v.hook_options.map((h) => <Chip key={h} plain label={h} on={h === v.hook_text} onPress={() => editable && h !== v.hook_text && busy === null && act(`hook-${v.id}`, () => rpc('set_hook', { p_variant_id: v.id, p_hook: h }), 'Re-rendering with your hook…')} />)}
                  </Row>
                  {editable && me?.isPro && weak && <Button small variant="secondary" title="Rewrite weak hook" icon={<Wand2 size={14} color={c.fg} />} loading={busy === `rw-${v.id}`} onPress={() => rewrite(v)} />}
                  <Text size="xs" tone="faint">Hooks only use your own words. They never add product claims.</Text>
                </View>
              )}
              {editable && <Button small variant={on ? 'primary' : 'secondary'} title={on ? 'Brand will see this' : 'Hidden from the brand'} icon={on ? <Check size={14} color="#fff" /> : undefined} onPress={() => { const n = new Set(picked); if (on) n.delete(v.id); else n.add(v.id); setPicked(n); }} />}
            </Card>
          </Animated.View>
        );
      })}

      {take && assignment.status !== 'processing' && (
        <View style={{ gap: 10 }}>
          <Text size="sm" tone="muted" weight="semibold">MORE FORMATS</Text>
          {FORMAT_LIST.filter((f) => !builtFormats.has(f.id)).map((f) => (
            <Card key={f.id} style={{ opacity: 0.7 }}>
              <Row style={{ justifyContent: 'space-between' }}><Text weight="medium">{f.name}</Text>{f.v1 && f.proOnly ? <Pressable accessibilityRole="button" onPress={() => router.push('/pro')}><Badge tone="accent" label="Pro" /></Pressable> : <Badge label="Coming soon" />}</Row>
              <Text size="xs" tone="muted">{f.v1 && f.proOnly ? 'Your review dubbed into Hindi, Tamil, Telugu or Arabic in your own voice.' : f.tagline}</Text>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
